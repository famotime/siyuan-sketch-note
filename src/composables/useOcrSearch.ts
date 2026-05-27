import { ref } from "vue";
import type { Ref } from "vue";
import type { SketchData } from "@/types/sketch";
import type { OcrProvider } from "@/search/ocrProvider";
import { createNoopOcrProvider } from "@/search/ocrProvider";
import { createPageAwareOcrIndex, searchOcrIndex } from "@/search/ocrIndex";
import type { OcrSearchResult } from "@/search/ocrIndex";
import { createCurrentPagePngExportPlan, dataUrlToBlob } from "@/export/png";
import { renderSketchPngPageImage } from "@/storage/thumbnail";

export function useOcrSearch(ctx: {
  canvasRef: Ref<{ getData: () => SketchData } | undefined>;
  ocrProvider?: OcrProvider;
  currentTemplate: Ref<string>;
  blockId: Ref<string>;
  ocrIndex: Ref<SketchData["ocrIndex"]>;
  markDirty: () => void;
  scheduleAutoSave: () => void;
  autoSave: Ref<boolean>;
}) {
  const ocrState = ref<"idle" | "recognizing" | "completed" | "error">("idle");
  const searchResults = ref<OcrSearchResult[]>([]);
  const searchResultIndex = ref(0);

  async function recognizeText() {
    if (!ctx.canvasRef.value) return;
    const provider = ctx.ocrProvider ?? createNoopOcrProvider();

    ocrState.value = "recognizing";
    try {
      const data = ctx.canvasRef.value.getData();
      data.template = ctx.currentTemplate.value;
      const plan = createCurrentPagePngExportPlan(ctx.blockId.value, data);
      const pngDataUrl = await renderSketchPngPageImage(data, plan, false);
      const blob = dataUrlToBlob(pngDataUrl);

      const lines = await provider({
        imageBlob: blob,
        canvasWidth: data.canvasWidth,
        canvasHeight: data.canvasHeight,
      });

      if (lines.length === 0) {
        ocrState.value = "completed";
        return;
      }

      ctx.ocrIndex.value = createPageAwareOcrIndex(ctx.blockId.value, lines, data);

      ctx.markDirty();
      if (ctx.autoSave.value) ctx.scheduleAutoSave();

      ocrState.value = "completed";
    } catch (e) {
      console.error("[Sketch Note] OCR failed:", e);
      ocrState.value = "error";
    }
  }

  function onSearch(query: string) {
    if (!ctx.ocrIndex.value || !query.trim()) {
      searchResults.value = [];
      searchResultIndex.value = 0;
      return;
    }
    searchResults.value = searchOcrIndex(ctx.ocrIndex.value, query);
    searchResultIndex.value = 0;
    if (searchResults.value.length > 0) {
      navigateToSearchResult(0);
    }
  }

  function onSearchNext() {
    if (searchResults.value.length === 0) return;
    searchResultIndex.value = (searchResultIndex.value + 1) % searchResults.value.length;
    navigateToSearchResult(searchResultIndex.value);
  }

  function onSearchPrev() {
    if (searchResults.value.length === 0) return;
    searchResultIndex.value = (searchResultIndex.value - 1 + searchResults.value.length) % searchResults.value.length;
    navigateToSearchResult(searchResultIndex.value);
  }

  function navigateToSearchResult(index: number) {
    const result = searchResults.value[index];
    if (!result || !ctx.canvasRef.value) return;
    (ctx.canvasRef.value as any).highlightSearchResult(result);
  }

  function onClearSearch() {
    searchResults.value = [];
    searchResultIndex.value = 0;
  }

  return { ocrState, ocrIndex: ctx.ocrIndex, searchResults, recognizeText, onSearch, onSearchNext, onSearchPrev, onClearSearch };
}

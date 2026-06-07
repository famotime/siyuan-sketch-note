import { ref } from "vue";
import type { Ref } from "vue";
import type { SketchData } from "@/types/sketch";
import { renderSketchPdfPageImages, renderSketchPngPageImage } from "@/storage/thumbnail";
import { createCurrentPagePngExportPlan, dataUrlToBlob, downloadBlob, createExportPngFileName, embedSketchDataInPngBlob } from "@/export/png";
import { createExportPdfFileName, createPdfExportPlanFromSketch, exportPdf as exportPdfBlob, embedSketchDataInPdfBlob } from "@/export/pdf";
import { createExportJsonFileName, exportSketchJson } from "@/export/json";

export function useExportManager(ctx: {
  canvasRef: Ref<{ getData: () => SketchData } | undefined>;
  currentTemplate: Ref<string>;
  colorPalettes: Ref<{ pen: string[]; highlighter: string[] }>;
  favoriteColors: Ref<{ pen: (string | null)[]; highlighter: (string | null)[] }>;
  toolPresets: Ref<Record<string, any>>;
  inputSettings: Ref<any>;
  customBackgrounds: Ref<any[]>;
  blockId: Ref<string>;
}) {
  const exportIncludeBackground = ref(true);
  const exportIncludeSketchData = ref(true);

  async function exportPng() {
    if (!ctx.canvasRef.value) return;
    const data = ctx.canvasRef.value.getData();
    data.template = ctx.currentTemplate.value;
    data.recentColors = ctx.colorPalettes.value.pen;
    data.highlighterRecentColors = ctx.colorPalettes.value.highlighter;
    data.favoriteColors = ctx.favoriteColors.value.pen;
    data.highlighterFavoriteColors = ctx.favoriteColors.value.highlighter;
    const plan = createCurrentPagePngExportPlan(ctx.blockId.value, data);
    const pngDataUrl = await renderSketchPngPageImage(data, plan, exportIncludeBackground.value);
    const pngBlob = dataUrlToBlob(pngDataUrl);
    const blob = exportIncludeSketchData.value ? await embedSketchDataInPngBlob(pngBlob, data) : pngBlob;
    downloadBlob(blob, createExportPngFileName(ctx.blockId.value, new Date(), plan.pageNumber));
  }

  async function exportPdf() {
    if (!ctx.canvasRef.value) return;
    const data = ctx.canvasRef.value.getData();
    data.template = ctx.currentTemplate.value;
    data.recentColors = ctx.colorPalettes.value.pen;
    data.highlighterRecentColors = ctx.colorPalettes.value.highlighter;
    data.favoriteColors = ctx.favoriteColors.value.pen;
    data.highlighterFavoriteColors = ctx.favoriteColors.value.highlighter;
    const plan = createPdfExportPlanFromSketch(
      ctx.blockId.value,
      data,
      undefined,
      exportIncludeBackground.value,
    );
    const pageImages = await renderSketchPdfPageImages(data, plan);
    const pdfBlob = await exportPdfBlob(plan, { pageImages });
    const blob = exportIncludeSketchData.value ? await embedSketchDataInPdfBlob(pdfBlob, data) : pdfBlob;
    downloadBlob(blob, createExportPdfFileName(ctx.blockId.value));
  }

  function exportJson() {
    if (!ctx.canvasRef.value) return;
    const data = ctx.canvasRef.value.getData();
    data.template = ctx.currentTemplate.value;
    data.toolPresets = ctx.toolPresets.value;
    data.inputSettings = ctx.inputSettings.value;
    data.customBackgrounds = ctx.customBackgrounds.value;
    data.recentColors = ctx.colorPalettes.value.pen;
    data.highlighterRecentColors = ctx.colorPalettes.value.highlighter;
    data.favoriteColors = ctx.favoriteColors.value.pen;
    data.highlighterFavoriteColors = ctx.favoriteColors.value.highlighter;
    const blob = exportSketchJson(data);
    downloadBlob(blob, createExportJsonFileName(ctx.blockId.value));
  }

  return { exportIncludeBackground, exportIncludeSketchData, exportPng, exportPdf, exportJson };
}

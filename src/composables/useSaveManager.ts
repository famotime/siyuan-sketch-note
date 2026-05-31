import { ref, onUnmounted } from "vue";
import type { Ref } from "vue";
import type { SketchData } from "@/types/sketch";
import { storageKey } from "@/storage";
import { thumbnailSketchDataAsync } from "@/storage/thumbnail";
import { showMessage } from "siyuan";
import { sketchAssetFileName, uploadDataUrlToAssets } from "@/utils/uploadPng";
import { SaveQueue } from "@/storage/saveQueue";
import type { SaveStatus } from "@/storage/saveStatus";

export function useSaveManager(ctx: {
  canvasRef: Ref<{ getData: () => SketchData; getState: () => { isDirty: boolean } } | undefined>;
  blockId: Ref<string>;
  saveData: (key: string, data: any) => Promise<void>;
  currentTemplate: Ref<string>;
  toolPresets: Ref<Record<string, any>>;
  inputSettings: Ref<any>;
  customBackgrounds: Ref<any[]>;
  colorPalettes: Ref<{ pen: string[]; highlighter: string[] }>;
  favoriteColors: Ref<{ pen: (string | null)[]; highlighter: (string | null)[] }>;
  ocrIndex: Ref<any>;
  t: (key: string) => string;
  onSaved?: () => void;
}) {
  const saveStatus = ref<SaveStatus>("idle");
  const lastSavedAt = ref<number | null>(null);
  const autoSave = ref(true);
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  const saveQueue = new SaveQueue();

  onUnmounted(() => {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
  });

  function markDirty() {
    if (saveStatus.value === "saved" || saveStatus.value === "idle") {
      saveStatus.value = "dirty";
    }
  }

  function scheduleAutoSave() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      autoSaveTimer = null;
      if (saveStatus.value === "dirty" || saveStatus.value === "error") doSave();
    }, 1500);
  }

  async function doSave(): Promise<boolean> {
    return saveQueue.enqueue(runSave);
  }

  async function runSave(): Promise<boolean> {
    if (!ctx.canvasRef.value) return false;
    saveStatus.value = "saving";
    const data = ctx.canvasRef.value.getData();
    data.template = ctx.currentTemplate.value;
    data.toolPresets = ctx.toolPresets.value;
    data.inputSettings = ctx.inputSettings.value;
    data.customBackgrounds = ctx.customBackgrounds.value;
    data.recentColors = ctx.colorPalettes.value.pen;
    data.highlighterRecentColors = ctx.colorPalettes.value.highlighter;
    data.favoriteColors = ctx.favoriteColors.value.pen;
    data.highlighterFavoriteColors = ctx.favoriteColors.value.highlighter;
    if (ctx.ocrIndex.value) {
      data.ocrIndex = ctx.ocrIndex.value;
    }
    delete data.recovery;

    let pngDataUrl: string;
    try {
      pngDataUrl = await thumbnailSketchDataAsync(data);
    } catch (e) {
      console.error("[Sketch Note] Thumbnail generation failed:", e);
      pngDataUrl = createFallbackThumbnail();
    }

    try {
      const fileName = sketchAssetFileName(ctx.blockId.value);
      await uploadDataUrlToAssets(pngDataUrl, fileName);
      await ctx.saveData(storageKey(ctx.blockId.value), data);
      saveStatus.value = "saved";
      lastSavedAt.value = Date.now();
      ctx.canvasRef.value.getState().isDirty = false;
      ctx.onSaved?.();
      return true;
    } catch (e) {
      console.error("[Sketch Note] Save failed:", e);
      saveStatus.value = "error";
      showMessage(ctx.t("saveFailed"), 5000, "error");
      return false;
    }
  }

  async function manualSave() {
    if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null; }
    await doSave();
  }

  function onStroke() {
    markDirty();
    if (autoSave.value) scheduleAutoSave();
  }

  function markAndSchedule() {
    markDirty();
    if (autoSave.value) scheduleAutoSave();
  }

  return { saveStatus, lastSavedAt, autoSave, markDirty, scheduleAutoSave, doSave, manualSave, onStroke, markAndSchedule };
}

function createFallbackThumbnail(): string {
  const c = document.createElement("canvas");
  c.width = 800; c.height = 200;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 800, 200);
  ctx.fillStyle = "#999"; ctx.font = "16px sans-serif"; ctx.textAlign = "center";
  ctx.fillText("Sketch Note", 400, 105);
  return c.toDataURL("image/png");
}

<template>
  <div v-if="visible" class="sketch-editor">
    <div class="sketch-editor__header">
      <EditorTopBar
        v-model:templateId="currentTemplate"
        :backgroundFit="activeCustomBackground?.fit"
        :canRedo="canRedo"
        :canUndo="canUndo"
        :exportIncludeBackground="exportIncludeBackground"
        :ocrState="ocrState"
        :pageOverview="pageOverview"
        :pageState="pageState"
        :recovered="Boolean(loadedData?.recovery?.recovered)"
        :searchResultCount="searchResults.length"
        :stylusOnly="inputSettings.stylusOnly"
        :enablePressure="inputSettings.enablePressure ?? false"
        :t="t"
        :templates="templates"
        @addPage="canvasRef?.addPage()"
        @back="goBack"
        @backgroundFitChange="onBackgroundFitChange"
        @clear="canvasRef?.doClear()"
        @clearSearch="onClearSearch"
        @deletePage="deleteCurrentPage"
        @duplicatePage="canvasRef?.duplicateCurrentPage()"
        @exportJson="exportJson"
        @exportPdf="exportPdf"
        @exportPng="exportPng"
        @goToPage="canvasRef?.goToPage($event)"
        @importBackground="triggerBackgroundImport"
        @importJson="triggerJsonImport"
        @nextPage="canvasRef?.goToNextPage()"
        @previousPage="canvasRef?.goToPreviousPage()"
        @recognize="recognizeText"
        @redo="canvasRef?.doRedo()"
        @search="onSearch"
        @searchNext="onSearchNext"
        @searchPrev="onSearchPrev"
        @toggleExportBackground="exportIncludeBackground = !exportIncludeBackground"
        @toggleStylusOnly="toggleStylusOnly"
        @togglePressure="togglePressure"
        @undo="canvasRef?.doUndo()"
      />
      <ToolBar
        :activeTool="activeTool"
        :lastShapeTool="lastShapeTool"
        :t="t"
        @selectTool="selectTool"
      />
      <input
        ref="imageInputRef"
        class="sketch-file-input"
        type="file"
        accept="image/*"
        @change="onImageSelected"
      >
      <input
        ref="jsonInputRef"
        class="sketch-file-input"
        type="file"
        accept="application/json,.json"
        @change="onJsonSelected"
      >
      <input
        ref="backgroundInputRef"
        class="sketch-file-input"
        type="file"
        accept="image/*"
        @change="onBackgroundSelected"
      >
    </div>

    <div
      ref="bodyRef"
      class="sketch-editor__body"
      @wheel="onBodyWheel"
    >
      <SketchCanvas
        ref="canvasRef"
        :initialData="loadedData"
        :tool="activeTool"
        :toolPresets="{ ...toolPresets, text: textPreset }"
        :inputSettings="inputSettings"
        :templateId="currentTemplate"
        :lassoMode="lassoMode"
        @update:canUndo="canUndo = $event"
        @update:canRedo="canRedo = $event"
        @heightChanged="onHeightChanged"
        @pagesChanged="onPagesChanged"
        @stroke="onStroke"
      />
    </div>
    <FloatingToolbar
      v-model:lassoMode="lassoMode"
      :activeTool="activeTool"
      :colors="colors"
      :preset="activePreset"
      :t="t"
      @selectColor="selectColor"
      @selectCustomColor="selectCustomColor"
      @selectTool="selectTool"
      @updatePreset="updateActivePreset"
      @deleteSelection="canvasRef?.deleteLassoSelection()"
      @duplicateSelection="canvasRef?.duplicateLassoSelection()"
      @recolorSelection="recolorSelection"
      @deleteColor="deleteColor"
      @resetDefaultColors="resetDefaultColors"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import type { SketchData, ToolPreset } from "@/types/sketch";
import { PRESET_COLORS, HIGHLIGHTER_PRESET_COLORS } from "@/types/sketch";
import { getAllTemplates } from "@/template";
import { renderSketchPdfPageImages, renderSketchPngPageImage, thumbnailSketchDataAsync } from "@/storage/thumbnail";
import { showMessage } from "siyuan";
import { sketchAssetFileName, uploadDataUrlToAssets } from "@/utils/uploadPng";
import { normalizeToolPresets, updateToolPreset } from "@/tools/presets";
import { createCurrentPagePngExportPlan, createExportPngFileName, dataUrlToBlob, downloadBlob } from "@/export/png";
import { createExportPdfFileName, createPdfExportPlanFromSketch, exportPdf as exportPdfBlob } from "@/export/pdf";
import { createExportJsonFileName, exportSketchJson, importSketchJson } from "@/export/json";
import { SaveQueue } from "@/storage/saveQueue";
import { createSaveStatusLabel } from "@/storage/saveStatus";
import type { SaveStatus } from "@/storage/saveStatus";
import { normalizeInputSettings } from "./inputMode";
import { createCustomBackgroundTemplate, getCustomBackgroundTemplate, updateCustomBackgroundFit } from "@/template/customBackground";
import type { CustomBackgroundTemplate } from "@/template/customBackground";
import type { PageOverviewItem } from "@/pages/model";
import {
  addRecentColor,
  normalizeRecentColors,
  appendRecentColor,
} from "@/tools/palette";
import { getFirstImageFileFromClipboard } from "./clipboard";
import { resolveEditorShortcut } from "./shortcuts";
import { getDrawingToolForEditorTool, isShapeEditorTool } from "./tools";
import type { EditorTool, ShapeEditorTool } from "./tools";
import type { OcrProvider } from "@/search/ocrProvider";
import { createNoopOcrProvider } from "@/search/ocrProvider";
import { createPageAwareOcrIndex, searchOcrIndex } from "@/search/ocrIndex";
import type { OcrSearchResult } from "@/search/ocrIndex";
import EditorTopBar from "./EditorTopBar.vue";
import SketchCanvas from "./SketchCanvas.vue";
import ToolBar from "./ToolBar.vue";
import FloatingToolbar from "./FloatingToolbar.vue";

const props = defineProps<{
  blockId: string;
  initialData: SketchData | null;
  i18n: Record<string, string>;
  saveData: (key: string, data: any) => Promise<void>;
  ocrProvider?: OcrProvider;
}>();

const emit = defineEmits<{ (e: "close"): void }>();

function t(key: string): string { return props.i18n[key] ?? key; }

const visible = ref(false);
const canvasRef = ref<InstanceType<typeof SketchCanvas>>();
const bodyRef = ref<HTMLDivElement>();
const imageInputRef = ref<HTMLInputElement>();
const jsonInputRef = ref<HTMLInputElement>();
const backgroundInputRef = ref<HTMLInputElement>();
const activeTool = ref<EditorTool>("pen");
const lassoMode = ref<"freehand" | "box">("freehand");
const lastShapeTool = ref<ShapeEditorTool>("line");
const activeColor = ref(PRESET_COLORS[0]);
const toolPresets = ref(normalizeToolPresets(props.initialData?.toolPresets));

// 文本专属预设 (包含字号 width 及 颜色 color)，独立配置并跨文档记忆
const textPreset = ref({
  color: "#000000",
  width: 20, // 默认字号 20px
  opacity: 1,
});

onMounted(() => {
  try {
    const cachedText = localStorage.getItem("sketch-note-text-preset");
    if (cachedText) {
      const parsed = JSON.parse(cachedText);
      if (parsed && typeof parsed.color === "string" && typeof parsed.width === "number") {
        textPreset.value = {
          color: parsed.color,
          width: parsed.width,
          opacity: parsed.opacity ?? 1,
        };
      }
    }
  } catch (e) {
    console.error("加载文本预设失败:", e);
  }
});
const inputSettings = ref(normalizeInputSettings(props.initialData?.inputSettings));
const customBackgrounds = ref(props.initialData?.customBackgrounds ?? []);
const recentColors = ref(normalizeRecentColors(props.initialData?.recentColors));
const canUndo = ref(false);
const canRedo = ref(false);
const pageState = ref({ current: 1, total: 1 });
const pageOverview = ref<PageOverviewItem[]>([]);
const currentTemplate = ref(props.initialData?.template ?? "blank");
const templates = computed(() => [
  ...getAllTemplates(),
  ...customBackgrounds.value,
]);
const loadedData = ref<SketchData | null>(props.initialData);
const saveStatus = ref<SaveStatus>("idle");
const lastSavedAt = ref<number | null>(null);
const autoSave = ref(true);
const exportIncludeBackground = ref(true);

const ocrState = ref<"idle" | "recognizing" | "completed" | "error">("idle");
const ocrIndex = ref<SketchData["ocrIndex"]>(props.initialData?.ocrIndex ?? undefined);
const searchResults = ref<OcrSearchResult[]>([]);
const searchResultIndex = ref(0);

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
const saveQueue = new SaveQueue();

const statusLabel = computed(() => createSaveStatusLabel(saveStatus.value, t, lastSavedAt.value));

const activePreset = computed(() => {
  if (activeTool.value === "text") {
    return {
      tool: "text",
      mode: "ink",
      ...textPreset.value,
    } as any;
  }
  return toolPresets.value[getDrawingToolForEditorTool(activeTool.value)];
});
const colors = computed(() => {
  if (activeTool.value === "highlighter") {
    return HIGHLIGHTER_PRESET_COLORS;
  }
  return recentColors.value;
});
const activeCustomBackground = computed(() => getCustomBackgroundTemplate({
  template: currentTemplate.value,
  customBackgrounds: customBackgrounds.value,
}));

onMounted(() => {
  visible.value = true;
  document.body.style.overflow = "hidden";
  window.addEventListener("paste", onPaste);
  window.addEventListener("keydown", onKeyDown);
});

onUnmounted(() => {
  document.body.style.overflow = "";
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  window.removeEventListener("paste", onPaste);
  window.removeEventListener("keydown", onKeyDown);
});

// ─── Toolbar actions ───

function selectColor(c: string) {
  activeColor.value = c;
  if (activeTool.value === "eraser") {
    activeTool.value = "pen";
  }
  updateActivePreset({ color: c });
  // 普通切换颜色不再改变 recentColors 列表的顺序，仅更新选中状态以维持位置恒定
}

function selectCustomColor(c: string) {
  activeColor.value = c;
  if (activeTool.value === "eraser") {
    activeTool.value = "pen";
  }
  updateActivePreset({ color: c });
  // 自定义颜色选择时，将其从后端追加，推动现有颜色往前滚
  recentColors.value = appendRecentColor(recentColors.value, c);
}

function recolorSelection(c: string) {
  canvasRef.value?.recolorLasso(c);
  recentColors.value = addRecentColor(recentColors.value, c);
}

function deleteColor(color: string) {
  recentColors.value = recentColors.value.filter((c) => c !== color);
  showMessage(t("colorDeleted") || "已删除该颜色", 3000, "info");
  
  if (activePreset.value.color === color) {
    const fallback = recentColors.value[0] ?? PRESET_COLORS[0];
    selectColor(fallback);
  }
  markDirty();
  if (autoSave.value) scheduleAutoSave();
}

function resetDefaultColors() {
  recentColors.value = normalizeRecentColors(PRESET_COLORS);
  showMessage(t("colorReset") || "已恢复默认颜色设置", 3000, "info");
  
  selectColor(PRESET_COLORS[0]);
  markDirty();
  if (autoSave.value) scheduleAutoSave();
}

function selectTool(tool: EditorTool) {
  if (tool === "image") {
    triggerImageImport();
    return;
  }
  if (isShapeEditorTool(tool)) {
    lastShapeTool.value = tool;
  }
  activeTool.value = tool;
}

function updateActivePreset(patch: Partial<Omit<ToolPreset, "tool">>) {
  if (activeTool.value === "text") {
    textPreset.value = {
      ...textPreset.value,
      ...patch,
    };
    try {
      localStorage.setItem("sketch-note-text-preset", JSON.stringify(textPreset.value));
    } catch (e) {
      console.error("保存文本预设失败:", e);
    }
    return;
  }
  toolPresets.value = updateToolPreset(toolPresets.value, getDrawingToolForEditorTool(activeTool.value), patch);
}

function toggleAutoSave() {
  autoSave.value = !autoSave.value;
  if (!autoSave.value && autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
}

function toggleStylusOnly() {
  inputSettings.value = {
    ...inputSettings.value,
    stylusOnly: !inputSettings.value.stylusOnly,
  };
  markDirty();
  if (autoSave.value) scheduleAutoSave();
}

function togglePressure() {
  inputSettings.value = {
    ...inputSettings.value,
    enablePressure: inputSettings.value.enablePressure === undefined ? false : !inputSettings.value.enablePressure,
  };
  markDirty();
  if (autoSave.value) scheduleAutoSave();
}

// ─── Save logic ───

function markDirty() {
  if (saveStatus.value === "saved" || saveStatus.value === "idle") {
    saveStatus.value = "dirty";
  }
}

function onStroke() {
  syncPageOverview();
  markDirty();
  if (autoSave.value) scheduleAutoSave();
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
  if (!canvasRef.value) return false;
  saveStatus.value = "saving";
  const data = canvasRef.value.getData();
  data.template = currentTemplate.value;
  data.toolPresets = toolPresets.value;
  data.inputSettings = inputSettings.value;
  data.customBackgrounds = customBackgrounds.value;
  data.recentColors = recentColors.value;
  if (ocrIndex.value) {
    data.ocrIndex = ocrIndex.value;
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
    const fileName = sketchAssetFileName(props.blockId);
    await uploadDataUrlToAssets(pngDataUrl, fileName);
    await props.saveData(`sketch:${props.blockId}`, data);
    saveStatus.value = "saved";
    lastSavedAt.value = Date.now();
    canvasRef.value.getState().isDirty = false;
    return true;
  } catch (e) {
    console.error("[Sketch Note] Save failed:", e);
    saveStatus.value = "error";
    showMessage(t("saveFailed"), 5000, "error");
    return false;
  }
}

async function manualSave() {
  if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null; }
  await doSave();
}

// ─── OCR & Search ───

async function recognizeText() {
  if (!canvasRef.value) return;
  const provider = props.ocrProvider ?? createNoopOcrProvider();

  ocrState.value = "recognizing";
  try {
    const data = canvasRef.value.getData();
    data.template = currentTemplate.value;
    const plan = createCurrentPagePngExportPlan(props.blockId, data);
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

    ocrIndex.value = createPageAwareOcrIndex(props.blockId, lines, data);

    markDirty();
    if (autoSave.value) scheduleAutoSave();

    ocrState.value = "completed";
  } catch (e) {
    console.error("[Sketch Note] OCR failed:", e);
    ocrState.value = "error";
  }
}

function onSearch(query: string) {
  if (!ocrIndex.value || !query.trim()) {
    searchResults.value = [];
    searchResultIndex.value = 0;
    return;
  }
  searchResults.value = searchOcrIndex(ocrIndex.value, query);
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
  if (!result || !canvasRef.value) return;
  canvasRef.value.highlightSearchResult(result);
}

function onClearSearch() {
  searchResults.value = [];
  searchResultIndex.value = 0;
}

async function exportPng() {
  if (!canvasRef.value) return;
  const data = canvasRef.value.getData();
  data.template = currentTemplate.value;
  data.recentColors = recentColors.value;
  const plan = createCurrentPagePngExportPlan(props.blockId, data);
  const pngDataUrl = await renderSketchPngPageImage(data, plan, exportIncludeBackground.value);
  const blob = dataUrlToBlob(pngDataUrl);
  downloadBlob(blob, createExportPngFileName(props.blockId, new Date(), plan.pageNumber));
}

async function exportPdf() {
  if (!canvasRef.value) return;
  const data = canvasRef.value.getData();
  data.template = currentTemplate.value;
  data.recentColors = recentColors.value;
  const plan = createPdfExportPlanFromSketch(
    props.blockId,
    data,
    undefined,
    exportIncludeBackground.value,
  );
  const pageImages = await renderSketchPdfPageImages(data, plan);
  const blob = await exportPdfBlob(plan, { pageImages });
  downloadBlob(blob, createExportPdfFileName(props.blockId));
}

function exportJson() {
  if (!canvasRef.value) return;
  const data = canvasRef.value.getData();
  data.template = currentTemplate.value;
  data.toolPresets = toolPresets.value;
  data.inputSettings = inputSettings.value;
  data.customBackgrounds = customBackgrounds.value;
  data.recentColors = recentColors.value;
  const blob = exportSketchJson(data);
  downloadBlob(blob, createExportJsonFileName(props.blockId));
}

function triggerJsonImport() {
  jsonInputRef.value?.click();
}

function triggerBackgroundImport() {
  backgroundInputRef.value?.click();
}

async function onBackgroundFitChange(value: string) {
  if (!canvasRef.value || !activeCustomBackground.value) return;
  const fit = value as CustomBackgroundTemplate["fit"];
  customBackgrounds.value = updateCustomBackgroundFit(
    customBackgrounds.value,
    activeCustomBackground.value.id,
    fit,
  );
  loadedData.value = {
    ...(canvasRef.value.getData()),
    template: currentTemplate.value,
    customBackgrounds: customBackgrounds.value,
  };
  await canvasRef.value.restoreData(loadedData.value);
  onStroke();
}

function deleteCurrentPage() {
  const removed = canvasRef.value?.deleteCurrentPage();
  syncPageOverview();
  if (!removed) {
    showMessage(t("deletePageFailed"), 4000, "error");
  }
}

function onPagesChanged(pages: { current: number; total: number }) {
  pageState.value = pages;
  syncPageOverview();
}

function syncPageOverview() {
  pageOverview.value = canvasRef.value?.getPageOverviewItems() ?? [];
}

async function onJsonSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || !canvasRef.value) return;

  try {
    const imported = importSketchJson(await file.text());
    const importedPresets = normalizeToolPresets(imported.toolPresets);
    imported.toolPresets = importedPresets;
    currentTemplate.value = imported.template;
    toolPresets.value = importedPresets;
    inputSettings.value = normalizeInputSettings(imported.inputSettings);
    customBackgrounds.value = imported.customBackgrounds ?? [];
    recentColors.value = normalizeRecentColors(imported.recentColors);
    loadedData.value = imported;
    await canvasRef.value.restoreData(imported);
    onStroke();
  } catch (error) {
    console.error("[Sketch Note] JSON restore failed:", error);
    showMessage(t("importJsonFailed"), 5000, "error");
  }
}

async function onBackgroundSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || !canvasRef.value) return;

  const dataUrl = await readFileAsDataUrl(file);
  const background = createCustomBackgroundTemplate(`bg-${Date.now()}`, dataUrl);
  customBackgrounds.value = [
    ...customBackgrounds.value.filter((item) => item.id !== background.id),
    background,
  ];
  currentTemplate.value = background.id;
  loadedData.value = {
    ...(canvasRef.value.getData()),
    template: background.id,
    customBackgrounds: customBackgrounds.value,
  };
  await canvasRef.value.restoreData(loadedData.value);
  onStroke();
}

function insertTextElement() {
  activeTool.value = "text";
  canvasRef.value?.insertText();
  onStroke();
}

function triggerImageImport() {
  activeTool.value = "image";
  imageInputRef.value?.click();
}

async function onImageSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  const dataUrl = await readFileAsDataUrl(file);
  await canvasRef.value?.insertImage(dataUrl);
  onStroke();
}

async function onPaste(event: ClipboardEvent) {
  const file = event.clipboardData
    ? getFirstImageFileFromClipboard(event.clipboardData.items)
    : null;
  if (!file) return;

  event.preventDefault();
  activeTool.value = "image";
  const dataUrl = await readFileAsDataUrl(file);
  await canvasRef.value?.insertImage(dataUrl);
  onStroke();
}

function onBodyWheel(e: WheelEvent) {
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  canvasRef.value?.handleWheelZoom(e);
}

function onKeyDown(event: KeyboardEvent) {
  const shortcut = resolveEditorShortcut(event);
  if (!shortcut) return;

  event.preventDefault();
  event.stopPropagation();

  switch (shortcut.type) {
    case "deleteSelection":
      if (activeTool.value === "lasso") {
        canvasRef.value?.deleteLassoSelection();
      }
      break;
    case "duplicateSelection":
      if (activeTool.value === "lasso") {
        canvasRef.value?.duplicateLassoSelection();
      }
      break;
    case "save":
      manualSave();
      break;
    case "undo":
      canvasRef.value?.doUndo();
      break;
    case "redo":
      canvasRef.value?.doRedo();
      break;
    case "tool":
      selectTool(shortcut.tool);
      break;
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
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

// ─── Back / Close ───

async function goBack() {
  if (autoSave.value) {
    const ok = await doSave();
    if (!ok) {
      showMessage(t("saveFailed") || "Save failed, please try again", 5000, "error");
      return;
    }
    emit("close");
    return;
  }
  if (saveStatus.value === "dirty" || saveStatus.value === "error") {
    if (confirm(t("unsavedConfirm"))) { emit("close"); }
    return;
  }
  emit("close");
}

function onHeightChanged(_h: number) {}
</script>

<style scoped>
.sketch-editor {
  position: fixed; inset: 0; z-index: 999;
  background: var(--b3-theme-background);
  overflow: hidden;
}

/* ── 凌空悬浮的磨砂中控顶部卡片 ── */
.sketch-editor__header {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  z-index: 1000;
  background: rgba(28, 28, 30, 0.88);
  backdrop-filter: blur(14px) saturate(160%);
  -webkit-backdrop-filter: blur(14px) saturate(160%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.12);
  padding: 8px 16px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sketch-editor__row {
  display: flex; align-items: center; gap: 10px;
  min-height: 36px;
  overflow-x: auto;
  scrollbar-width: none;
}
.sketch-editor__row--topbar {
  overflow: visible;
}
.sketch-editor__row::-webkit-scrollbar {
  display: none;
}

.sketch-editor__row--tools {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}
.sketch-editor__title {
  font-weight: 500; font-size: 14px; color: #fff;
  white-space: nowrap;
}
.sketch-spacer { flex: 1; }

/* ── 统一的主工具栏按钮 ── */
.sketch-btn {
  pointer-events: auto !important;
  box-sizing: border-box;
  display: inline-flex; align-items: center; justify-content: center;
  padding: 5px 12px; border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  background: rgba(255, 255, 255, 0.05) !important;
  color: rgba(255, 255, 255, 0.8) !important;
  cursor: pointer; font-size: 13px;
  white-space: nowrap; user-select: none;
  -webkit-tap-highlight-color: transparent;
  min-height: 32px;
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.sketch-btn:hover {
  background: rgba(255, 255, 255, 0.15) !important;
  border-color: rgba(255, 255, 255, 0.18) !important;
  color: #fff !important;
  transform: scale(1.03);
}
.sketch-btn:active {
  transform: scale(0.96);
}
.sketch-btn:disabled {
  opacity: 0.4;
  transform: none !important;
  cursor: not-allowed;
}

.sketch-btn--back   { font-size: 13px; }
.sketch-btn--save   {
  background: var(--b3-theme-primary) !important;
  border-color: transparent !important;
  color: #fff !important;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}
.sketch-btn--save:hover {
  background: var(--b3-theme-primary) !important;
  opacity: 0.92;
  box-shadow: 0 4px 16px rgba(var(--b3-theme-primary-rgb), 0.3);
}

.sketch-btn--toggle {
  color: rgba(255, 255, 255, 0.65) !important;
}
.sketch-btn--toggle-on {
  background: rgba(255, 255, 255, 0.18) !important;
  border-color: var(--b3-theme-primary) !important;
  color: #fff !important;
}

/* 主绘图工具按钮（极致精炼磨砂风） */
.sketch-btn--tool {
  font-size: 13px;
  min-width: 44px;
  background: transparent !important;
  border: 1px solid transparent !important;
  color: rgba(255, 255, 255, 0.65) !important;
  border-radius: 8px;
}
.sketch-btn--tool:hover {
  background: rgba(255, 255, 255, 0.08) !important;
  color: #fff !important;
  border-color: transparent !important;
}
.sketch-btn--tool-active {
  background: var(--b3-theme-primary) !important;
  color: #fff !important;
  border-color: transparent !important;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
}
.sketch-btn--icon-tool {
  gap: 4px;
  padding: 5px 8px;
}
.sketch-btn__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  font-size: 15px;
  line-height: 1;
}
.sketch-btn__label {
  font-size: 12px;
}

.sketch-btn--action {
  font-size: 13px;
  min-width: 52px;
  background: rgba(255, 255, 255, 0.04) !important;
  border: 1px solid rgba(255, 255, 255, 0.06) !important;
  color: rgba(255, 255, 255, 0.75) !important;
}
.sketch-btn--action:hover {
  background: rgba(255, 255, 255, 0.12) !important;
  border-color: rgba(255, 255, 255, 0.15) !important;
  color: #fff !important;
}

.sketch-tool-options {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 3px 6px;
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  background: var(--b3-theme-background);
}
.sketch-file-input {
  display: none;
}
.sketch-range {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--b3-theme-on-surface);
  font-size: 12px;
  white-space: nowrap;
}
.sketch-range input {
  width: 92px;
}
.sketch-range output {
  min-width: 32px;
  text-align: right;
  color: var(--b3-theme-on-surface-light);
}
.sketch-mode {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--b3-theme-on-surface);
  font-size: 12px;
  white-space: nowrap;
}
.sketch-mode select {
  min-height: 26px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-size: 12px;
}

/* ── Select ── */
.sketch-select {
  pointer-events: auto !important;
  padding: 4px 8px; border-radius: 4px;
  border: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface); font-size: 13px;
  min-height: 30px;
}

/* ── Colors ── */
.sketch-colors { display: flex; gap: 6px; align-items: center; }
.sketch-color {
  pointer-events: auto !important;
  width: 26px; height: 26px; border-radius: 50%;
  border: 2px solid transparent; cursor: pointer;
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}
.sketch-color-picker {
  pointer-events: auto !important;
  position: relative;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 1px dashed var(--b3-border-color);
  color: var(--b3-theme-on-surface-light);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  line-height: 1;
  box-sizing: border-box;
  overflow: hidden;
  -webkit-tap-highlight-color: transparent;
}
.sketch-color-picker input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
.sketch-color--active {
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 2px var(--b3-theme-primary-light);
}

/* ── Separator ── */
.sketch-sep { width: 1px; height: 20px; background: var(--b3-border-color); flex-shrink: 0; }

/* ── Status ── */
.sketch-status { font-size: 12px; min-width: 36px; text-align: center; white-space: nowrap; }
.sketch-status--saved  { color: var(--b3-theme-primary); }
.sketch-status--saving { color: var(--b3-theme-on-surface-light); }
.sketch-status--error  { color: #e74c3c; }
.sketch-status--dirty  { color: #f39c12; }
.sketch-recovery {
  color: #d97706;
  font-size: 12px;
  white-space: nowrap;
}
.sketch-pages {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.sketch-page-overview {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  max-width: 180px;
  overflow-x: auto;
  padding: 0 2px;
}
.sketch-page-overview__item {
  width: 24px;
  height: 28px;
  flex: 0 0 24px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  font-size: 11px;
  line-height: 1;
}
.sketch-page-overview__item--filled {
  border-bottom-width: 3px;
  border-bottom-color: var(--b3-theme-primary);
}
.sketch-page-overview__item--active {
  background: var(--b3-theme-primary-light);
  border-color: var(--b3-theme-primary);
  font-weight: 700;
}
.sketch-btn--page {
  min-width: 28px;
  width: 28px;
  padding: 0;
  font-size: 18px;
}
.sketch-btn--page-label {
  min-width: 72px;
  padding: 4px 8px;
  font-size: 12px;
}
.sketch-btn--page-add {
  min-width: 52px;
  font-size: 12px;
}

/* ── Body ── */
.sketch-editor__body {
  position: absolute;
  inset: 0;
  z-index: 1;
  overflow: hidden;
  /* 顶部留出 116px 空间，恰好容纳绝对悬浮的双层中控顶卡，保证书写区域初始不在遮挡下 */
  padding: 116px 0 12px 0;
  box-sizing: border-box;
}

@media (max-width: 760px) {
  .sketch-btn--icon-tool {
    min-width: 34px;
    width: 34px;
    padding-inline: 0;
  }

  .sketch-btn__label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }

  .sketch-tool-options {
    flex: 0 0 auto;
  }
}
</style>

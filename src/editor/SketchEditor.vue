<template>
  <div
    v-if="visible"
    ref="editorRootRef"
    :class="[`sketch-editor--theme-${effectiveThemeMode}`]"
    class="sketch-editor"
  >
    <div
      v-show="!isZenMode"
      class="sketch-editor__header"
    >
      <EditorTopBar
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
        :templateId="currentTemplate"
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
        @toggleZenMode="enterZenMode"
        @undo="canvasRef?.doUndo()"
        @update:templateId="onTemplateChange"
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
      :class="{ 'sketch-editor__body--zen': isZenMode }"
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
      v-if="!isZenMode"
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
    <button
      v-if="isZenMode"
      class="sketch-zen-toggle"
      :style="{ left: `${zenTogglePos.left}px`, top: `${zenTogglePos.top}px` }"
      :aria-label="t(zenToggleState.ariaLabelKey)"
      :aria-pressed="zenToggleState.isPressed"
      :title="t(zenToggleState.titleKey)"
      @click="onZenToggleClick"
      @mousedown="onZenToggleDragStart"
      @touchstart="onZenToggleDragStart"
    >
      <IconParkIcon :name="zenToggleState.icon" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from "vue";
import type { SketchData, ToolPreset } from "@/types/sketch";
import { PRESET_COLORS } from "@/types/sketch";
import { getAllTemplates } from "@/template";
import { saveEditorPreferences, storageKey } from "@/storage";
import { renderSketchPdfPageImages, renderSketchPngPageImage, thumbnailSketchDataAsync } from "@/storage/thumbnail";
import { showMessage } from "siyuan";
import { sketchAssetFileName, uploadDataUrlToAssets } from "@/utils/uploadPng";
import { normalizeToolPresets, updateToolPreset } from "@/tools/presets";
import { createCurrentPagePngExportPlan, createExportPngFileName, dataUrlToBlob, downloadBlob } from "@/export/png";
import { createExportPdfFileName, createPdfExportPlanFromSketch, exportPdf as exportPdfBlob } from "@/export/pdf";
import { createExportJsonFileName, exportSketchJson, importSketchJson } from "@/export/json";
import { SaveQueue } from "@/storage/saveQueue";
import type { SaveStatus } from "@/storage/saveStatus";
import { normalizeInputSettings } from "./inputMode";
import { createCustomBackgroundTemplate, getCustomBackgroundTemplate, updateCustomBackgroundFit } from "@/template/customBackground";
import type { CustomBackgroundTemplate } from "@/template/customBackground";
import type { PageOverviewItem } from "@/pages/model";
import {
  addRecentColor,
  appendRecentColor,
  normalizeToolColorPalettes,
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
import IconParkIcon from "./IconParkIcon.vue";
import { clampZenTogglePosition, createZenToggleState } from "./zenMode";

const props = defineProps<{
  blockId: string;
  initialData: SketchData | null;
  i18n: Record<string, string>;
  saveData: (key: string, data: any) => Promise<void>;
  ocrProvider?: OcrProvider;
  themeMode: 'light' | 'dark';
}>();

const emit = defineEmits<{ (e: "close"): void }>();

function t(key: string): string { return props.i18n[key] ?? key; }

const visible = ref(false);
const editorRootRef = ref<HTMLDivElement>();
const effectiveThemeMode = ref<'light' | 'dark'>(props.themeMode);
const canvasRef = ref<InstanceType<typeof SketchCanvas>>();
const bodyRef = ref<HTMLDivElement>();
const imageInputRef = ref<HTMLInputElement>();
const jsonInputRef = ref<HTMLInputElement>();
const backgroundInputRef = ref<HTMLInputElement>();
const activeTool = ref<EditorTool>("pen");
const lassoMode = ref<"freehand" | "box">("box");
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
const colorPalettes = ref(normalizeToolColorPalettes({
  pen: props.initialData?.recentColors,
  highlighter: props.initialData?.highlighterRecentColors,
}));
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
const isZenMode = ref(false);
const zenTogglePos = ref({ left: 24, top: 132 });
const zenToggleState = computed(() => createZenToggleState(isZenMode.value));
let zenDragOffset = { x: 0, y: 0 };
let zenToggleDragging = false;
let zenToggleMoved = false;

const ocrState = ref<"idle" | "recognizing" | "completed" | "error">("idle");
const ocrIndex = ref<SketchData["ocrIndex"]>(props.initialData?.ocrIndex ?? undefined);
const searchResults = ref<OcrSearchResult[]>([]);
const searchResultIndex = ref(0);

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
let themeProbeTimer: ReturnType<typeof setInterval> | null = null;
const saveQueue = new SaveQueue();

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
    return colorPalettes.value.highlighter;
  }
  return colorPalettes.value.pen;
});
const activeCustomBackground = computed(() => getCustomBackgroundTemplate({
  template: currentTemplate.value,
  customBackgrounds: customBackgrounds.value,
}));
let lastEditorThemeDiagnosticKey = "";

onMounted(() => {
  visible.value = true;
  document.body.style.overflow = "hidden";
  window.addEventListener("paste", onPaste);
  window.addEventListener("keydown", onKeyDown);
  syncEffectiveThemeMode();
  themeProbeTimer = setInterval(syncEffectiveThemeMode, 250);
  nextTick(logEditorThemeDiagnostics);
});

onUnmounted(() => {
  document.body.style.overflow = "";
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  if (themeProbeTimer) clearInterval(themeProbeTimer);
  window.removeEventListener("paste", onPaste);
  window.removeEventListener("keydown", onKeyDown);
  removeZenToggleDragListeners();
});

watch(
  () => props.themeMode,
  () => {
    effectiveThemeMode.value = props.themeMode;
    syncEffectiveThemeMode();
    nextTick(logEditorThemeDiagnostics);
  },
);

function syncEffectiveThemeMode() {
  const resolved = resolveEditorBackgroundThemeMode();
  effectiveThemeMode.value = resolved ?? props.themeMode;
  nextTick(logEditorThemeDiagnostics);
}

function resolveEditorBackgroundThemeMode(): 'light' | 'dark' | null {
  if (!editorRootRef.value) return null;
  return resolveThemeModeFromColor(getComputedStyle(editorRootRef.value).backgroundColor);
}

function resolveThemeModeFromColor(color: string): 'light' | 'dark' | null {
  const rgb = parseCssColor(color);
  if (!rgb) return null;
  const luminance = getColorLuminance(rgb);
  return luminance < 0.5 ? 'dark' : 'light';
}

function parseCssColor(color: string): [number, number, number] | null {
  const match = color.match(/rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/i);
  if (!match) return null;
  return [
    clampColorChannel(Number(match[1])),
    clampColorChannel(Number(match[2])),
    clampColorChannel(Number(match[3])),
  ];
}

function getColorLuminance([redChannel, greenChannel, blueChannel]: [number, number, number]): number {
  const [red, green, blue] = [redChannel, greenChannel, blueChannel].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function clampColorChannel(value: number): number {
  return Math.max(0, Math.min(255, value));
}

function logEditorThemeDiagnostics() {
  if (!editorRootRef.value) return;
  const style = getComputedStyle(editorRootRef.value);
  const diagnostics = {
    propThemeMode: props.themeMode,
    effectiveThemeMode: effectiveThemeMode.value,
    className: editorRootRef.value.className,
    toolbarSurface: style.getPropertyValue("--sketch-toolbar-surface").trim(),
    toolbarText: style.getPropertyValue("--sketch-toolbar-text").trim(),
    toolbarBorder: style.getPropertyValue("--sketch-toolbar-border").trim(),
    toolbarHoverBg: style.getPropertyValue("--sketch-toolbar-hover-bg").trim(),
    background: style.backgroundColor,
  };
  const key = JSON.stringify(diagnostics);
  if (key === lastEditorThemeDiagnosticKey) return;
  lastEditorThemeDiagnosticKey = key;
  console.info("[Sketch Note][Theme][Editor]", diagnostics);
}

// ─── Toolbar actions ───

function enterZenMode() {
  isZenMode.value = true;
  zenTogglePos.value = clampZenTogglePosition(zenTogglePos.value, getZenToggleBounds());
}

function exitZenMode() {
  isZenMode.value = false;
}

function onZenToggleClick() {
  if (zenToggleMoved) {
    zenToggleMoved = false;
    return;
  }
  exitZenMode();
}

function onZenToggleDragStart(e: MouseEvent | TouchEvent) {
  zenToggleDragging = true;
  zenToggleMoved = false;
  const point = getClientPoint(e);
  zenDragOffset = {
    x: point.x - zenTogglePos.value.left,
    y: point.y - zenTogglePos.value.top,
  };
  window.addEventListener("mousemove", onZenToggleDragging);
  window.addEventListener("touchmove", onZenToggleDragging, { passive: false });
  window.addEventListener("mouseup", onZenToggleDragEnd);
  window.addEventListener("touchend", onZenToggleDragEnd, { passive: true });
}

function onZenToggleDragging(e: MouseEvent | TouchEvent) {
  if (!zenToggleDragging) return;
  if (e instanceof TouchEvent) {
    e.preventDefault();
  }
  const point = getClientPoint(e);
  const nextPos = clampZenTogglePosition(
    {
      left: point.x - zenDragOffset.x,
      top: point.y - zenDragOffset.y,
    },
    getZenToggleBounds(),
  );
  if (Math.abs(nextPos.left - zenTogglePos.value.left) > 2 || Math.abs(nextPos.top - zenTogglePos.value.top) > 2) {
    zenToggleMoved = true;
  }
  zenTogglePos.value = nextPos;
}

function onZenToggleDragEnd() {
  zenToggleDragging = false;
  removeZenToggleDragListeners();
}

function removeZenToggleDragListeners() {
  window.removeEventListener("mousemove", onZenToggleDragging);
  window.removeEventListener("touchmove", onZenToggleDragging);
  window.removeEventListener("mouseup", onZenToggleDragEnd);
  window.removeEventListener("touchend", onZenToggleDragEnd);
}

function getClientPoint(e: MouseEvent | TouchEvent) {
  if (e instanceof MouseEvent) {
    return { x: e.clientX, y: e.clientY };
  }
  const touch = e.touches[0] ?? e.changedTouches[0];
  return { x: touch.clientX, y: touch.clientY };
}

function getZenToggleBounds() {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    size: 52,
    margin: 12,
  };
}

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
  // 自定义颜色选择时，只追加到当前绘制工具的颜色栏，避免画笔和荧光笔互相污染。
  if (activeTool.value === "highlighter") {
    colorPalettes.value = {
      ...colorPalettes.value,
      highlighter: appendRecentColor(colorPalettes.value.highlighter, c),
    };
  } else {
    colorPalettes.value = {
      ...colorPalettes.value,
      pen: appendRecentColor(colorPalettes.value.pen, c),
    };
  }
}

function recolorSelection(c: string) {
  canvasRef.value?.recolorLasso(c);
  colorPalettes.value = {
    ...colorPalettes.value,
    pen: addRecentColor(colorPalettes.value.pen, c),
  };
}

function deleteColor(color: string) {
  if (activeTool.value === "highlighter") {
    colorPalettes.value = {
      ...colorPalettes.value,
      highlighter: colorPalettes.value.highlighter.filter((c) => c !== color),
    };
  } else {
    colorPalettes.value = {
      ...colorPalettes.value,
      pen: colorPalettes.value.pen.filter((c) => c !== color),
    };
  }
  showMessage(t("colorDeleted") || "已删除该颜色", 3000, "info");

  if (activePreset.value.color === color) {
    const fallback = colors.value[0] ?? PRESET_COLORS[0];
    selectColor(fallback);
  }
  markDirty();
  if (autoSave.value) scheduleAutoSave();
}

function resetDefaultColors() {
  if (activeTool.value === "highlighter") {
    colorPalettes.value = {
      ...colorPalettes.value,
      highlighter: normalizeToolColorPalettes().highlighter,
    };
  } else {
    colorPalettes.value = {
      ...colorPalettes.value,
      pen: normalizeToolColorPalettes().pen,
    };
  }
  showMessage(t("colorReset") || "已恢复默认颜色设置", 3000, "info");

  selectColor(colors.value[0] ?? PRESET_COLORS[0]);
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


function toggleStylusOnly() {
  inputSettings.value = {
    ...inputSettings.value,
    stylusOnly: !inputSettings.value.stylusOnly,
  };
  persistEditorPreferences();
  markDirty();
  if (autoSave.value) scheduleAutoSave();
}

function togglePressure() {
  inputSettings.value = {
    ...inputSettings.value,
    enablePressure: inputSettings.value.enablePressure === undefined ? false : !inputSettings.value.enablePressure,
  };
  persistEditorPreferences();
  markDirty();
  if (autoSave.value) scheduleAutoSave();
}

function onTemplateChange(value: string) {
  currentTemplate.value = value;
  persistEditorPreferences();
  markDirty();
  if (autoSave.value) scheduleAutoSave();
}

function persistEditorPreferences() {
  saveEditorPreferences(props.saveData, {
    template: currentTemplate.value,
    inputSettings: inputSettings.value,
    customBackgrounds: customBackgrounds.value,
  }).catch((e) => {
    console.error("[Sketch Note] Save editor preferences failed:", e);
  });
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
  data.recentColors = colorPalettes.value.pen;
  data.highlighterRecentColors = colorPalettes.value.highlighter;
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
    await props.saveData(storageKey(props.blockId), data);
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
  data.recentColors = colorPalettes.value.pen;
  data.highlighterRecentColors = colorPalettes.value.highlighter;
  const plan = createCurrentPagePngExportPlan(props.blockId, data);
  const pngDataUrl = await renderSketchPngPageImage(data, plan, exportIncludeBackground.value);
  const blob = dataUrlToBlob(pngDataUrl);
  downloadBlob(blob, createExportPngFileName(props.blockId, new Date(), plan.pageNumber));
}

async function exportPdf() {
  if (!canvasRef.value) return;
  const data = canvasRef.value.getData();
  data.template = currentTemplate.value;
  data.recentColors = colorPalettes.value.pen;
  data.highlighterRecentColors = colorPalettes.value.highlighter;
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
  data.recentColors = colorPalettes.value.pen;
  data.highlighterRecentColors = colorPalettes.value.highlighter;
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
  persistEditorPreferences();
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
    colorPalettes.value = normalizeToolColorPalettes({
      pen: imported.recentColors,
      highlighter: imported.highlighterRecentColors,
    });
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
  persistEditorPreferences();
  await canvasRef.value.restoreData(loadedData.value);
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
  color-scheme: light dark;
  --sketch-editor-header-top: 12px;
  --sketch-editor-header-height: 92px;
  --sketch-editor-floating-gap: 16px;
  --sketch-toolbar-surface-dark: rgba(28, 28, 30, 0.88);
  --sketch-toolbar-surface-light: rgba(255, 255, 255, 0.88);
  --sketch-toolbar-surface: var(--sketch-toolbar-surface-dark);
  --sketch-toolbar-popover-surface: rgba(28, 28, 30, 0.95);
  --sketch-toolbar-border: rgba(255, 255, 255, 0.12);
  --sketch-toolbar-control-bg: rgba(255, 255, 255, 0.05);
  --sketch-toolbar-control-border: rgba(255, 255, 255, 0.08);
  --sketch-toolbar-hover-bg: rgba(255, 255, 255, 0.15);
  --sketch-toolbar-hover-border: rgba(255, 255, 255, 0.18);
  --sketch-toolbar-text: rgba(255, 255, 255, 0.8);
  --sketch-toolbar-muted-text: rgba(255, 255, 255, 0.58);
  --sketch-toolbar-strong-text: #fff;
  --sketch-toolbar-separator: rgba(255, 255, 255, 0.12);
  --sketch-toolbar-shadow: 0 10px 30px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.12);
  --sketch-toolbar-hover-shadow: 0 12px 35px rgba(0, 0, 0, 0.35), 0 4px 12px rgba(0, 0, 0, 0.15);
  --sketch-toolbar-active-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
}

.sketch-editor--theme-light {
  --sketch-toolbar-surface: var(--sketch-toolbar-surface-light);
  --sketch-toolbar-popover-surface: rgba(255, 255, 255, 0.96);
  --sketch-toolbar-border: rgba(15, 23, 42, 0.1);
  --sketch-toolbar-control-bg: rgba(15, 23, 42, 0.045);
  --sketch-toolbar-control-border: rgba(15, 23, 42, 0.08);
  --sketch-toolbar-hover-bg: rgba(15, 23, 42, 0.09);
  --sketch-toolbar-hover-border: rgba(15, 23, 42, 0.14);
  --sketch-toolbar-text: rgba(15, 23, 42, 0.78);
  --sketch-toolbar-muted-text: rgba(15, 23, 42, 0.52);
  --sketch-toolbar-strong-text: rgba(15, 23, 42, 0.94);
  --sketch-toolbar-separator: rgba(15, 23, 42, 0.1);
  --sketch-toolbar-shadow: 0 12px 32px rgba(15, 23, 42, 0.12), 0 2px 8px rgba(15, 23, 42, 0.06);
  --sketch-toolbar-hover-shadow: 0 14px 36px rgba(15, 23, 42, 0.16), 0 4px 12px rgba(15, 23, 42, 0.08);
  --sketch-toolbar-active-shadow: 0 4px 12px rgba(var(--b3-theme-primary-rgb), 0.24);
}

@media (prefers-color-scheme: light) {
  .sketch-editor {
    --sketch-toolbar-surface: var(--sketch-toolbar-surface-light);
    --sketch-toolbar-popover-surface: rgba(255, 255, 255, 0.96);
    --sketch-toolbar-border: rgba(15, 23, 42, 0.1);
    --sketch-toolbar-control-bg: rgba(15, 23, 42, 0.045);
    --sketch-toolbar-control-border: rgba(15, 23, 42, 0.08);
    --sketch-toolbar-hover-bg: rgba(15, 23, 42, 0.09);
    --sketch-toolbar-hover-border: rgba(15, 23, 42, 0.14);
    --sketch-toolbar-text: rgba(15, 23, 42, 0.78);
    --sketch-toolbar-muted-text: rgba(15, 23, 42, 0.52);
    --sketch-toolbar-strong-text: rgba(15, 23, 42, 0.94);
    --sketch-toolbar-separator: rgba(15, 23, 42, 0.1);
    --sketch-toolbar-shadow: 0 12px 32px rgba(15, 23, 42, 0.12), 0 2px 8px rgba(15, 23, 42, 0.06);
    --sketch-toolbar-hover-shadow: 0 14px 36px rgba(15, 23, 42, 0.16), 0 4px 12px rgba(15, 23, 42, 0.08);
    --sketch-toolbar-active-shadow: 0 4px 12px rgba(var(--b3-theme-primary-rgb), 0.24);
  }
}

:global(html[data-theme="light"]) .sketch-editor,
:global(html[data-theme-mode="light"]) .sketch-editor,
:global(body[data-theme="light"]) .sketch-editor {
  --sketch-toolbar-surface: var(--sketch-toolbar-surface-light);
  --sketch-toolbar-popover-surface: rgba(255, 255, 255, 0.96);
  --sketch-toolbar-border: rgba(15, 23, 42, 0.1);
  --sketch-toolbar-control-bg: rgba(15, 23, 42, 0.045);
  --sketch-toolbar-control-border: rgba(15, 23, 42, 0.08);
  --sketch-toolbar-hover-bg: rgba(15, 23, 42, 0.09);
  --sketch-toolbar-hover-border: rgba(15, 23, 42, 0.14);
  --sketch-toolbar-text: rgba(15, 23, 42, 0.78);
  --sketch-toolbar-muted-text: rgba(15, 23, 42, 0.52);
  --sketch-toolbar-strong-text: rgba(15, 23, 42, 0.94);
  --sketch-toolbar-separator: rgba(15, 23, 42, 0.1);
  --sketch-toolbar-shadow: 0 12px 32px rgba(15, 23, 42, 0.12), 0 2px 8px rgba(15, 23, 42, 0.06);
  --sketch-toolbar-hover-shadow: 0 14px 36px rgba(15, 23, 42, 0.16), 0 4px 12px rgba(15, 23, 42, 0.08);
  --sketch-toolbar-active-shadow: 0 4px 12px rgba(var(--b3-theme-primary-rgb), 0.24);
}

:global(html[data-theme="dark"]) .sketch-editor,
:global(html[data-theme-mode="dark"]) .sketch-editor,
:global(body[data-theme="dark"]) .sketch-editor {
  --sketch-toolbar-surface: var(--sketch-toolbar-surface-dark);
  --sketch-toolbar-popover-surface: rgba(28, 28, 30, 0.95);
  --sketch-toolbar-border: rgba(255, 255, 255, 0.12);
  --sketch-toolbar-control-bg: rgba(255, 255, 255, 0.05);
  --sketch-toolbar-control-border: rgba(255, 255, 255, 0.08);
  --sketch-toolbar-hover-bg: rgba(255, 255, 255, 0.15);
  --sketch-toolbar-hover-border: rgba(255, 255, 255, 0.18);
  --sketch-toolbar-text: rgba(255, 255, 255, 0.8);
  --sketch-toolbar-muted-text: rgba(255, 255, 255, 0.58);
  --sketch-toolbar-strong-text: #fff;
  --sketch-toolbar-separator: rgba(255, 255, 255, 0.12);
  --sketch-toolbar-shadow: 0 10px 30px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.12);
  --sketch-toolbar-hover-shadow: 0 12px 35px rgba(0, 0, 0, 0.35), 0 4px 12px rgba(0, 0, 0, 0.15);
  --sketch-toolbar-active-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
}

.sketch-editor--theme-dark,
:global(html[data-theme="dark"]) .sketch-editor {
  --sketch-toolbar-surface: var(--sketch-toolbar-surface-dark);
  --sketch-toolbar-popover-surface: rgba(28, 28, 30, 0.95);
  --sketch-toolbar-border: rgba(255, 255, 255, 0.12);
  --sketch-toolbar-control-bg: rgba(255, 255, 255, 0.05);
  --sketch-toolbar-control-border: rgba(255, 255, 255, 0.08);
  --sketch-toolbar-hover-bg: rgba(255, 255, 255, 0.15);
  --sketch-toolbar-hover-border: rgba(255, 255, 255, 0.18);
  --sketch-toolbar-text: rgba(255, 255, 255, 0.8);
  --sketch-toolbar-muted-text: rgba(255, 255, 255, 0.58);
  --sketch-toolbar-strong-text: #fff;
  --sketch-toolbar-separator: rgba(255, 255, 255, 0.12);
  --sketch-toolbar-shadow: 0 10px 30px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.12);
  --sketch-toolbar-hover-shadow: 0 12px 35px rgba(0, 0, 0, 0.35), 0 4px 12px rgba(0, 0, 0, 0.15);
  --sketch-toolbar-active-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
}

.sketch-editor--theme-light {
  --sketch-toolbar-surface: var(--sketch-toolbar-surface-light);
  --sketch-toolbar-popover-surface: rgba(255, 255, 255, 0.96);
  --sketch-toolbar-border: rgba(15, 23, 42, 0.1);
  --sketch-toolbar-control-bg: rgba(15, 23, 42, 0.045);
  --sketch-toolbar-control-border: rgba(15, 23, 42, 0.08);
  --sketch-toolbar-hover-bg: rgba(15, 23, 42, 0.09);
  --sketch-toolbar-hover-border: rgba(15, 23, 42, 0.14);
  --sketch-toolbar-text: rgba(15, 23, 42, 0.78);
  --sketch-toolbar-muted-text: rgba(15, 23, 42, 0.52);
  --sketch-toolbar-strong-text: rgba(15, 23, 42, 0.94);
  --sketch-toolbar-separator: rgba(15, 23, 42, 0.1);
  --sketch-toolbar-shadow: 0 12px 32px rgba(15, 23, 42, 0.12), 0 2px 8px rgba(15, 23, 42, 0.06);
  --sketch-toolbar-hover-shadow: 0 14px 36px rgba(15, 23, 42, 0.16), 0 4px 12px rgba(15, 23, 42, 0.08);
  --sketch-toolbar-active-shadow: 0 4px 12px rgba(var(--b3-theme-primary-rgb), 0.24);
}

/* ── 凌空悬浮的磨砂中控顶部卡片 ── */
.sketch-editor__header {
  position: absolute;
  top: var(--sketch-editor-header-top);
  left: 12px;
  right: 12px;
  z-index: 1000;
  background: var(--sketch-toolbar-surface);
  backdrop-filter: blur(14px) saturate(160%);
  -webkit-backdrop-filter: blur(14px) saturate(160%);
  border: 1px solid var(--sketch-toolbar-border);
  border-radius: 16px;
  box-shadow: var(--sketch-toolbar-shadow);
  padding: 6px 14px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sketch-editor__row {
  display: flex; align-items: center; gap: 8px;
  min-height: 34px;
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
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid var(--sketch-toolbar-separator);
}
.sketch-editor__title {
  font-weight: 500; font-size: 14px; color: var(--sketch-toolbar-strong-text);
  white-space: nowrap;
}
.sketch-spacer { flex: 1; }

/* ── 统一的主工具栏按钮 ── */
.sketch-btn {
  pointer-events: auto !important;
  box-sizing: border-box;
  display: inline-flex; align-items: center; justify-content: center;
  padding: 4px 10px; border-radius: 8px;
  border: 1px solid var(--sketch-toolbar-control-border) !important;
  background: var(--sketch-toolbar-control-bg) !important;
  color: var(--sketch-toolbar-text) !important;
  cursor: pointer; font-size: 13px;
  white-space: nowrap; user-select: none;
  -webkit-tap-highlight-color: transparent;
  min-height: 30px;
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.sketch-btn:hover {
  background: var(--sketch-toolbar-hover-bg) !important;
  border-color: var(--sketch-toolbar-hover-border) !important;
  color: var(--sketch-toolbar-strong-text) !important;
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
  color: var(--sketch-toolbar-strong-text) !important;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}
.sketch-btn--save:hover {
  background: var(--b3-theme-primary) !important;
  opacity: 0.92;
  box-shadow: 0 4px 16px rgba(var(--b3-theme-primary-rgb), 0.3);
}

.sketch-btn--toggle {
  color: var(--sketch-toolbar-muted-text) !important;
}
.sketch-btn--toggle-on {
  background: var(--sketch-toolbar-hover-bg) !important;
  border-color: var(--b3-theme-primary) !important;
  color: var(--sketch-toolbar-strong-text) !important;
}

/* 主绘图工具按钮（极致精炼磨砂风） */
.sketch-btn--tool {
  font-size: 13px;
  min-width: 44px;
  background: transparent !important;
  border: 1px solid transparent !important;
  color: var(--sketch-toolbar-muted-text) !important;
  border-radius: 8px;
}
.sketch-btn--tool:hover {
  background: var(--sketch-toolbar-hover-bg) !important;
  color: var(--sketch-toolbar-strong-text) !important;
  border-color: transparent !important;
}
.sketch-btn--tool-active,
.sketch-btn--tool.sketch-btn--tool-active:hover {
  background: var(--b3-theme-primary) !important;
  color: var(--sketch-toolbar-strong-text) !important;
  border-color: transparent !important;
  box-shadow: var(--sketch-toolbar-active-shadow);
}
.sketch-btn--icon-tool {
  gap: 4px;
  padding: 4px 8px;
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
  background: var(--sketch-toolbar-control-bg) !important;
  border: 1px solid var(--sketch-toolbar-control-border) !important;
  color: var(--sketch-toolbar-text) !important;
}
.sketch-btn--action:hover {
  background: var(--sketch-toolbar-hover-bg) !important;
  border-color: var(--sketch-toolbar-hover-border) !important;
  color: var(--sketch-toolbar-strong-text) !important;
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
  padding: calc(var(--sketch-editor-header-top) + var(--sketch-editor-header-height) + 12px) 0 12px 0;
  box-sizing: border-box;
  transition: padding 0.18s ease;
}
.sketch-editor__body--zen {
  padding: 0;
}

.sketch-zen-toggle {
  position: absolute;
  z-index: 1001;
  width: 52px;
  height: 52px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(28, 28, 30, 0.72);
  color: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(16px) saturate(170%);
  -webkit-backdrop-filter: blur(16px) saturate(170%);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(var(--b3-theme-primary-rgb), 0.16);
  cursor: grab;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  padding: 0;
  touch-action: none;
  transition: transform 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
}
.sketch-zen-toggle:hover {
  background: rgba(28, 28, 30, 0.86);
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.34), 0 0 0 1px rgba(var(--b3-theme-primary-rgb), 0.3);
  transform: scale(1.04);
}
.sketch-zen-toggle:active {
  cursor: grabbing;
  transform: scale(0.96);
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

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
        :hiddenTopbarKeys="hiddenTopbarKeys"
        :ocrState="ocrState"
        :pageOverview="pageOverview"
        :pageState="pageState"
        :recovered="Boolean(loadedData?.recovery?.recovered)"
        :searchResultCount="searchResults.length"
        :showReplay="replayPlaybackEnabled"
        :stylusOnly="inputSettings.stylusOnly"
        :enablePressure="inputSettings.enablePressure ?? false"
        :t="t"
        :themeMode="effectiveThemeMode"
        :templateId="currentTemplate"
        :templates="templates"
        @addPage="canvasRef?.addPage()"
        @back="goBack"
        @backgroundFitChange="onBackgroundFitChange"
        @clear="canvasRef?.doClear()"
        @clearSearch="onClearSearch"
        @deletePage="deleteCurrentPage"
        @duplicatePage="canvasRef?.duplicateCurrentPage()"
        @export="onExport"
        @exportJson="exportJson"
        @goToPage="canvasRef?.goToPage($event)"
        @insertImage="triggerImageImport"
        @importBackground="triggerBackgroundImport"
        @importJson="triggerJsonImport"
        @nextPage="canvasRef?.goToNextPage()"
        @previousPage="canvasRef?.goToPreviousPage()"
        @recognize="recognizeText"
        @replay="enterReplayMode"
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
        ref="toolbarRef"
        :activeTool="displayTool"
        :lastShapeTool="lastShapeTool"
        :penSubtype="activePenSubtype"
        :highlighterSubtype="activeHighlighterSubtype"
        :t="t"
        :replayActive="isReplayMode"
        @selectTool="selectTool"
        @selectPenSubtype="selectPenSubtype"
        @selectHighlighterSubtype="selectHighlighterSubtype"
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
    >
      <div
        v-show="!isReplayMode"
        class="sketch-live-canvas-wrap"
      >
        <SketchCanvas
          ref="canvasRef"
          :initialData="loadedData"
          :tool="activeTool"
          :toolPresets="{ ...toolPresets, text: textPreset }"
          :inputSettings="inputSettings"
          :templateId="currentTemplate"
          :lassoMode="lassoMode"
          :recorder="replayRecordingEnabled ? replayRecorder : undefined"
          @update:canUndo="canUndo = $event"
          @update:canRedo="canRedo = $event"
          @heightChanged="onHeightChanged"
          @pagesChanged="onPagesChanged"
          @stroke="onStroke"
        />
      </div>
      <div
        v-if="isReplayMode"
        ref="replayCanvasWrapRef"
        class="sketch-replay-canvas-wrap"
      >
        <canvas
          ref="replayCanvasRef"
          class="sketch-replay-canvas"
        />
      </div>
    </div>
    <ReplayControls
      v-if="isReplayMode && !props.hideReplayControls"
      :isPlaying="replayState === 'playing'"
      :current="replayCurrent"
      :total="replayTotal"
      :speed="replaySpeed"
      :canStepBack="replayCurrent > 0"
      :canStepForward="replayCurrent < replayTotal"
      :canRebirth="replayState !== 'playing' && replayCurrent > 0"
      :t="t"
      class="sketch-replay-bar"
      @togglePlay="toggleReplayPlay"
      @previous="replayPrevious"
      @next="replayNext"
      @seek="replaySeek"
      @speedChange="replaySpeedChange"
      @rebirth="replayRebirth"
      @exit="exitReplayMode"
    />
    <FloatingToolbar
      v-if="!isZenMode"
      v-model:lassoMode="lassoMode"
      :activeTool="displayTool"
      :colors="colors"
      :favoriteColors="displayFavoriteColors"
      :preset="displayPreset"
      :t="t"
      :replayActive="isReplayMode"
      :themeMode="effectiveThemeMode"
      @selectColor="onFloatingSelectColor"
      @selectCustomColor="onFloatingSelectCustomColor"
      @selectTool="selectTool($event, 'floatingToolbar')"
      @updatePreset="onFloatingUpdatePreset"
      @deleteSelection="canvasRef?.deleteLassoSelection()"
      @duplicateSelection="canvasRef?.duplicateLassoSelection()"
      @recolorSelection="recolorSelection"
      @deleteColor="deleteColor"
      @setFavoriteColor="setFavoriteColor"
      @deleteFavoriteColor="deleteFavoriteColor"
      @resetDefaultColors="resetDefaultColors"
    />
    <button
      v-if="isZenMode"
      ref="zenToggleRef"
      class="sketch-zen-toggle"
      :style="{ left: `${zenTogglePos.left}px`, top: `${zenTogglePos.top}px` }"
      :aria-label="t(zenToggleState.ariaLabelKey)"
      :aria-pressed="zenToggleState.isPressed"
      :title="t(zenToggleState.titleKey)"
      @click="onZenToggleClick"
      @mousedown="onZenToggleDragStart"
    >
      <IconParkIcon :name="zenToggleState.icon" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, watchEffect, nextTick } from "vue";
import type { SketchData, ToolPreset } from "@/types/sketch";
import { getAllTemplates, getTemplate } from "@/template";
import { showMessage } from "siyuan";
import { normalizeToolPresets, updateToolPreset, applyPenSubtypeDefaults, applyHighlighterSubtypeDefaults } from "@/tools/presets";
import type { PenSubtype, HighlighterSubtype } from "@/types/sketch";
import { importSketchJson } from "@/export/json";
import { normalizeInputSettings } from "./inputMode";
import { createCustomBackgroundTemplate, getCustomBackgroundDrawRect, getCustomBackgroundTemplate, updateCustomBackgroundFit } from "@/template/customBackground";
import type { CustomBackgroundTemplate } from "@/template/customBackground";
import type { PageOverviewItem } from "@/pages/model";
import { normalizeToolColorPalettes, normalizeToolFavoriteColors } from "@/tools/palette";
import { getFirstImageFileFromClipboard } from "./clipboard";
import { resolveEditorShortcut } from "./shortcuts";
import { getDrawingToolForEditorTool, isShapeEditorTool } from "./tools";
import type { EditorTool, ShapeEditorTool } from "./tools";
import type { OcrProvider } from "@/search/ocrProvider";
import EditorTopBar from "./EditorTopBar.vue";
import SketchCanvas from "./SketchCanvas.vue";
import ToolBar from "./ToolBar.vue";
import FloatingToolbar from "./FloatingToolbar.vue";
import IconParkIcon from "./IconParkIcon.vue";
import { ReplayRecorder } from "@/recorder/recorder";
import type { ReplayEvent, ReplayRecorderConfig, ReplayToolSource } from "@/recorder/types";
import { DEFAULT_RECORDER_CONFIG } from "@/recorder/types";
import { ReplayPlayer } from "@/recorder/player";
import type { PlaybackSpeed } from "@/recorder/player";
import { reconstructFromData } from "@/recorder/reconstruct";
import { migrateStrokesToElements, withStrokeBounds } from "@/elements/model";
import ReplayControls from "./ReplayControls.vue";

import { useThemeDetection } from "@/composables/useThemeDetection";
import { useSaveManager } from "@/composables/useSaveManager";
import { useColorPalettes } from "@/composables/useColorPalettes";
import { useOcrSearch } from "@/composables/useOcrSearch";
import { useExportManager } from "@/composables/useExportManager";
import { useEditorPreferences } from "@/composables/useEditorPreferences";
import { useZenMode } from "@/composables/useZenMode";

const props = defineProps<{
  blockId: string;
  initialData: SketchData | null;
  i18n: Record<string, string>;
  saveData: (key: string, data: any) => Promise<void>;
  ocrProvider?: OcrProvider;
  themeMode: 'light' | 'dark';
  hiddenTopbarKeys?: Set<string>;
  replayPlaybackEnabled?: boolean;
  replayRecordingEnabled?: boolean;
  replayRecordConfig?: Partial<ReplayRecorderConfig>;
  hideReplayControls?: boolean;
}>();

const emit = defineEmits<{ (e: "close"): void }>();

function t(key: string): string { return props.i18n[key] ?? key; }

// ─── Refs ───
const visible = ref(false);
const editorRootRef = ref<HTMLDivElement>();
const canvasRef = ref<InstanceType<typeof SketchCanvas>>();
const bodyRef = ref<HTMLDivElement>();
const toolbarRef = ref<InstanceType<typeof ToolBar>>();
const zenToggleRef = ref<HTMLButtonElement>();
const imageInputRef = ref<HTMLInputElement>();
const jsonInputRef = ref<HTMLInputElement>();
const backgroundInputRef = ref<HTMLInputElement>();
const activeTool = ref<EditorTool>("pen");
const nextToolSwitchSource = ref<ReplayToolSource>("mainToolbar");
let imageImportStartedAt = 0;
let imageImportSource: ReplayToolSource = "topBar";
const lassoMode = ref<"freehand" | "box">("box");
const lastShapeTool = ref<ShapeEditorTool>("line");
const toolPresets = ref(normalizeToolPresets(props.initialData?.toolPresets));
const textPreset = ref({ color: "#000000", width: 20, opacity: 1 });
const inputSettings = ref(normalizeInputSettings(props.initialData?.inputSettings));
const customBackgrounds = ref(props.initialData?.customBackgrounds ?? []);
const colorPalettes = ref(normalizeToolColorPalettes({
  pen: props.initialData?.recentColors,
  highlighter: props.initialData?.highlighterRecentColors,
}));
const favoriteColors = ref(normalizeToolFavoriteColors({
  pen: props.initialData?.favoriteColors,
  highlighter: props.initialData?.highlighterFavoriteColors,
}));
const canUndo = ref(false);
const canRedo = ref(false);
const pageState = ref({ current: 1, total: 1 });
const pageOverview = ref<PageOverviewItem[]>([]);
const currentTemplate = ref(props.initialData?.template ?? "blank");
const templates = computed(() => [...getAllTemplates(), ...customBackgrounds.value]);
const loadedData = ref<SketchData | null>(props.initialData);
const ocrIndex = ref<SketchData["ocrIndex"]>(props.initialData?.ocrIndex);

// ─── Replay ───
const isReplayMode = ref(false);
const replayRecorder = new ReplayRecorder(props.initialData?.replayEvents ?? []);
const replayPlayer = ref<InstanceType<typeof ReplayPlayer> | null>(null);
const replayCanvasWrapRef = ref<HTMLDivElement>();
const replayCanvasRef = ref<HTMLCanvasElement>();
const replayState = ref<"idle" | "playing" | "paused">("idle");
const replayCurrent = ref(0);
const replayTotal = ref(0);
const replaySpeed = ref<PlaybackSpeed>(1);
const replayDisplayTool = ref<EditorTool>("pen");
const replayDisplayPreset = ref<ToolPreset | null>(null);
let preReplayTool: EditorTool = "pen";
const replayPlaybackEnabled = computed(() => props.replayPlaybackEnabled !== false);
const replayRecordingEnabled = computed(() => props.replayRecordingEnabled === true);
const hiddenTopbarKeys = computed(() => props.hiddenTopbarKeys ?? new Set<string>());

// ─── Derived state ───
const activePreset = computed(() => {
  if (activeTool.value === "text") {
    return { tool: "text", mode: "ink", ...textPreset.value } as any;
  }
  return toolPresets.value[getDrawingToolForEditorTool(activeTool.value)];
});
const activePenSubtype = computed<PenSubtype>(
  () => toolPresets.value.pen.penSubtype ?? "ballpoint",
);
const activeHighlighterSubtype = computed<HighlighterSubtype>(
  () => toolPresets.value.highlighter.highlighterSubtype ?? "round",
);
const displayTool = computed(() => isReplayMode.value ? replayDisplayTool.value : activeTool.value);
const displayPreset = computed(() => isReplayMode.value && replayDisplayPreset.value ? replayDisplayPreset.value : activePreset.value);
const displayFavoriteColors = computed(() => {
  return displayTool.value === "highlighter" ? favoriteColors.value.highlighter : favoriteColors.value.pen;
});

// Record toolSwitch events
watch(activeTool, () => {
  if (isReplayMode.value) return;
  replayRecorder.record({
    type: "toolSwitch",
    id: `ts-${Date.now()}`,
    timestamp: Date.now(),
    tool: activeTool.value,
    preset: activePreset.value,
    source: nextToolSwitchSource.value,
  });
  nextToolSwitchSource.value = "mainToolbar";
});

const activeCustomBackground = computed(() => getCustomBackgroundTemplate({
  template: currentTemplate.value,
  customBackgrounds: customBackgrounds.value,
}));

// ─── Composables ───
const { effectiveThemeMode } = useThemeDetection({ editorRootRef, themeMode: computed(() => props.themeMode) });

const {
  saveStatus,
  autoSave,
  markDirty,
  scheduleAutoSave,
  doSave,
  manualSave,
  onStroke: saveOnStroke,
  markAndSchedule,
} = useSaveManager({
  canvasRef: canvasRef as any,
  blockId: computed(() => props.blockId),
  saveData: props.saveData,
  currentTemplate,
  toolPresets,
  inputSettings,
  customBackgrounds,
  colorPalettes,
  favoriteColors,
  ocrIndex,
  t,
  onSaved: () => syncPageOverview(),
});

const { colors, selectColor, selectCustomColor, recolorSelection, deleteColor, setFavoriteColor, deleteFavoriteColor, resetDefaultColors } = useColorPalettes({
  activeTool,
  colorPalettes,
  favoriteColors,
  activePreset: computed(() => activePreset.value),
  canvasRef: canvasRef as any,
  t,
  markAndSchedule,
  updateActivePreset,
});

const { ocrState, searchResults, recognizeText, onSearch, onSearchNext, onSearchPrev, onClearSearch } = useOcrSearch({
  canvasRef: canvasRef as any,
  ocrProvider: props.ocrProvider,
  currentTemplate,
  blockId: computed(() => props.blockId),
  ocrIndex,
  markDirty,
  scheduleAutoSave,
  autoSave,
});

const { exportIncludeBackground, exportPng, exportPdf, exportJson } = useExportManager({
  canvasRef: canvasRef as any,
  currentTemplate,
  colorPalettes,
  favoriteColors,
  toolPresets,
  inputSettings,
  customBackgrounds,
  blockId: computed(() => props.blockId),
});

const { toggleStylusOnly, togglePressure, onTemplateChange, persistEditorPreferences } = useEditorPreferences({
  inputSettings,
  currentTemplate,
  customBackgrounds,
  saveData: props.saveData,
  markAndSchedule,
});

const { isZenMode, zenTogglePos, zenToggleState, enterZenMode, onZenToggleClick, onZenToggleDragStart } = useZenMode();

// ─── Text preset persistence ───
onMounted(() => {
  try {
    const cachedText = localStorage.getItem("sketch-note-text-preset");
    if (cachedText) {
      const parsed = JSON.parse(cachedText);
      if (parsed && typeof parsed.color === "string" && typeof parsed.width === "number") {
        textPreset.value = { color: parsed.color, width: parsed.width, opacity: parsed.opacity ?? 1 };
      }
    }
  } catch (e) {
    console.error("加载文本预设失败:", e);
  }
});

// ─── Lifecycle ───
onMounted(() => {
  visible.value = true;
  document.body.style.overflow = "hidden";
  bodyRef.value?.addEventListener("wheel", onBodyWheel, { passive: false });
  window.addEventListener("paste", onPaste);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keydown", onReplayKeyDown);
});

onUnmounted(() => {
  document.body.style.overflow = "";
  bodyRef.value?.removeEventListener("wheel", onBodyWheel);
  window.removeEventListener("paste", onPaste);
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keydown", onReplayKeyDown);
});

watchEffect((onCleanup) => {
  const button = zenToggleRef.value;
  if (!button) return;
  button.addEventListener("touchstart", onZenToggleDragStart, { passive: false });
  onCleanup(() => {
    button.removeEventListener("touchstart", onZenToggleDragStart);
  });
});

// ─── Toolbar actions ───
function selectTool(tool: EditorTool, source: ReplayToolSource = "mainToolbar") {
  if (tool === "image") {
    triggerImageImport(source);
    return;
  }
  if (isShapeEditorTool(tool)) {
    lastShapeTool.value = tool;
  }
  nextToolSwitchSource.value = source;
  activeTool.value = tool;
}

function selectPenSubtype(subtype: PenSubtype) {
  toolPresets.value = applyPenSubtypeDefaults(toolPresets.value, subtype);
  if (activeTool.value !== "pen") {
    selectTool("pen", "floatingToolbar");
  }
}

function selectHighlighterSubtype(subtype: HighlighterSubtype) {
  toolPresets.value = applyHighlighterSubtypeDefaults(toolPresets.value, subtype);
  if (activeTool.value !== "highlighter") {
    selectTool("highlighter", "floatingToolbar");
  }
}

function updateActivePreset(patch: Partial<Omit<ToolPreset, "tool">>) {
  if (activeTool.value === "text") {
    textPreset.value = { ...textPreset.value, ...patch };
    try {
      localStorage.setItem("sketch-note-text-preset", JSON.stringify(textPreset.value));
    } catch (e) {
      console.error("保存文本预设失败:", e);
    }
    return;
  }
  toolPresets.value = updateToolPreset(toolPresets.value, getDrawingToolForEditorTool(activeTool.value), patch);
}

function recordFloatingToolbarAction() {
  if (isReplayMode.value) return;
  replayRecorder.record({
    type: "toolSwitch",
    id: `ft-${Date.now()}`,
    timestamp: Date.now(),
    tool: activeTool.value,
    preset: activePreset.value,
    source: "floatingToolbar",
  });
}

function onFloatingSelectColor(color: string) {
  selectColor(color);
  recordFloatingToolbarAction();
}

function onFloatingSelectCustomColor(color: string) {
  selectCustomColor(color);
  recordFloatingToolbarAction();
}

function onFloatingUpdatePreset(patch: Partial<Omit<ToolPreset, "tool">>) {
  updateActivePreset(patch);
  recordFloatingToolbarAction();
}

function onStroke() {
  syncPageOverview();
  saveOnStroke();
}

function syncPageOverview() {
  pageOverview.value = canvasRef.value?.getPageOverviewItems() ?? [];
}

function onPagesChanged(pages: { current: number; total: number }) {
  pageState.value = pages;
  syncPageOverview();
}

function deleteCurrentPage() {
  const removed = canvasRef.value?.deleteCurrentPage();
  syncPageOverview();
  if (!removed) {
    showMessage(t("deletePageFailed"), 4000, "error");
  }
}

async function onExport(format: "png" | "pdf") {
  if (format === "png") {
    await exportPng();
    return;
  }
  await exportPdf();
}

// ─── Import / Background ───
function triggerJsonImport() { jsonInputRef.value?.click(); }
function triggerBackgroundImport() { backgroundInputRef.value?.click(); }

async function onBackgroundFitChange(value: string) {
  if (!canvasRef.value || !activeCustomBackground.value) return;
  const fit = value as CustomBackgroundTemplate["fit"];
  customBackgrounds.value = updateCustomBackgroundFit(customBackgrounds.value, activeCustomBackground.value.id, fit);
  loadedData.value = {
    ...(canvasRef.value.getData()),
    template: currentTemplate.value,
    customBackgrounds: customBackgrounds.value,
  };
  persistEditorPreferences();
  await canvasRef.value.restoreData(loadedData.value);
  onStroke();
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
    favoriteColors.value = normalizeToolFavoriteColors({
      pen: imported.favoriteColors,
      highlighter: imported.highlighterFavoriteColors,
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
  customBackgrounds.value = [...customBackgrounds.value.filter((item) => item.id !== background.id), background];
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

function triggerImageImport(source: ReplayToolSource = "topBar") {
  imageImportStartedAt = Date.now();
  imageImportSource = source;
  nextToolSwitchSource.value = source;
  activeTool.value = "image";
  imageInputRef.value?.click();
}

async function onImageSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  const dataUrl = await readFileAsDataUrl(file);
  await canvasRef.value?.insertImage(dataUrl, { source: imageImportSource, loadingMs: Math.max(0, Date.now() - imageImportStartedAt) });
  onStroke();
}

async function onPaste(event: ClipboardEvent) {
  const file = event.clipboardData
    ? getFirstImageFileFromClipboard(event.clipboardData.items)
    : null;
  if (!file) return;
  event.preventDefault();
  imageImportStartedAt = Date.now();
  imageImportSource = "paste";
  nextToolSwitchSource.value = "paste";
  activeTool.value = "image";
  const dataUrl = await readFileAsDataUrl(file);
  await canvasRef.value?.insertImage(dataUrl, { source: "paste", loadingMs: Math.max(0, Date.now() - imageImportStartedAt) });
  onStroke();
}

// ─── Input handling ───
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
      if (activeTool.value === "lasso") canvasRef.value?.deleteLassoSelection();
      break;
    case "duplicateSelection":
      if (activeTool.value === "lasso") canvasRef.value?.duplicateLassoSelection();
      break;
    case "save": manualSave(); break;
    case "undo": canvasRef.value?.doUndo(); break;
    case "redo": canvasRef.value?.doRedo(); break;
    case "tool": selectTool(shortcut.tool); break;
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

// ─── Replay functions ───
function renderReplayBackground(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, data: SketchData) {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;

  const customBackground = getCustomBackgroundTemplate(data);
  if (customBackground) {
    const image = new Image();
    image.onload = () => {
      const rect = getCustomBackgroundDrawRect({
        imageWidth: image.naturalWidth,
        imageHeight: image.naturalHeight,
        targetWidth: width,
        targetHeight: height,
        fit: customBackground.fit,
      });
      ctx.drawImage(
        image,
        rect.sx,
        rect.sy,
        rect.sw,
        rect.sh,
        rect.dx,
        rect.dy,
        rect.dw,
        rect.dh,
      );
    };
    image.src = customBackground.src;
    return;
  }

  getTemplate(data.template).render(ctx, width, height);
}

function enterReplayMode() {
  const data = canvasRef.value?.getData();
  if (!data) return;
  data.template = currentTemplate.value;
  data.customBackgrounds = customBackgrounds.value;

  // Get events — use recorded events if available, otherwise reconstruct
  const sourceEvents = data.replayEvents && data.replayEvents.length > 0
    ? data.replayEvents
    : reconstructFromData(data);
  const events = filterReplayEventsForPlayback(sourceEvents, props.replayRecordConfig);

  if (events.length === 0) return;

  preReplayTool = activeTool.value;
  replayDisplayTool.value = activeTool.value;
  replayDisplayPreset.value = activePreset.value;
  replayRecorder.setSuspended(true);
  isReplayMode.value = true;
  replayTotal.value = events.length;
  replayCurrent.value = 0;
  replayState.value = "idle";
  replaySpeed.value = 1;

  // Create replay canvas after DOM update
  nextTick(() => {
    if (!replayCanvasRef.value) return;
    const canvas = replayCanvasRef.value;
    const state = canvasRef.value?.getState();
    if (state) {
      canvas.width = state.canvasWidth * (window.devicePixelRatio || 1);
      canvas.height = state.canvasHeight * (window.devicePixelRatio || 1);
      canvas.style.width = `${state.canvasWidth}px`;
      canvas.style.height = `${state.canvasHeight}px`;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
      scrollReplayCanvasToActivePage(state);
    }

    const player = new ReplayPlayer(events, canvas, {
      redrawBackground: (ctx, playbackCanvas) => renderReplayBackground(ctx, playbackCanvas, data),
    });
    player.reset();
    player.onStateChange = (s) => { replayState.value = s; };
    player.onProgress = (current, total) => {
      replayCurrent.value = current;
      replayTotal.value = total;
    };
    player.onComplete = () => {
      replayState.value = "idle";
    };
    player.onToolSwitch = (tool, source) => {
      replayDisplayTool.value = tool as EditorTool;
      const event = events[player.getCurrentIndex()];
      if (event?.type === "toolSwitch") replayDisplayPreset.value = event.preset;
      triggerToolbarClickAnimation(tool, source);
    };
    player.onImageInsert = (source) => {
      if (source === "topBar") triggerToolbarClickAnimation("image", source);
    };
    replayPlayer.value = player;
    player.play();
  });
}

function filterReplayEventsForPlayback(
  events: ReplayEvent[],
  config: Partial<ReplayRecorderConfig> = {},
): ReplayEvent[] {
  const mergedConfig = { ...DEFAULT_RECORDER_CONFIG, ...config };
  return events.filter((event) => {
    if (event.type === "imageTransform" || event.type === "imageDelete") {
      return mergedConfig.image;
    }
    return mergedConfig[event.type];
  });
}

function scrollReplayCanvasToActivePage(state: EngineState) {
  const wrap = replayCanvasWrapRef.value;
  if (!wrap) return;
  const page = state.pageMode === "paged"
    ? state.pages.find((item) => item.id === state.activePageId) ?? state.pages[0]
    : undefined;

  const left = page?.x ?? 0;
  const top = page?.y ?? 0;
  if (typeof wrap.scrollTo === "function") {
    wrap.scrollTo({ left, top, behavior: "auto" });
    return;
  }
  wrap.scrollLeft = left;
  wrap.scrollTop = top;
}

function triggerToolbarClickAnimation(tool: string, source: ReplayToolSource = "mainToolbar") {
  nextTick(() => {
    if (source === "floatingToolbar") {
      const root = editorRootRef.value;
      const targetTool = isShapeEditorTool(tool as EditorTool) ? tool : null;
      const btn = targetTool ? root?.querySelector(`.sketch-float-panel [data-tool="${targetTool}"]`) as HTMLElement | null : null;
      const target = btn ?? root?.querySelector(".sketch-float-panel") as HTMLElement | null;
      if (!target) return;
      target.classList.remove(btn ? "sketch-float-btn--replay-click" : "sketch-float-panel--replay-click");
      void target.offsetWidth; // force reflow to restart animation
      target.classList.add(btn ? "sketch-float-btn--replay-click" : "sketch-float-panel--replay-click");
      setTimeout(() => target.classList.remove(btn ? "sketch-float-btn--replay-click" : "sketch-float-panel--replay-click"), 300);
      return;
    }
    if (source === "topBar") {
      const root = editorRootRef.value;
      const btn = root?.querySelector('[data-replay-target="topbar-image"]') as HTMLElement | null;
      if (!btn) return;
      btn.classList.remove("sketch-btn--replay-click");
      void btn.offsetWidth; // force reflow to restart animation
      btn.classList.add("sketch-btn--replay-click");
      setTimeout(() => btn.classList.remove("sketch-btn--replay-click"), 300);
      return;
    }
    const toolbarEl = toolbarRef.value?.$el as HTMLElement | undefined;
    if (!toolbarEl) return;
    const targetTool = isShapeEditorTool(tool as EditorTool) ? "shape" : tool;
    const btn = toolbarEl.querySelector(`[data-tool="${targetTool}"]`) as HTMLElement | null;
    if (!btn) return;
    btn.classList.remove("sketch-btn--replay-click");
    void btn.offsetWidth; // force reflow to restart animation
    btn.classList.add("sketch-btn--replay-click");
    setTimeout(() => btn.classList.remove("sketch-btn--replay-click"), 300);
  });
}

function exitReplayMode() {
  replayPlayer.value?.destroy();
  replayPlayer.value = null;
  isReplayMode.value = false;
  replayState.value = "idle";
  replayCurrent.value = 0;
  replayDisplayPreset.value = null;
  activeTool.value = preReplayTool;
  replayRecorder.setSuspended(false);
}

function toggleReplayPlay() {
  const player = replayPlayer.value;
  if (!player) return;
  if (replayState.value === "playing") {
    player.pause();
  } else {
    player.play();
  }
}

function replayPrevious() {
  const player = replayPlayer.value;
  if (!player) return;
  player.pause();
  const prev = Math.max(0, player.getCurrentIndex() - 1);
  player.goToEvent(prev);
  replayCurrent.value = prev;
}

function replayNext() {
  const player = replayPlayer.value;
  if (!player) return;
  player.pause();
  const next = Math.min(player.getTotalEvents(), player.getCurrentIndex() + 1);
  player.goToEvent(next);
  replayCurrent.value = next;
}

function replaySeek(index: number) {
  const player = replayPlayer.value;
  if (!player) return;
  player.pause();
  player.goToEvent(index);
  replayCurrent.value = index;
}

function replaySpeedChange(speed: PlaybackSpeed) {
  replaySpeed.value = speed;
  replayPlayer.value?.setSpeed(speed);
}

function replayRebirth() {
  const player = replayPlayer.value;
  if (!player || replayState.value === "playing") return;
  const current = replayCurrent.value;
  if (current <= 0) return;
  if (!confirm(t("replayRebirthConfirm"))) return;

  const strokes = [...player.getCompletedStrokes().values()].map(withStrokeBounds);
  const textElements = [...player.getCompletedTextElements().values()];
  const imageElements = [...player.getImageStates().values()];
  const elements = [...migrateStrokesToElements(strokes), ...textElements, ...imageElements];

  const state = canvasRef.value?.getState();
  const newData: SketchData = {
    version: 1,
    template: currentTemplate.value,
    canvasWidth: state?.canvasWidth ?? 800,
    canvasHeight: state?.canvasHeight ?? 600,
    strokes,
    elements,
  };

  replayRecorder.truncateAt(current);
  exitReplayMode();
  canvasRef.value?.restoreData(newData);
}

function onReplayKeyDown(event: KeyboardEvent) {
  if (!isReplayMode.value) return;
  if (event.key === " ") {
    event.preventDefault();
    toggleReplayPlay();
  } else if (event.key === "Escape") {
    event.preventDefault();
    exitReplayMode();
  }
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
  --sketch-toolbar-active-text: #fff;
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
  --sketch-toolbar-active-text: #fff;
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
    --sketch-toolbar-active-text: #fff;
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
  --sketch-toolbar-active-text: #fff;
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
  --sketch-toolbar-active-text: #fff;
  --sketch-toolbar-separator: rgba(255, 255, 255, 0.12);
  --sketch-toolbar-shadow: 0 10px 30px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.12);
  --sketch-toolbar-hover-shadow: 0 12px 35px rgba(0, 0, 0, 0.35), 0 4px 12px rgba(0, 0, 0, 0.15);
  --sketch-toolbar-active-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
}

.sketch-editor--theme-dark {
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
  --sketch-toolbar-active-text: #fff;
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
  --sketch-toolbar-active-text: #fff;
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
  z-index: 1200;
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
  overflow: visible;
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
  color: var(--sketch-toolbar-active-text) !important;
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
  color-scheme: light dark;
  min-height: 26px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-size: 12px;
}
.sketch-mode select option {
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
}

/* ── Select ── */
.sketch-select {
  color-scheme: light dark;
  pointer-events: auto !important;
  padding: 4px 8px; border-radius: 4px;
  border: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface); color: var(--b3-theme-on-surface); font-size: 13px;
  min-height: 30px;
}
.sketch-select option {
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
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

/* ── Replay mode ── */
@keyframes sketch-replay-click {
  0% { transform: scale(1); }
  40% { transform: scale(0.85); }
  100% { transform: scale(1); }
}
.sketch-editor :deep(.sketch-btn--replay-click) {
  animation: sketch-replay-click 250ms cubic-bezier(0.25, 0.8, 0.25, 1);
}
.sketch-replay-canvas-wrap {
  width: 100%;
  height: 100%;
  overflow: auto;
  box-sizing: border-box;
}
.sketch-replay-canvas {
  display: block;
  margin: 24px auto;
  border-radius: 12px;
  border: 1px solid var(--b3-theme-border, rgba(0, 0, 0, 0.08));
}
.sketch-replay-bar {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1100;
  width: max-content;
  max-width: calc(100vw - 24px);
  box-sizing: border-box;
}
</style>

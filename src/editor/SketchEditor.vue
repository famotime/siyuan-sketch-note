<template>
  <div v-if="visible" class="sketch-editor">
    <div class="sketch-editor__header">
      <!-- Row 1: navigation -->
      <div class="sketch-editor__row">
        <button class="sketch-btn sketch-btn--back" @click="goBack">← {{ t("back") }}</button>
        <select class="sketch-select" v-model="currentTemplate">
          <option v-for="tpl in templates" :key="tpl.id" :value="tpl.id">{{ t(tpl.nameKey) }}</option>
        </select>
        <span class="sketch-editor__title">{{ t("sketchNote") }}</span>
        <span
          v-if="loadedData?.recovery?.recovered"
          class="sketch-recovery"
        >{{ t("dataRecovered") }}</span>
        <span class="sketch-spacer" />
        <button
          class="sketch-btn sketch-btn--toggle"
          :class="{ 'sketch-btn--toggle-on': autoSave }"
          @click="toggleAutoSave"
        >{{ autoSave ? "ON" : "OFF" }} {{ t("autoSave") }}</button>
        <span class="sketch-status" :class="`sketch-status--${saveStatus}`">{{ statusLabel }}</span>
        <button
          class="sketch-btn sketch-btn--save"
          :disabled="saveStatus === 'saving'"
          @click="manualSave"
        >{{ t("save") }}</button>
        <button
          class="sketch-btn sketch-btn--action"
          @click="exportPng"
        >⇩ {{ t("exportPng") }}</button>
        <button
          class="sketch-btn sketch-btn--action"
          @click="exportPdf"
        >⇩ {{ t("exportPdf") }}</button>
        <button
          class="sketch-btn sketch-btn--action"
          @click="exportJson"
        >⇩ {{ t("exportJson") }}</button>
        <button
          class="sketch-btn sketch-btn--action"
          @click="triggerJsonImport"
        >⇧ {{ t("importJson") }}</button>
        <input
          ref="jsonInputRef"
          class="sketch-file-input"
          type="file"
          accept="application/json,.json"
          @change="onJsonSelected"
        >
      </div>

      <!-- Row 2: drawing tools -->
      <div class="sketch-editor__row sketch-editor__row--tools">
        <div class="sketch-colors">
          <button
            v-for="c in colors"
            :key="c"
            class="sketch-color"
            :class="{ 'sketch-color--active': activeTool !== 'eraser' && activePreset.color === c }"
            :style="{ backgroundColor: c }"
            @click="selectColor(c)"
          />
        </div>
        <span class="sketch-sep" />
        <button
          class="sketch-btn sketch-btn--tool"
          :class="{ 'sketch-btn--tool-active': activeTool === 'pen' }"
          @click="activeTool = 'pen'"
        >✏️ {{ t("pen") }}</button>
        <button
          class="sketch-btn sketch-btn--tool"
          :class="{ 'sketch-btn--tool-active': activeTool === 'highlighter' }"
          @click="activeTool = 'highlighter'"
        >▰ {{ t("highlighter") }}</button>
        <button
          class="sketch-btn sketch-btn--tool"
          :class="{ 'sketch-btn--tool-active': activeTool === 'eraser' }"
          @click="activeTool = 'eraser'"
        >🧹 {{ t("eraser") }}</button>
        <button
          class="sketch-btn sketch-btn--tool"
          :class="{ 'sketch-btn--tool-active': activeTool === 'lasso' }"
          @click="activeTool = 'lasso'"
        >◇ {{ t("lasso") }}</button>
        <button
          class="sketch-btn sketch-btn--tool"
          :class="{ 'sketch-btn--tool-active': activeTool === 'line' }"
          @click="activeTool = 'line'"
        >／ {{ t("line") }}</button>
        <button
          class="sketch-btn sketch-btn--tool"
          :class="{ 'sketch-btn--tool-active': activeTool === 'rectangle' }"
          @click="activeTool = 'rectangle'"
        >□ {{ t("rectangle") }}</button>
        <button
          class="sketch-btn sketch-btn--tool"
          :class="{ 'sketch-btn--tool-active': activeTool === 'ellipse' }"
          @click="activeTool = 'ellipse'"
        >○ {{ t("ellipse") }}</button>
        <button
          class="sketch-btn sketch-btn--tool"
          :class="{ 'sketch-btn--tool-active': activeTool === 'ruler' }"
          @click="activeTool = 'ruler'"
        >▤ {{ t("ruler") }}</button>
        <button
          class="sketch-btn sketch-btn--action"
          :disabled="activeTool !== 'ruler'"
          @click="canvasRef?.rotateRulerBy(-45)"
        >↺ {{ t("rotateLeft") }}</button>
        <button
          class="sketch-btn sketch-btn--action"
          :disabled="activeTool !== 'ruler'"
          @click="canvasRef?.rotateRulerBy(45)"
        >↻ {{ t("rotateRight") }}</button>
        <button
          class="sketch-btn sketch-btn--tool"
          :class="{ 'sketch-btn--tool-active': activeTool === 'text' }"
          @click="insertTextElement"
        >T {{ t("text") }}</button>
        <button
          class="sketch-btn sketch-btn--tool"
          :class="{ 'sketch-btn--tool-active': activeTool === 'image' }"
          @click="triggerImageImport"
        >▧ {{ t("image") }}</button>
        <input
          ref="imageInputRef"
          class="sketch-file-input"
          type="file"
          accept="image/*"
          @change="onImageSelected"
        >
        <div class="sketch-tool-options">
          <label class="sketch-range">
            <span>{{ t("width") }}</span>
            <input
              v-model.number="activePreset.width"
              type="range"
              min="1"
              max="30"
              @input="updateActivePreset({ width: activePreset.width })"
            >
            <output>{{ activePreset.width }}</output>
          </label>
          <label v-if="activeTool !== 'eraser'" class="sketch-range">
            <span>{{ t("opacity") }}</span>
            <input
              v-model.number="activePreset.opacity"
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              @input="updateActivePreset({ opacity: activePreset.opacity })"
            >
            <output>{{ Math.round(activePreset.opacity * 100) }}%</output>
          </label>
        </div>
        <span class="sketch-sep" />
        <button
          class="sketch-btn sketch-btn--action"
          :disabled="activeTool !== 'lasso'"
          @click="canvasRef?.recolorLasso(activePreset.color)"
        >🎨 {{ t("recolor") }}</button>
        <button
          class="sketch-btn sketch-btn--action"
          :disabled="activeTool !== 'lasso'"
          @click="canvasRef?.deleteLassoSelection()"
        >⌫ {{ t("deleteSelection") }}</button>
        <span class="sketch-sep" />
        <button class="sketch-btn sketch-btn--action" :disabled="!canUndo" @click="canvasRef?.doUndo()">↩️ {{ t("undo") }}</button>
        <button class="sketch-btn sketch-btn--action" :disabled="!canRedo" @click="canvasRef?.doRedo()">↪️ {{ t("redo") }}</button>
        <button class="sketch-btn sketch-btn--action" @click="canvasRef?.doClear()">🗑️ {{ t("clear") }}</button>
      </div>
    </div>

    <div class="sketch-editor__body">
      <SketchCanvas
        ref="canvasRef"
        :initialData="loadedData"
        :tool="activeTool"
        :toolPresets="toolPresets"
        :templateId="currentTemplate"
        @update:canUndo="canUndo = $event"
        @update:canRedo="canRedo = $event"
        @heightChanged="onHeightChanged"
        @stroke="onStroke"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import type { SketchData, ToolPreset } from "@/types/sketch";
import { PRESET_COLORS } from "@/types/sketch";
import { getAllTemplates } from "@/template";
import { renderSketchPdfPageImages, thumbnailSketchDataAsync } from "@/storage/thumbnail";
import { showMessage } from "siyuan";
import { sketchAssetFileName, uploadDataUrlToAssets } from "@/utils/uploadPng";
import { normalizeToolPresets, updateToolPreset } from "@/tools/presets";
import { createExportPngFileName, dataUrlToBlob, downloadBlob } from "@/export/png";
import { createExportPdfFileName, createPdfExportPlanFromSketch, exportPdf as exportPdfBlob } from "@/export/pdf";
import { createExportJsonFileName, exportSketchJson, importSketchJson } from "@/export/json";
import { SaveQueue } from "@/storage/saveQueue";
import { getFirstImageFileFromClipboard } from "./clipboard";
import { getDrawingToolForEditorTool } from "./tools";
import type { EditorTool } from "./tools";
import SketchCanvas from "./SketchCanvas.vue";

type SaveStatus = "idle" | "saving" | "saved" | "error" | "dirty";

const props = defineProps<{
  blockId: string;
  initialData: SketchData | null;
  i18n: Record<string, string>;
  saveData: (key: string, data: any) => Promise<void>;
}>();

const emit = defineEmits<{ (e: "close"): void }>();

function t(key: string): string { return props.i18n[key] ?? key; }

const colors = PRESET_COLORS;
const visible = ref(false);
const canvasRef = ref<InstanceType<typeof SketchCanvas>>();
const imageInputRef = ref<HTMLInputElement>();
const jsonInputRef = ref<HTMLInputElement>();
const activeTool = ref<EditorTool>("pen");
const activeColor = ref(PRESET_COLORS[0]);
const toolPresets = ref(normalizeToolPresets(props.initialData?.toolPresets));
const canUndo = ref(false);
const canRedo = ref(false);
const currentTemplate = ref(props.initialData?.template ?? "blank");
const templates = getAllTemplates();
const loadedData = ref<SketchData | null>(props.initialData);
const saveStatus = ref<SaveStatus>("idle");
const autoSave = ref(true);

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
const saveQueue = new SaveQueue();

const statusLabel = computed(() => {
  switch (saveStatus.value) {
    case "saving":  return t("statusSaving");
    case "saved":   return t("statusSaved");
    case "error":   return t("statusError");
    case "dirty":   return t("statusDirty");
    default:        return "";
  }
});

const activePreset = computed(() => toolPresets.value[getDrawingToolForEditorTool(activeTool.value)]);

onMounted(() => {
  visible.value = true;
  document.body.style.overflow = "hidden";
  window.addEventListener("paste", onPaste);
});

onUnmounted(() => {
  document.body.style.overflow = "";
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  window.removeEventListener("paste", onPaste);
});

// ─── Toolbar actions ───

function selectColor(c: string) {
  activeColor.value = c;
  if (activeTool.value === "eraser") {
    activeTool.value = "pen";
  }
  updateActivePreset({ color: c });
}

function updateActivePreset(patch: Partial<Omit<ToolPreset, "tool">>) {
  toolPresets.value = updateToolPreset(toolPresets.value, getDrawingToolForEditorTool(activeTool.value), patch);
}

function toggleAutoSave() {
  autoSave.value = !autoSave.value;
  if (!autoSave.value && autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
}

// ─── Save logic ───

function markDirty() {
  if (saveStatus.value === "saved" || saveStatus.value === "idle") {
    saveStatus.value = "dirty";
  }
}

function onStroke() {
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

async function exportPng() {
  if (!canvasRef.value) return;
  const data = canvasRef.value.getData();
  data.template = currentTemplate.value;
  const pngDataUrl = await thumbnailSketchDataAsync(data);
  const blob = dataUrlToBlob(pngDataUrl);
  downloadBlob(blob, createExportPngFileName(props.blockId));
}

async function exportPdf() {
  if (!canvasRef.value) return;
  const data = canvasRef.value.getData();
  data.template = currentTemplate.value;
  const plan = createPdfExportPlanFromSketch(props.blockId, data);
  const pageImages = await renderSketchPdfPageImages(data, plan);
  const blob = await exportPdfBlob(plan, { pageImages });
  downloadBlob(blob, createExportPdfFileName(props.blockId));
}

function exportJson() {
  if (!canvasRef.value) return;
  const data = canvasRef.value.getData();
  data.template = currentTemplate.value;
  data.toolPresets = toolPresets.value;
  const blob = exportSketchJson(data);
  downloadBlob(blob, createExportJsonFileName(props.blockId));
}

function triggerJsonImport() {
  jsonInputRef.value?.click();
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
    loadedData.value = imported;
    await canvasRef.value.restoreData(imported);
    onStroke();
  } catch (error) {
    console.error("[Sketch Note] JSON restore failed:", error);
    showMessage(t("importJsonFailed"), 5000, "error");
  }
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
    await doSave();
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
  display: flex; flex-direction: column;
}

/* ── Header ── */
.sketch-editor__header {
  background: var(--b3-theme-surface);
  border-bottom: 1px solid var(--b3-border-color);
  flex-shrink: 0;
  padding: 6px 12px;
}
.sketch-editor__row {
  display: flex; align-items: center; gap: 8px;
  min-height: 36px;
}
.sketch-editor__row--tools {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--b3-border-color);
}
.sketch-editor__title {
  font-weight: 500; font-size: 14px; color: var(--b3-theme-on-surface);
  white-space: nowrap;
}
.sketch-spacer { flex: 1; }

/* ── Shared button base ── */
.sketch-btn {
  pointer-events: auto !important;
  box-sizing: border-box;
  display: inline-flex; align-items: center; justify-content: center;
  padding: 5px 10px; border-radius: 6px;
  border: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface) !important;
  color: var(--b3-theme-on-surface);
  cursor: pointer; font-size: 13px;
  white-space: nowrap; user-select: none;
  -webkit-tap-highlight-color: transparent;
  min-height: 30px;
}
.sketch-btn:active { opacity: 0.8; }
.sketch-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.sketch-btn--back   { font-size: 13px; }
.sketch-btn--save   { background: var(--b3-theme-primary) !important; color: var(--b3-theme-on-primary); border-color: var(--b3-theme-primary); }

.sketch-btn--toggle { font-size: 12px; }
.sketch-btn--toggle-on { border-color: var(--b3-theme-primary); color: var(--b3-theme-primary); }

.sketch-btn--tool { font-size: 13px; min-width: 60px; }
.sketch-btn--tool-active { background: var(--b3-theme-primary-light) !important; border-color: var(--b3-theme-primary); }

.sketch-btn--action { font-size: 13px; min-width: 52px; }

.sketch-tool-options {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
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

/* ── Body ── */
.sketch-editor__body {
  flex: 1; overflow-y: auto; touch-action: none;
  padding: 12px 0;
}
</style>

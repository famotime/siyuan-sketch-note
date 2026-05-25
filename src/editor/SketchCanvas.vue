<template>
  <div
    class="sketch-canvas-container"
    ref="containerRef"
    :style="{ transform: `translate(${viewportPanX}px, ${viewportPanY}px) scale(${viewportScale})`, transformOrigin: '0 0' }"
  >
    <canvas ref="bgCanvasRef" class="sketch-canvas sketch-canvas--bg" />
    <canvas
      ref="strokeCanvasRef"
      class="sketch-canvas sketch-canvas--stroke"
      @contextmenu.prevent
      @dblclick="onCanvasDoubleClick"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onPointerUp"
    />

    <!-- 动态原位精致文本编辑器 -->
    <div
      v-if="textEditor.show"
      class="sketch-text-editor-overlay"
      :style="{ left: `${textEditor.x}px`, top: `${textEditor.y}px` }"
    >
      <input
        ref="textEditorInputRef"
        v-model="textEditor.val"
        class="sketch-text-editor-input"
        type="text"
        :style="{
          fontSize: `${props.toolPresets.text?.width ?? 20}px`,
          color: props.toolPresets.text?.color ?? '#000000',
        }"
        @keydown.enter="finishTextEditing"
        @keydown.esc="cancelTextEditing"
        @blur="finishTextEditing"
      >
    </div>
  </div>
  <Transition name="zoom-fade">
    <div v-if="showIndicator || zoomLocked" class="zoom-indicator" @pointerdown.stop>
      <span class="zoom-indicator__value">{{ Math.round(viewportScale * 100) }}%</span>
      <button class="zoom-indicator__lock" @click="toggleZoomLock">{{ zoomLocked ? '🔒' : '🔓' }}</button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import type { SketchData, Stroke, StrokePoint, ToolPresetCollection, SketchTool } from "@/types/sketch";
import {
  createEngineState,
  restoreEngineState,
  setupBackgroundCanvas,
  setupStrokeCanvas,
  handlePointerDown as enginePointerDown,
  handlePointerMove as enginePointerMove,
  handlePointerUp as enginePointerUp,
  cancelCurrentStroke,
  undo as engineUndo,
  redo as engineRedo,
  clearAll as engineClear,
  fullRedrawStrokeCanvas,
  resizeCanvases,
  serializeState,
  preloadElementImages,
  preloadImage,
  pushHistorySnapshot,
} from "@/engine/canvasEngine";
import type { EngineState } from "@/engine/canvasEngine";
import {
  createArrowStroke,
  createEllipseStroke,
  createLineStroke,
  createRectangleStroke,
  createTriangleStroke,
} from "@/elements/shapes";
import { createImageElement } from "@/elements/image";
import {
  createTextElement,
  updateTextElement,
} from "@/elements/text";
import {
  hitTestElement,
  isInResizeCorner,
  moveElement,
  resizeElementFromCorner,
} from "@/elements/transform";
import {
  findElementsInBoxSelection,
  findElementsInLasso,
} from "@/elements/lasso";
import type { Point as LassoPoint } from "@/elements/lasso";
import {
  duplicateLassoSelection as duplicateLassoElements,
  duplicateStrokeSelection,
  recolorLassoSelection,
  recolorStrokeSelection,
  removeLassoSelection,
  removeStrokeSelection,
  resizeLassoSelection,
  resizeStrokeSelection,
  translateStrokeSelection,
  translateLassoSelection,
} from "@/elements/lassoEdit";
import type { Bounds, SketchElement } from "@/elements/model";
import { migrateStrokesToElements } from "@/elements/model";
import {
  addSketchPage,
  createPageNavigator,
  createPageOverviewItems,
  duplicateSketchPage,
  getSketchPages,
  removeSketchPage,
} from "@/pages/model";
import { shouldDrawFromPointer } from "./inputMode";
import { createCanvasPointConverter } from "./viewport";
import type { SketchInputSettings } from "./inputMode";
import { createInsertElementPosition } from "./insertPosition";
import type { OcrSearchResult } from "@/search/ocrIndex";
import { isShapeEditorTool } from "./tools";
import type { EditorTool } from "./tools";

const props = defineProps<{
  initialData: SketchData | null;
  tool: EditorTool;
  toolPresets: ToolPresetCollection;
  inputSettings: SketchInputSettings;
  templateId: string;
  lassoMode: "freehand" | "box";
}>();

const emit = defineEmits<{
  (e: "update:canUndo", value: boolean): void;
  (e: "update:canRedo", value: boolean): void;
  (e: "heightChanged", height: number): void;
  (e: "pagesChanged", pages: { current: number; total: number }): void;
  (e: "stroke"): void;
}>();

const textEditor = ref({
  show: false,
  x: 0,
  y: 0,
  val: "",
  elementId: null as string | null,
});
const textEditorInputRef = ref<HTMLInputElement>();

const containerRef = ref<HTMLDivElement>();
const bgCanvasRef = ref<HTMLCanvasElement>();
const strokeCanvasRef = ref<HTMLCanvasElement>();

// ── Viewport zoom/pan state ──
const viewportScale = ref(1);
const viewportPanX = ref(0);
const viewportPanY = ref(0);
const showIndicator = ref(false);
const zoomLocked = ref(loadZoomLock());
let indicatorHideTimer: ReturnType<typeof setTimeout> | null = null;

// ── Two-finger gesture tracking ──
const pointers = new Map<number, { x: number; y: number; type: string }>();
let pinchStartDist = 0;
let pinchStartScale = 1;
let pinchStartMidX = 0;
let pinchStartMidY = 0;
let pinchStartPanX = 0;
let pinchStartPanY = 0;
let twoFingerActive = false;
let postPinchGuard = 0;
let pinchPrevMidX = 0;
let pinchPrevMidY = 0;

// ── Right-click pan tracking ──
let rightPanActive = false;
let rightPanLastX = 0;
let rightPanLastY = 0;

let state: EngineState;
let shapeStart: StrokePoint | null = null;
let imageTransform: {
  elementId: string;
  lastPoint: StrokePoint;
  mode: "move" | "resize";
} | null = null;
let elementTransform: {
  elementId: string;
  lastPoint: StrokePoint;
  mode: "move" | "resize";
} | null = null;
let selectedElementId: string | null = null;
let lassoPath: LassoPoint[] = [];
let selectedLassoIds: string[] = [];
let lassoBox: {
  start: LassoPoint;
  current: LassoPoint;
} | null = null;
let lassoMove: {
  lastPoint: StrokePoint;
} | null = null;
let lassoResize: {
  anchor: { x: number; y: number };
  initialBounds: Bounds;
  elements: SketchElement[];
  strokes: SketchData["strokes"];
} | null = null;
const LASSO_DUPLICATE_OFFSET = 24;
const LASSO_RESIZE_HANDLE_SIZE = 14;
const LASSO_MIN_RESIZE_SIZE = 16;

onMounted(async () => {
  if (!bgCanvasRef.value || !strokeCanvasRef.value) return;
  state = props.initialData
    ? restoreEngineState(props.initialData)
    : createEngineState("blank");
  await preloadElementImages(state.elements);
  setupBackgroundCanvas(bgCanvasRef.value, state);
  setupStrokeCanvas(strokeCanvasRef.value, state);
  updateUndoRedoState();
  emitPageState();
});

watch(
  [() => props.tool, () => props.toolPresets.eraser.width],
  ([newTool, newWidth]) => {
    updateCanvasCursor(newTool, newWidth);
  },
  { immediate: true }
);

function updateCanvasCursor(tool: string, eraserWidth: number) {
  const canvas = strokeCanvasRef.value;
  if (!canvas) return;

  if (tool === "eraser") {
    const w = Math.max(16, eraserWidth);
    const r = eraserWidth / 2;
    const center = w / 2;
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${w}" viewBox="0 0 ${w} ${w}">
        <circle cx="${center}" cy="${center}" r="${r - 1}" stroke="rgba(255, 255, 255, 0.8)" stroke-width="1.5" fill="none"/>
        <circle cx="${center}" cy="${center}" r="${r}" stroke="rgba(223, 76, 60, 0.9)" stroke-width="1" fill="rgba(223, 76, 60, 0.15)"/>
      </svg>
    `.trim().replace(/\s+/g, " ");

    const encodedSvg = encodeURIComponent(svg);
    const dataUrl = `data:image/svg+xml;utf8,${encodedSvg}`;
    canvas.style.cursor = `url("${dataUrl}") ${center} ${center}, auto`;
  } else {
    canvas.style.cursor = "crosshair";
  }
}

function getEngineTool(tool: EditorTool): SketchTool {
  if (tool === "eraser") return "eraser";
  if (tool === "highlighter") return "highlighter";
  return "pen";
}

watch(() => props.tool, (t) => {
  if (state) state.tool = getEngineTool(t);
});
watch(() => props.toolPresets, (presets) => {
  if (state) state.toolPresets = presets;
}, { deep: true });
watch(() => props.inputSettings?.enablePressure, (val) => {
  if (state) state.enablePressure = val ?? true;
}, { immediate: true });
watch(() => props.templateId, (tpl) => {
  if (state && bgCanvasRef.value && strokeCanvasRef.value) {
    state.templateId = tpl;
    setupBackgroundCanvas(bgCanvasRef.value, state);
    setupStrokeCanvas(strokeCanvasRef.value, state);
  }
});

function getCanvas(): HTMLCanvasElement { return strokeCanvasRef.value!; }

// ── Zoom/pan helpers ──
const ZOOM_LOCK_KEY = "sketch-note-zoom-lock";
function loadZoomLock(): boolean {
  try { return localStorage.getItem(ZOOM_LOCK_KEY) === "true"; }
  catch { return false; }
}
function saveZoomLock(locked: boolean) {
  try { localStorage.setItem(ZOOM_LOCK_KEY, String(locked)); }
  catch { /* ignore */ }
}
function showZoomIndicator() {
  showIndicator.value = true;
  if (indicatorHideTimer) { clearTimeout(indicatorHideTimer); indicatorHideTimer = null; }
}
function scheduleHideZoomIndicator() {
  if (zoomLocked.value) return;
  if (indicatorHideTimer) clearTimeout(indicatorHideTimer);
  indicatorHideTimer = setTimeout(() => { showIndicator.value = false; }, 1500);
}
function toggleZoomLock() {
  zoomLocked.value = !zoomLocked.value;
  saveZoomLock(zoomLocked.value);
  if (zoomLocked.value) {
    showZoomIndicator();
    if (indicatorHideTimer) { clearTimeout(indicatorHideTimer); indicatorHideTimer = null; }
  } else {
    scheduleHideZoomIndicator();
  }
}
function resetViewport() {
  viewportScale.value = 1;
  viewportPanX.value = 0;
  viewportPanY.value = 0;
}
function handleWheelZoom(e: WheelEvent) {
  if (zoomLocked.value) return;
  const rect = containerRef.value!.getBoundingClientRect();
  const cursorScreenX = e.clientX - rect.left;
  const cursorScreenY = e.clientY - rect.top;
  const canvasX = cursorScreenX / viewportScale.value;
  const canvasY = cursorScreenY / viewportScale.value;
  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
  const newScale = Math.min(5, Math.max(1, viewportScale.value * zoomFactor));
  viewportScale.value = newScale;
  viewportPanX.value = cursorScreenX - canvasX * newScale;
  viewportPanY.value = cursorScreenY - canvasY * newScale;
  showZoomIndicator();
  scheduleHideZoomIndicator();
}

function canvasPoint(e: PointerEvent) {
  const rect = getCanvas().getBoundingClientRect();
  return createCanvasPointConverter(() => ({
    left: rect.left,
    top: rect.top,
    scale: viewportScale.value,
  }))(e);
}

function eventPoint(e: PointerEvent): StrokePoint {
  const point = canvasPoint(e);
  return {
    x: point.x,
    y: point.y,
    pressure: e.pressure || 0.5,
    timestamp: e.timeStamp,
  };
}

function onPointerDown(e: PointerEvent) {
  e.preventDefault();

  // Track all active pointers for two-finger detection
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });

  // Two-finger gesture detection
  if (pointers.size >= 2 && !twoFingerActive) {
    // In stylusOnly mode, don't interrupt pen strokes with finger touches
    if (props.inputSettings.stylusOnly) {
      const hasPen = Array.from(pointers.values()).some(p => p.type === "pen");
      if (hasPen) { return; }
    }
    twoFingerActive = true;
    if (cancelCurrentStroke(state)) {
      fullRedrawStrokeCanvas(getCanvas(), state);
    }
    const pts = Array.from(pointers.values());
    pinchStartDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    pinchStartScale = viewportScale.value;
    pinchStartMidX = (pts[0].x + pts[1].x) / 2;
    pinchStartMidY = (pts[0].y + pts[1].y) / 2;
    pinchStartPanX = viewportPanX.value;
    pinchStartPanY = viewportPanY.value;
    pinchPrevMidX = pinchStartMidX;
    pinchPrevMidY = pinchStartMidY;
    return;
  }
  if (twoFingerActive) return;

  // Right-click pan (desktop)
  if (e.button === 2) {
    rightPanActive = true;
    rightPanLastX = e.clientX;
    rightPanLastY = e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    return;
  }

  // Guard against drawing immediately after a pinch ends
  if (Date.now() < postPinchGuard) return;

  if (!shouldDrawFromPointer(e, props.inputSettings)) return;
  (e.target as HTMLElement).setPointerCapture(e.pointerId);

  if (props.tool === "text") {
    if (textEditor.value.show) {
      finishTextEditing();
    } else {
      const point = eventPoint(e);
      const hit = hitTestElement(
        state.elements.filter((item) => item.type === "text"),
        point.x,
        point.y,
      );
      if (!hit) {
        startNewTextEditing(point.x, point.y);
      }
    }
    return;
  }

  if (props.tool === "lasso") {
    const point = eventPoint(e);
    const selectionBounds = getLassoSelectionBounds();
    if (selectionBounds && isPointInLassoResizeHandle(selectionBounds, point)) {
      lassoResize = {
        anchor: {
          x: selectionBounds.x,
          y: selectionBounds.y,
        },
        initialBounds: selectionBounds,
        elements: state.elements,
        strokes: state.strokes,
      };
      pushHistorySnapshot(state);
      return;
    }
    const selectedElement = hitTestElement(
      getSelectableElements().filter((element) => selectedLassoIds.includes(element.id)),
      point.x,
      point.y,
    );
    if (selectedElement) {
      lassoMove = { lastPoint: point };
      pushHistorySnapshot(state);
      return;
    }
    if (props.lassoMode === "box") {
      lassoBox = {
        start: point,
        current: point,
      };
    } else {
      lassoPath = [point];
    }
    selectedLassoIds = [];
    fullRedrawStrokeCanvas(getCanvas(), state);
    if (props.lassoMode === "box") {
      drawLassoBox();
    } else {
      drawLassoPath();
    }
    return;
  }
  if (props.tool === "image") {
    const point = eventPoint(e);
    const element = hitTestElement(
      state.elements.filter((item) => item.type === "image"),
      point.x,
      point.y,
    );
    selectedElementId = element?.id ?? null;
    if (element) {
      imageTransform = {
        elementId: element.id,
        lastPoint: point,
        mode: isInResizeCorner(element, point.x, point.y) ? "resize" : "move",
      };
      pushHistorySnapshot(state);
    }
    fullRedrawStrokeCanvas(getCanvas(), state);
    drawSelectionOutline();
    return;
  }
  if (props.tool === "text") {
    const point = eventPoint(e);
    const element = hitTestElement(
      state.elements.filter((item) => item.type === "text"),
      point.x,
      point.y,
    );
    selectedElementId = element?.id ?? null;
    if (element) {
      elementTransform = {
        elementId: element.id,
        lastPoint: point,
        mode: isInResizeCorner(element, point.x, point.y) ? "resize" : "move",
      };
      pushHistorySnapshot(state);
    }
    fullRedrawStrokeCanvas(getCanvas(), state);
    drawSelectionOutline();
    return;
  }
  if (isShapeEditorTool(props.tool)) {
    shapeStart = eventPoint(e);
    return;
  }
  const point = eventPoint(e);
  enginePointerDown(state, { ...point, canvasX: point.x, canvasY: point.y }, getCanvas());
}

function onPointerMove(e: PointerEvent) {
  e.preventDefault();

  // Update tracked pointer position
  if (pointers.has(e.pointerId)) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
  }

  // Two-finger pinch/pan
  if (twoFingerActive && pointers.size >= 2) {
    const pts = Array.from(pointers.values());
    const newDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    const midX = (pts[0].x + pts[1].x) / 2;
    const midY = (pts[0].y + pts[1].y) / 2;
    if (zoomLocked.value) {
      // Locked: only pan, no zoom
      viewportPanX.value += midX - pinchPrevMidX;
      viewportPanY.value += midY - pinchPrevMidY;
    } else {
      // Unlocked: zoom + pan
      const rawScale = pinchStartScale * (newDist / pinchStartDist);
      const newScale = Math.min(5, Math.max(1, rawScale));
      viewportScale.value = newScale;
      viewportPanX.value = midX - (pinchStartMidX - pinchStartPanX) * (newScale / pinchStartScale);
      viewportPanY.value = midY - (pinchStartMidY - pinchStartPanY) * (newScale / pinchStartScale);
    }
    pinchPrevMidX = midX;
    pinchPrevMidY = midY;
    showZoomIndicator();
    return;
  }
  if (twoFingerActive) return;

  // Right-click pan
  if (rightPanActive) {
    viewportPanX.value += e.clientX - rightPanLastX;
    viewportPanY.value += e.clientY - rightPanLastY;
    rightPanLastX = e.clientX;
    rightPanLastY = e.clientY;
    showZoomIndicator();
    return;
  }
  if (props.tool === "lasso") {
    const point = eventPoint(e);
    if (lassoResize) {
      const width = Math.max(LASSO_MIN_RESIZE_SIZE, point.x - lassoResize.anchor.x);
      const height = Math.max(LASSO_MIN_RESIZE_SIZE, point.y - lassoResize.anchor.y);
      const scaleX = width / Math.max(1, lassoResize.initialBounds.width);
      const scaleY = height / Math.max(1, lassoResize.initialBounds.height);
      state.elements = resizeLassoSelection(
        lassoResize.elements,
        selectedLassoIds,
        lassoResize.anchor,
        scaleX,
        scaleY,
      );
      state.strokes = resizeStrokeSelection(
        lassoResize.strokes,
        selectedLassoIds,
        lassoResize.anchor,
        scaleX,
        scaleY,
      );
      state.isDirty = true;
      fullRedrawStrokeCanvas(getCanvas(), state);
      drawLassoSelectionOutline();
      return;
    }
    if (lassoMove) {
      const dx = point.x - lassoMove.lastPoint.x;
      const dy = point.y - lassoMove.lastPoint.y;
      state.elements = translateLassoSelection(state.elements, selectedLassoIds, dx, dy);
      state.strokes = translateStrokeSelection(state.strokes, selectedLassoIds, dx, dy);
      lassoMove.lastPoint = point;
      state.isDirty = true;
      fullRedrawStrokeCanvas(getCanvas(), state);
      drawLassoSelectionOutline();
      return;
    }
    if (lassoPath.length > 0) {
      lassoPath.push(point);
      fullRedrawStrokeCanvas(getCanvas(), state);
      drawLassoPath();
      return;
    }
    if (lassoBox) {
      lassoBox.current = point;
      fullRedrawStrokeCanvas(getCanvas(), state);
      drawLassoBox();
      return;
    }
  }
  if (imageTransform) {
    const point = eventPoint(e);
    const dx = point.x - imageTransform.lastPoint.x;
    const dy = point.y - imageTransform.lastPoint.y;
    state.elements = state.elements.map((element) => {
      if (element.id !== imageTransform?.elementId) return element;
      return imageTransform.mode === "move"
        ? moveElement(element, dx, dy)
        : resizeElementFromCorner(element, "se", dx, dy);
    });
    imageTransform.lastPoint = point;
    state.isDirty = true;
    fullRedrawStrokeCanvas(getCanvas(), state);
    drawSelectionOutline();
    return;
  }
  if (elementTransform) {
    const point = eventPoint(e);
    const dx = point.x - elementTransform.lastPoint.x;
    const dy = point.y - elementTransform.lastPoint.y;
    state.elements = state.elements.map((element) => {
      if (element.id !== elementTransform?.elementId) return element;
      return elementTransform.mode === "move"
        ? moveElement(element, dx, dy)
        : resizeElementFromCorner(element, "se", dx, dy);
    });
    elementTransform.lastPoint = point;
    state.isDirty = true;
    fullRedrawStrokeCanvas(getCanvas(), state);
    drawSelectionOutline();
    return;
  }
  if (shapeStart && isShapeEditorTool(props.tool)) {
    const point = eventPoint(e);
    fullRedrawStrokeCanvas(getCanvas(), state);
    const ctx = getCanvas().getContext("2d")!;
    ctx.save();
    const preset = props.toolPresets.pen;
    ctx.strokeStyle = preset.color;
    ctx.lineWidth = preset.width;
    ctx.globalAlpha = preset.opacity ?? 1;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    drawShapePreview(ctx, props.tool, shapeStart, point);
    ctx.restore();
    return;
  }
  if (shapeStart) return;
  const point = eventPoint(e);
  const heightChanged = enginePointerMove(state, { ...point, canvasX: point.x, canvasY: point.y }, getCanvas());
  if (heightChanged) {
    resizeCanvases(bgCanvasRef.value!, strokeCanvasRef.value!, state);
    emit("heightChanged", state.canvasHeight);
    emitPageState();
  }
}

function onPointerUp(e: PointerEvent) {
  pointers.delete(e.pointerId);

  // End two-finger gesture
  if (twoFingerActive) {
    if (pointers.size < 2) {
      twoFingerActive = false;
      postPinchGuard = Date.now() + 300;
      scheduleHideZoomIndicator();
    }
    if (pointers.size === 0) {
      (e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId);
    }
    return;
  }
  if (Date.now() < postPinchGuard) return;

  // End right-click pan
  if (rightPanActive) {
    rightPanActive = false;
    (e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId);
    scheduleHideZoomIndicator();
    return;
  }

  if (props.tool === "lasso") {
    if (lassoResize) {
      lassoResize = null;
      updateUndoRedoState();
      emit("stroke");
      return;
    }
    if (lassoMove) {
      lassoMove = null;
      updateUndoRedoState();
      emit("stroke");
      return;
    }
    if (lassoPath.length > 0) {
      selectedLassoIds = findElementsInLasso(getSelectableElements(), lassoPath).map((element) => element.id);
      lassoPath = [];
      fullRedrawStrokeCanvas(getCanvas(), state);
      drawLassoSelectionOutline();
      updateUndoRedoState();
      return;
    }
    if (lassoBox) {
      selectedLassoIds = findElementsInBoxSelection(getSelectableElements(), {
        x: lassoBox.start.x,
        y: lassoBox.start.y,
        width: lassoBox.current.x - lassoBox.start.x,
        height: lassoBox.current.y - lassoBox.start.y,
      }).map((element) => element.id);
      lassoBox = null;
      fullRedrawStrokeCanvas(getCanvas(), state);
      drawLassoSelectionOutline();
      updateUndoRedoState();
      return;
    }
  }
  if (imageTransform) {
    imageTransform = null;
    updateUndoRedoState();
    emit("stroke");
    return;
  }
  if (elementTransform) {
    elementTransform = null;
    updateUndoRedoState();
    emit("stroke");
    return;
  }
  if (shapeStart && isShapeEditorTool(props.tool)) {
    const preset = props.toolPresets.pen;
    const end = eventPoint(e);
    const dist = Math.hypot(end.x - shapeStart.x, end.y - shapeStart.y);
    if (dist > 4) {
      const stroke = createShapeStrokeForTool(`shape-${Date.now()}`, props.tool, shapeStart, end, preset);
      pushHistorySnapshot(state);
      state.strokes.push(stroke);
    }
    shapeStart = null;
    fullRedrawStrokeCanvas(getCanvas(), state);
    updateUndoRedoState();
    emit("stroke");
    return;
  }
  const completed = enginePointerUp(state);
  if (completed) {
    updateUndoRedoState();
    emit("stroke");
  }
}

function createShapeStrokeForTool(
  id: string,
  tool: EditorTool,
  start: StrokePoint,
  end: StrokePoint,
  preset: ToolPresetCollection["pen"],
): Stroke {
  if (tool === "line") return createLineStroke(id, start, end, preset);
  if (tool === "arrow") return createArrowStroke(id, start, end, preset);
  if (tool === "rectangle") return createRectangleStroke(id, start, end, preset);
  if (tool === "triangle") return createTriangleStroke(id, start, end, preset);
  return createEllipseStroke(id, start, end, preset);
}

function drawShapePreview(
  ctx: CanvasRenderingContext2D,
  tool: EditorTool,
  start: StrokePoint,
  end: StrokePoint,
): void {
  ctx.beginPath();
  if (tool === "line") {
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
  } else if (tool === "arrow") {
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const headLength = Math.max(12, Math.min(28, length * 0.25));
    const wingAngle = Math.PI / 7;
    const left = {
      x: end.x - Math.cos(angle - wingAngle) * headLength,
      y: end.y - Math.sin(angle - wingAngle) * headLength,
    };
    const right = {
      x: end.x - Math.cos(angle + wingAngle) * headLength,
      y: end.y - Math.sin(angle + wingAngle) * headLength,
    };
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.lineTo(left.x, left.y);
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(right.x, right.y);
  } else if (tool === "rectangle") {
    ctx.rect(
      Math.min(start.x, end.x),
      Math.min(start.y, end.y),
      Math.abs(end.x - start.x),
      Math.abs(end.y - start.y),
    );
  } else if (tool === "ellipse") {
    const centerX = (start.x + end.x) / 2;
    const centerY = (start.y + end.y) / 2;
    const radiusX = Math.abs(end.x - start.x) / 2;
    const radiusY = Math.abs(end.y - start.y) / 2;
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  } else if (tool === "triangle") {
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    ctx.moveTo((minX + maxX) / 2, minY);
    ctx.lineTo(maxX, maxY);
    ctx.lineTo(minX, maxY);
    ctx.closePath();
  }
  ctx.stroke();
}

function updateUndoRedoState() {
  emit("update:canUndo", state.undoStack.length > 0);
  emit("update:canRedo", state.redoStack.length > 0);
}

function emitPageState() {
  const navigator = createPageNavigator(serializeState(state));
  const currentIndex = navigator.current?.index ?? 0;
  emit("pagesChanged", {
    current: currentIndex + 1,
    total: Math.max(1, navigator.pages.length),
  });
}

function drawSelectionOutline() {
  if (!selectedElementId) return;
  const element = state.elements.find((item) => item.id === selectedElementId);
  if (!element) return;
  const ctx = getCanvas().getContext("2d")!;
  ctx.save();
  ctx.strokeStyle = "#2f80ed";
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(element.bounds.x, element.bounds.y, element.bounds.width, element.bounds.height);
  ctx.setLineDash([]);
  ctx.fillStyle = "#2f80ed";
  ctx.fillRect(
    element.bounds.x + element.bounds.width - 10,
    element.bounds.y + element.bounds.height - 10,
    10,
    10,
  );
  ctx.restore();
}

function drawLassoPath() {
  if (lassoPath.length === 0) return;
  const ctx = getCanvas().getContext("2d")!;
  ctx.save();
  ctx.strokeStyle = "#2f80ed";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([7, 5]);
  ctx.beginPath();
  ctx.moveTo(lassoPath[0].x, lassoPath[0].y);
  for (const point of lassoPath.slice(1)) {
    ctx.lineTo(point.x, point.y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawLassoBox() {
  if (!lassoBox) return;
  const x = Math.min(lassoBox.start.x, lassoBox.current.x);
  const y = Math.min(lassoBox.start.y, lassoBox.current.y);
  const width = Math.abs(lassoBox.current.x - lassoBox.start.x);
  const height = Math.abs(lassoBox.current.y - lassoBox.start.y);
  const ctx = getCanvas().getContext("2d")!;
  ctx.save();
  ctx.strokeStyle = "#2f80ed";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([7, 5]);
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = "rgba(47, 128, 237, 0.08)";
  ctx.fillRect(x, y, width, height);
  ctx.restore();
}

function drawLassoSelectionOutline() {
  const selected = getSelectableElements().filter((element) => selectedLassoIds.includes(element.id));
  if (selected.length === 0) return;
  const bounds = getBoundsForElements(selected);
  const ctx = getCanvas().getContext("2d")!;
  ctx.save();
  ctx.strokeStyle = "#2f80ed";
  ctx.lineWidth = 1.25;
  ctx.setLineDash([6, 4]);
  for (const element of selected) {
    ctx.strokeRect(element.bounds.x, element.bounds.y, element.bounds.width, element.bounds.height);
  }
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(47, 128, 237, 0.12)";
  for (const element of selected) {
    ctx.fillRect(element.bounds.x, element.bounds.y, element.bounds.width, element.bounds.height);
  }
  if (bounds) {
    ctx.fillStyle = "#2f80ed";
    ctx.fillRect(
      bounds.x + bounds.width - LASSO_RESIZE_HANDLE_SIZE,
      bounds.y + bounds.height - LASSO_RESIZE_HANDLE_SIZE,
      LASSO_RESIZE_HANDLE_SIZE,
      LASSO_RESIZE_HANDLE_SIZE,
    );
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      bounds.x + bounds.width - LASSO_RESIZE_HANDLE_SIZE,
      bounds.y + bounds.height - LASSO_RESIZE_HANDLE_SIZE,
      LASSO_RESIZE_HANDLE_SIZE,
      LASSO_RESIZE_HANDLE_SIZE,
    );
  }
  ctx.restore();
}

function getBoundsForElements(elements: SketchElement[]): Bounds | null {
  if (elements.length === 0) return null;
  const minX = Math.min(...elements.map((element) => element.bounds.x));
  const minY = Math.min(...elements.map((element) => element.bounds.y));
  const maxX = Math.max(...elements.map((element) => element.bounds.x + element.bounds.width));
  const maxY = Math.max(...elements.map((element) => element.bounds.y + element.bounds.height));
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function getLassoSelectionBounds(): Bounds | null {
  return getBoundsForElements(
    getSelectableElements().filter((element) => selectedLassoIds.includes(element.id)),
  );
}

function isPointInLassoResizeHandle(bounds: Bounds, point: StrokePoint): boolean {
  const left = bounds.x + bounds.width - LASSO_RESIZE_HANDLE_SIZE;
  const top = bounds.y + bounds.height - LASSO_RESIZE_HANDLE_SIZE;
  return point.x >= left
    && point.x <= bounds.x + bounds.width
    && point.y >= top
    && point.y <= bounds.y + bounds.height;
}

function getSelectableElements() {
  const strokeElements = migrateStrokesToElements(state.strokes);
  const strokeIds = new Set(state.strokes.map((stroke) => stroke.id));
  return [
    ...strokeElements,
    ...state.elements.filter((element) => element.type !== "stroke" || !strokeIds.has(element.id)),
  ];
}

function clearInteractionState() {
  shapeStart = null;
  imageTransform = null;
  elementTransform = null;
  selectedElementId = null;
  lassoPath = [];
  lassoBox = null;
  selectedLassoIds = [];
  lassoMove = null;
  lassoResize = null;
}

function onCanvasDoubleClick(e: MouseEvent) {
  if (props.tool !== "text") return;
  const point = eventPoint(e as PointerEvent);
  const element = hitTestElement(
    state.elements.filter((item) => item.type === "text"),
    point.x,
    point.y,
  );
  if (!element || element.type !== "text") return;

  textEditor.value = {
    show: true,
    x: element.bounds.x,
    y: element.bounds.y,
    val: element.text,
    elementId: element.id,
  };

  setTimeout(() => {
    if (textEditorInputRef.value) {
      textEditorInputRef.value.focus();
      textEditorInputRef.value.select();
    }
  }, 50);
}

function doUndo() { selectedLassoIds = []; engineUndo(state); fullRedrawStrokeCanvas(getCanvas(), state); updateUndoRedoState(); emit("stroke"); }
function doRedo() { selectedLassoIds = []; engineRedo(state); fullRedrawStrokeCanvas(getCanvas(), state); updateUndoRedoState(); emit("stroke"); }
function doClear() { selectedLassoIds = []; engineClear(state); fullRedrawStrokeCanvas(getCanvas(), state); updateUndoRedoState(); emit("stroke"); }
function getData(): SketchData { return serializeState(state); }
function getState(): EngineState { return state; }
function getPageOverviewItems() { return createPageOverviewItems(serializeState(state)); }
async function restoreData(data: SketchData) {
  if (!bgCanvasRef.value || !strokeCanvasRef.value) return;
  clearInteractionState();
  state = restoreEngineState(data);
  state.tool = getEngineTool(props.tool);
  state.toolPresets = data.toolPresets ?? props.toolPresets;
  state.customBackgrounds = data.customBackgrounds ?? [];
  await preloadElementImages(state.elements);
  setupBackgroundCanvas(bgCanvasRef.value, state);
  setupStrokeCanvas(strokeCanvasRef.value, state);
  updateUndoRedoState();
  emitPageState();
  resetViewport();
}
function addPage() {
  const next = addSketchPage(serializeState(state));
  pushHistorySnapshot(state);
  restorePageState(next);
  updateUndoRedoState();
  emitPageState();
  emit("stroke");
  scrollActivePageIntoView();
}
function duplicateCurrentPage() {
  const current = createPageNavigator(serializeState(state)).current;
  if (!current) return;
  const next = duplicateSketchPage(serializeState(state), current.id);
  pushHistorySnapshot(state);
  restorePageState(next);
  updateUndoRedoState();
  emitPageState();
  emit("stroke");
  scrollActivePageIntoView();
}
function deleteCurrentPage(): boolean {
  const before = serializeState(state);
  const current = createPageNavigator(before).current;
  if (!current) return false;
  let next: SketchData;
  try {
    next = removeSketchPage(before, current.id);
  } catch {
    return false;
  }
  if (next === before) return false;
  pushHistorySnapshot(state);
  restorePageState(next);
  updateUndoRedoState();
  emitPageState();
  emit("stroke");
  scrollActivePageIntoView();
  return true;
}
function restorePageState(data: SketchData) {
  state.pageMode = data.pageMode;
  state.pages = data.pages ?? getSketchPages(data);
  state.activePageId = data.activePageId;
  state.canvasHeight = data.canvasHeight;
  state.strokes = data.strokes;
  state.elements = data.elements ?? [];
  state.isDirty = true;
  resizeCanvases(bgCanvasRef.value!, strokeCanvasRef.value!, state);
}
function goToPage(index: number) {
  const next = createPageNavigator(serializeState(state)).goToIndex(index);
  state.activePageId = next.activePageId;
  emitPageState();
  scrollActivePageIntoView();
}
function goToPreviousPage() {
  const next = createPageNavigator(serializeState(state)).goToPrevious();
  state.activePageId = next.activePageId;
  emitPageState();
  scrollActivePageIntoView();
}
function goToNextPage() {
  const next = createPageNavigator(serializeState(state)).goToNext();
  state.activePageId = next.activePageId;
  emitPageState();
  scrollActivePageIntoView();
}
function scrollActivePageIntoView() {
  const page = createPageNavigator(serializeState(state)).current;
  if (!page) return;
  containerRef.value?.parentElement?.scrollTo({
    top: page.y,
    behavior: "smooth",
  });
}
function deleteLassoSelection() {
  if (selectedLassoIds.length === 0) return;
  pushHistorySnapshot(state);
  state.elements = removeLassoSelection(state.elements, selectedLassoIds);
  state.strokes = removeStrokeSelection(state.strokes, selectedLassoIds);
  selectedLassoIds = [];
  state.isDirty = true;
  fullRedrawStrokeCanvas(getCanvas(), state);
  updateUndoRedoState();
  emit("stroke");
}
function recolorLasso(color: string) {
  if (selectedLassoIds.length === 0) return;
  pushHistorySnapshot(state);
  state.elements = recolorLassoSelection(state.elements, selectedLassoIds, color);
  state.strokes = recolorStrokeSelection(state.strokes, selectedLassoIds, color);
  state.isDirty = true;
  fullRedrawStrokeCanvas(getCanvas(), state);
  drawLassoSelectionOutline();
  updateUndoRedoState();
  emit("stroke");
}
function duplicateLassoSelection() {
  if (selectedLassoIds.length === 0) return;
  const copiedIds = selectedLassoIds.map((id) => `copy-${Date.now()}-${id}`);
  const idByOriginal = new Map(selectedLassoIds.map((id, index) => [id, copiedIds[index]]));
  const createCopyId = (id: string) => idByOriginal.get(id) ?? `copy-${Date.now()}-${id}`;

  pushHistorySnapshot(state);
  state.elements = duplicateLassoElements(
    state.elements,
    selectedLassoIds,
    LASSO_DUPLICATE_OFFSET,
    LASSO_DUPLICATE_OFFSET,
    createCopyId,
  );
  state.strokes = duplicateStrokeSelection(
    state.strokes,
    selectedLassoIds,
    LASSO_DUPLICATE_OFFSET,
    LASSO_DUPLICATE_OFFSET,
    createCopyId,
  );
  selectedLassoIds = copiedIds;
  state.isDirty = true;
  fullRedrawStrokeCanvas(getCanvas(), state);
  drawLassoSelectionOutline();
  updateUndoRedoState();
  emit("stroke");
}
function insertText() {
  const position = createInsertElementPosition({
    canvasWidth: state.canvasWidth,
    pageMode: state.pageMode,
    activePageId: state.activePageId,
    pages: state.pages,
    elementWidth: 220,
    topOffset: 120,
  });

  textEditor.value = {
    show: true,
    x: position.x,
    y: position.y,
    val: "",
    elementId: null,
  };

  setTimeout(() => {
    if (textEditorInputRef.value) {
      textEditorInputRef.value.focus();
    }
  }, 50);
}

function startNewTextEditing(x: number, y: number) {
  const textStyle = props.toolPresets.text ?? { color: "#000000", width: 20 };
  const fontSize = textStyle.width;

  textEditor.value = {
    show: true,
    x: x,
    y: y - fontSize / 2,
    val: "",
    elementId: null,
  };

  setTimeout(() => {
    if (textEditorInputRef.value) {
      textEditorInputRef.value.focus();
    }
  }, 50);
}

function finishTextEditing() {
  if (!textEditor.value.show) return;
  const { elementId, val, x, y } = textEditor.value;
  textEditor.value.show = false;

  if (!val.trim()) {
    if (elementId) {
      pushHistorySnapshot(state);
      state.elements = state.elements.filter((item) => item.id !== elementId);
      state.isDirty = true;
      fullRedrawStrokeCanvas(getCanvas(), state);
      updateUndoRedoState();
      emit("stroke");
    }
    return;
  }

  pushHistorySnapshot(state);

  if (elementId) {
    state.elements = state.elements.map((item) =>
      item.id === elementId ? updateTextElement(item as any, { text: val }) : item,
    );
  } else {
    const textStyle = props.toolPresets.text ?? { color: "#000000", width: 20 };
    const fontSize = textStyle.width;
    const color = textStyle.color;

    const calculatedWidth = Math.max(150, val.length * fontSize * 0.65);
    const calculatedHeight = fontSize + 8;

    const element = createTextElement(`text-${Date.now()}`, {
      x,
      y,
      text: val,
      width: calculatedWidth,
      height: calculatedHeight,
      style: {
        fontSize,
        color,
        fontFamily: "Inter, system-ui, sans-serif",
      },
    });
    state.elements = [...state.elements, element];
  }

  state.isDirty = true;
  fullRedrawStrokeCanvas(getCanvas(), state);
  updateUndoRedoState();
  emit("stroke");
}

function cancelTextEditing() {
  textEditor.value.show = false;
}
async function insertImage(src: string) {
  await preloadImage(src);
  const position = createInsertElementPosition({
    canvasWidth: state.canvasWidth,
    pageMode: state.pageMode,
    activePageId: state.activePageId,
    pages: state.pages,
    elementWidth: 320,
    topOffset: 140,
  });
  const element = createImageElement(`image-${Date.now()}`, {
    x: position.x,
    y: position.y,
    src,
  });
  pushHistorySnapshot(state);
  state.elements = [...state.elements, element];
  fullRedrawStrokeCanvas(getCanvas(), state);
  updateUndoRedoState();
}

function highlightSearchResult(result: OcrSearchResult) {
  if (!result.localBounds && !result.bounds) return;

  if (result.pageNumber != null) {
    const nav = createPageNavigator(serializeState(state)).goToIndex(result.pageNumber - 1);
    state.activePageId = nav.activePageId;
    emitPageState();
  }

  fullRedrawStrokeCanvas(getCanvas(), state);

  const bounds = result.localBounds ?? result.bounds;
  const ctx = getCanvas().getContext("2d")!;
  const pad = 4;
  ctx.save();
  ctx.fillStyle = "rgba(255, 213, 79, 0.35)";
  ctx.strokeStyle = "rgba(255, 152, 0, 0.8)";
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.fillRect(bounds.x - pad, bounds.y - pad, bounds.width + pad * 2, bounds.height + pad * 2);
  ctx.strokeRect(bounds.x - pad, bounds.y - pad, bounds.width + pad * 2, bounds.height + pad * 2);
  ctx.restore();

  scrollActivePageIntoView();
}

defineExpose({
  doUndo,
  doRedo,
  doClear,
  getData,
  getState,
  getPageOverviewItems,
  insertText,
  insertImage,
  restoreData,
  highlightSearchResult,
  deleteLassoSelection,
  duplicateLassoSelection,
  recolorLasso,
  addPage,
  duplicateCurrentPage,
  deleteCurrentPage,
  goToPage,
  goToPreviousPage,
  goToNextPage,
  handleWheelZoom,
  resetViewport,
});
</script>

<style scoped>
.sketch-canvas-container {
  position: relative;
  width: fit-content;
  margin: 24px auto;
  touch-action: none;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--b3-theme-border, rgba(0, 0, 0, 0.08));
  box-shadow:
    0 10px 30px rgba(0, 0, 0, 0.06),
    0 1px 4px rgba(0, 0, 0, 0.03);
  background: var(--b3-theme-background, #ffffff);
  transition: box-shadow 0.3s ease, border-color 0.3s ease;
}
.sketch-canvas { display: block; }
.sketch-canvas--bg { position: relative; }
.sketch-canvas--stroke { position: absolute; top: 0; left: 0; cursor: crosshair; }

/* 原位文本编辑器 */
.sketch-text-editor-overlay {
  position: absolute;
  z-index: 2000;
  background: transparent;
  padding: 0;
  margin: 0;
  display: flex;
  align-items: center;
}
.sketch-text-editor-input {
  box-sizing: border-box;
  font-family: inherit;
  font-size: 16px;
  color: var(--b3-theme-text-main, #333);
  background: var(--b3-theme-background, #fff);
  border: 1px solid var(--b3-theme-primary, #2f80ed);
  border-radius: 4px;
  padding: 2px 6px;
  min-width: 150px;
  max-width: 300px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  outline: none;
  font-weight: 500;
}

/* ── 浮动缩放指示器 ── */
.zoom-indicator {
  position: fixed;
  top: 110px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1100;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: rgba(28, 28, 30, 0.88);
  backdrop-filter: blur(14px) saturate(160%);
  -webkit-backdrop-filter: blur(14px) saturate(160%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  user-select: none;
  pointer-events: auto;
}
.zoom-indicator__value {
  min-width: 40px;
  text-align: center;
}
.zoom-indicator__lock {
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.12);
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
  border-radius: 6px;
  transition: background 0.15s ease;
  line-height: 1.4;
}
.zoom-indicator__lock:hover {
  background: rgba(255, 255, 255, 0.15);
}
.zoom-fade-enter-active,
.zoom-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.zoom-fade-enter-from,
.zoom-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}
</style>

<template>
  <div class="sketch-canvas-container" ref="containerRef">
    <canvas ref="bgCanvasRef" class="sketch-canvas sketch-canvas--bg" />
    <div
      v-if="tool === 'ruler'"
      class="sketch-ruler"
      :style="rulerStyle"
    >
      <span>{{ ruler.angle }}°</span>
    </div>
    <canvas
      ref="strokeCanvasRef"
      class="sketch-canvas sketch-canvas--stroke"
      @dblclick="onCanvasDoubleClick"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onPointerUp"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from "vue";
import type { SketchData, Stroke, StrokePoint, ToolPresetCollection } from "@/types/sketch";
import {
  createEngineState,
  restoreEngineState,
  setupBackgroundCanvas,
  setupStrokeCanvas,
  handlePointerDown as enginePointerDown,
  handlePointerMove as enginePointerMove,
  handlePointerUp as enginePointerUp,
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
  createRulerState,
  moveRuler,
  projectPointToRuler,
  rotateRuler,
} from "@/tools/ruler";
import type { RulerState } from "@/tools/ruler";
import {
  addSketchPage,
  createPageNavigator,
  createPageOverviewItems,
  duplicateSketchPage,
  getSketchPages,
  removeSketchPage,
} from "@/pages/model";
import { shouldDrawFromPointer } from "./inputMode";
import type { SketchInputSettings } from "./inputMode";
import { createInsertElementPosition } from "./insertPosition";
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

const containerRef = ref<HTMLDivElement>();
const bgCanvasRef = ref<HTMLCanvasElement>();
const strokeCanvasRef = ref<HTMLCanvasElement>();
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
const ruler = ref<RulerState>(createRulerState({
  x: 80,
  y: 220,
  angle: 0,
  length: 640,
}));
let rulerMove: {
  lastPoint: StrokePoint;
} | null = null;
const LASSO_DUPLICATE_OFFSET = 24;
const LASSO_RESIZE_HANDLE_SIZE = 14;
const LASSO_MIN_RESIZE_SIZE = 16;

const rulerStyle = computed(() => ({
  left: `${ruler.value.x}px`,
  top: `${ruler.value.y}px`,
  width: `${ruler.value.length}px`,
  transform: `translateY(-17px) rotate(${ruler.value.angle}deg)`,
  transformOrigin: "0 50%",
}));

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

watch(() => props.tool, (t) => { if (state) state.tool = t === "eraser" ? "eraser" : "pen"; });
watch(() => props.toolPresets, (presets) => {
  if (state) state.toolPresets = presets;
}, { deep: true });
watch(() => props.templateId, (tpl) => {
  if (state && bgCanvasRef.value && strokeCanvasRef.value) {
    state.templateId = tpl;
    setupBackgroundCanvas(bgCanvasRef.value, state);
    setupStrokeCanvas(strokeCanvasRef.value, state);
  }
});

function getCanvas(): HTMLCanvasElement { return strokeCanvasRef.value!; }

function eventPoint(e: PointerEvent): StrokePoint {
  const rect = getCanvas().getBoundingClientRect();
  const rawPoint = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
    pressure: e.pressure || 0.5,
    timestamp: e.timeStamp,
  };
  if (props.tool !== "ruler") return rawPoint;
  return {
    ...rawPoint,
    ...projectPointToRuler(rawPoint, ruler.value),
  };
}

function rawEventPoint(e: PointerEvent): StrokePoint {
  const rect = getCanvas().getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
    pressure: e.pressure || 0.5,
    timestamp: e.timeStamp,
  };
}

function isPointOnRuler(point: StrokePoint): boolean {
  const projected = projectPointToRuler(point, ruler.value);
  const distance = Math.hypot(point.x - projected.x, point.y - projected.y);
  const radians = (ruler.value.angle * Math.PI) / 180;
  const along = (point.x - ruler.value.x) * Math.cos(radians)
    + (point.y - ruler.value.y) * Math.sin(radians);
  return distance <= 28 && along >= 0 && along <= ruler.value.length;
}

function onPointerDown(e: PointerEvent) {
  e.preventDefault();
  if (!shouldDrawFromPointer(e, props.inputSettings)) return;
  (e.target as HTMLElement).setPointerCapture(e.pointerId);
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
  if (props.tool === "ruler") {
    const point = rawEventPoint(e);
    if (e.detail >= 2) {
      ruler.value = rotateRuler(ruler.value, ruler.value.angle + 45);
      return;
    }
    if (isPointOnRuler(point)) {
      rulerMove = { lastPoint: point };
      return;
    }
  }
  enginePointerDown(state, e, getCanvas());
}

function onPointerMove(e: PointerEvent) {
  e.preventDefault();
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
  if (rulerMove) {
    const point = rawEventPoint(e);
    const dx = point.x - rulerMove.lastPoint.x;
    const dy = point.y - rulerMove.lastPoint.y;
    ruler.value = moveRuler(ruler.value, dx, dy);
    rulerMove.lastPoint = point;
    return;
  }
  if (shapeStart) return;
  const prevHeight = state.canvasHeight;
  const heightChanged = enginePointerMove(state, e, getCanvas());
  if (heightChanged) {
    resizeCanvases(bgCanvasRef.value!, strokeCanvasRef.value!, state);
    emit("heightChanged", state.canvasHeight);
    emitPageState();
  }
}

function onPointerUp(e: PointerEvent) {
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
  if (rulerMove) {
    rulerMove = null;
    return;
  }
  if (shapeStart && isShapeEditorTool(props.tool)) {
    const preset = props.toolPresets.pen;
    const end = eventPoint(e);
    const stroke = createShapeStrokeForTool(`shape-${Date.now()}`, props.tool, shapeStart, end, preset);
    pushHistorySnapshot(state);
    state.strokes.push(stroke);
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
  rulerMove = null;
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

  const nextText = window.prompt("Text", element.text);
  if (nextText == null) return;

  pushHistorySnapshot(state);
  selectedElementId = element.id;
  state.elements = state.elements.map((item) =>
    item.id === element.id ? updateTextElement(element, { text: nextText }) : item,
  );
  state.isDirty = true;
  fullRedrawStrokeCanvas(getCanvas(), state);
  drawSelectionOutline();
  updateUndoRedoState();
  emit("stroke");
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
  state.tool = props.tool === "eraser" ? "eraser" : "pen";
  state.toolPresets = data.toolPresets ?? props.toolPresets;
  state.customBackgrounds = data.customBackgrounds ?? [];
  await preloadElementImages(state.elements);
  setupBackgroundCanvas(bgCanvasRef.value, state);
  setupStrokeCanvas(strokeCanvasRef.value, state);
  updateUndoRedoState();
  emitPageState();
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
function rotateRulerBy(delta: number) {
  ruler.value = rotateRuler(ruler.value, ruler.value.angle + delta);
}
function insertText() {
  const text = window.prompt("Text", "Text") ?? "Text";
  const position = createInsertElementPosition({
    canvasWidth: state.canvasWidth,
    pageMode: state.pageMode,
    activePageId: state.activePageId,
    pages: state.pages,
    elementWidth: 220,
    topOffset: 120,
  });
  const element = createTextElement(`text-${Date.now()}`, {
    x: position.x,
    y: position.y,
    text,
  });
  pushHistorySnapshot(state);
  state.elements = [...state.elements, element];
  fullRedrawStrokeCanvas(getCanvas(), state);
  updateUndoRedoState();
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
  deleteLassoSelection,
  duplicateLassoSelection,
  recolorLasso,
  rotateRulerBy,
  addPage,
  duplicateCurrentPage,
  deleteCurrentPage,
  goToPage,
  goToPreviousPage,
  goToNextPage,
});
</script>

<style scoped>
.sketch-canvas-container {
  position: relative; width: fit-content; margin: 0 auto; touch-action: none;
}
.sketch-canvas { display: block; }
.sketch-canvas--bg { position: relative; }
.sketch-canvas--stroke { position: absolute; top: 0; left: 0; cursor: crosshair; }
.sketch-ruler {
  position: absolute;
  z-index: 2;
  height: 34px;
  border: 1px solid rgba(32, 40, 48, 0.35);
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.68);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.14);
  pointer-events: none;
}
.sketch-ruler::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  border-top: 1px solid rgba(32, 40, 48, 0.55);
}
.sketch-ruler span {
  position: absolute;
  left: 10px;
  top: 7px;
  color: rgba(32, 40, 48, 0.76);
  font-size: 12px;
}
</style>

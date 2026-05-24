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
import type { SketchData, StrokePoint, ToolPresetCollection } from "@/types/sketch";
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
import { findElementsInLasso } from "@/elements/lasso";
import type { Point as LassoPoint } from "@/elements/lasso";
import {
  recolorLassoSelection,
  recolorStrokeSelection,
  removeLassoSelection,
  removeStrokeSelection,
  translateStrokeSelection,
  translateLassoSelection,
} from "@/elements/lassoEdit";
import { migrateStrokesToElements } from "@/elements/model";
import {
  createRulerState,
  moveRuler,
  projectPointToRuler,
  rotateRuler,
} from "@/tools/ruler";
import type { RulerState } from "@/tools/ruler";
import { isShapeEditorTool } from "./tools";
import type { EditorTool } from "./tools";

const props = defineProps<{
  initialData: SketchData | null;
  tool: EditorTool;
  toolPresets: ToolPresetCollection;
  templateId: string;
}>();

const emit = defineEmits<{
  (e: "update:canUndo", value: boolean): void;
  (e: "update:canRedo", value: boolean): void;
  (e: "heightChanged", height: number): void;
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
let lassoMove: {
  lastPoint: StrokePoint;
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
  (e.target as HTMLElement).setPointerCapture(e.pointerId);
  if (props.tool === "lasso") {
    const point = eventPoint(e);
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
    lassoPath = [point];
    selectedLassoIds = [];
    fullRedrawStrokeCanvas(getCanvas(), state);
    drawLassoPath();
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
  }
}

function onPointerUp(e: PointerEvent) {
  if (props.tool === "lasso") {
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
    const stroke = props.tool === "line"
      ? createLineStroke(`shape-${Date.now()}`, shapeStart, end, preset)
      : props.tool === "arrow"
        ? createArrowStroke(`shape-${Date.now()}`, shapeStart, end, preset)
      : props.tool === "rectangle"
        ? createRectangleStroke(`shape-${Date.now()}`, shapeStart, end, preset)
        : createEllipseStroke(`shape-${Date.now()}`, shapeStart, end, preset);
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

function updateUndoRedoState() {
  emit("update:canUndo", state.undoStack.length > 0);
  emit("update:canRedo", state.redoStack.length > 0);
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

function drawLassoSelectionOutline() {
  const selected = getSelectableElements().filter((element) => selectedLassoIds.includes(element.id));
  if (selected.length === 0) return;
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
  ctx.restore();
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
  selectedLassoIds = [];
  lassoMove = null;
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
async function restoreData(data: SketchData) {
  if (!bgCanvasRef.value || !strokeCanvasRef.value) return;
  clearInteractionState();
  state = restoreEngineState(data);
  state.tool = props.tool === "eraser" ? "eraser" : "pen";
  state.toolPresets = data.toolPresets ?? props.toolPresets;
  await preloadElementImages(state.elements);
  setupBackgroundCanvas(bgCanvasRef.value, state);
  setupStrokeCanvas(strokeCanvasRef.value, state);
  updateUndoRedoState();
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
function rotateRulerBy(delta: number) {
  ruler.value = rotateRuler(ruler.value, ruler.value.angle + delta);
}
function insertText() {
  const text = window.prompt("Text", "Text") ?? "Text";
  const element = createTextElement(`text-${Date.now()}`, {
    x: state.canvasWidth / 2 - 110,
    y: 120,
    text,
  });
  pushHistorySnapshot(state);
  state.elements = [...state.elements, element];
  fullRedrawStrokeCanvas(getCanvas(), state);
  updateUndoRedoState();
}
async function insertImage(src: string) {
  await preloadImage(src);
  const element = createImageElement(`image-${Date.now()}`, {
    x: state.canvasWidth / 2 - 160,
    y: 140,
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
  insertText,
  insertImage,
  restoreData,
  deleteLassoSelection,
  recolorLasso,
  rotateRulerBy,
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

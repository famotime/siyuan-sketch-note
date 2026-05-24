<template>
  <div class="sketch-canvas-container" ref="containerRef">
    <canvas ref="bgCanvasRef" class="sketch-canvas sketch-canvas--bg" />
    <div
      v-if="tool === 'ruler'"
      class="sketch-ruler"
      :style="{ top: `${rulerY}px` }"
    >
      <span>0°</span>
    </div>
    <canvas
      ref="strokeCanvasRef"
      class="sketch-canvas sketch-canvas--stroke"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onPointerUp"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
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
} from "@/engine/canvasEngine";
import type { EngineState } from "@/engine/canvasEngine";
import {
  createEllipseStroke,
  createLineStroke,
  createRectangleStroke,
} from "@/elements/shapes";
import { createImageElement } from "@/elements/image";
import { createTextElement } from "@/elements/text";
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
const rulerY = ref(220);

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
  const y = props.tool === "ruler" ? rulerY.value : e.clientY - rect.top;
  return {
    x: e.clientX - rect.left,
    y,
    pressure: e.pressure || 0.5,
    timestamp: e.timeStamp,
  };
}

function onPointerDown(e: PointerEvent) {
  e.preventDefault();
  (e.target as HTMLElement).setPointerCapture(e.pointerId);
  if (isShapeEditorTool(props.tool)) {
    shapeStart = eventPoint(e);
    return;
  }
  if (props.tool === "ruler") {
    rulerY.value = e.clientY - getCanvas().getBoundingClientRect().top;
  }
  enginePointerDown(state, e, getCanvas());
}

function onPointerMove(e: PointerEvent) {
  e.preventDefault();
  if (shapeStart) return;
  const prevHeight = state.canvasHeight;
  const heightChanged = enginePointerMove(state, e, getCanvas());
  if (heightChanged) {
    resizeCanvases(bgCanvasRef.value!, strokeCanvasRef.value!, state);
    emit("heightChanged", state.canvasHeight);
  }
}

function onPointerUp(e: PointerEvent) {
  if (shapeStart && isShapeEditorTool(props.tool)) {
    const preset = props.toolPresets.pen;
    const end = eventPoint(e);
    const stroke = props.tool === "line"
      ? createLineStroke(`shape-${Date.now()}`, shapeStart, end, preset)
      : props.tool === "rectangle"
        ? createRectangleStroke(`shape-${Date.now()}`, shapeStart, end, preset)
        : createEllipseStroke(`shape-${Date.now()}`, shapeStart, end, preset);
    state.undoStack.push([...state.strokes]);
    state.redoStack = [];
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

function doUndo() { engineUndo(state); fullRedrawStrokeCanvas(getCanvas(), state); updateUndoRedoState(); emit("stroke"); }
function doRedo() { engineRedo(state); fullRedrawStrokeCanvas(getCanvas(), state); updateUndoRedoState(); emit("stroke"); }
function doClear() { engineClear(state); fullRedrawStrokeCanvas(getCanvas(), state); updateUndoRedoState(); emit("stroke"); }
function getData(): SketchData { return serializeState(state); }
function getState(): EngineState { return state; }
function insertText() {
  const element = createTextElement(`text-${Date.now()}`, {
    x: state.canvasWidth / 2 - 110,
    y: 120,
    text: "Text",
  });
  state.undoStack.push([...state.strokes]);
  state.redoStack = [];
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
  state.undoStack.push([...state.strokes]);
  state.redoStack = [];
  state.elements = [...state.elements, element];
  fullRedrawStrokeCanvas(getCanvas(), state);
  updateUndoRedoState();
}

defineExpose({ doUndo, doRedo, doClear, getData, getState, insertText, insertImage });
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
  left: 24px;
  right: 24px;
  z-index: 2;
  height: 34px;
  transform: translateY(-17px);
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

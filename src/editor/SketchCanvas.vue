<template>
  <div class="sketch-canvas-container" ref="containerRef">
    <canvas ref="bgCanvasRef" class="sketch-canvas sketch-canvas--bg" />
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
import type { SketchData, SketchTool } from "@/types/sketch";
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
} from "@/engine/canvasEngine";
import type { EngineState } from "@/engine/canvasEngine";

const props = defineProps<{
  initialData: SketchData | null;
  tool: SketchTool;
  color: string;
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

onMounted(() => {
  if (!bgCanvasRef.value || !strokeCanvasRef.value) return;
  state = props.initialData
    ? restoreEngineState(props.initialData)
    : createEngineState("blank");
  setupBackgroundCanvas(bgCanvasRef.value, state);
  setupStrokeCanvas(strokeCanvasRef.value, state);
  updateUndoRedoState();
});

watch(() => props.tool, (t) => { if (state) state.tool = t; });
watch(() => props.color, (c) => { if (state) state.color = c; });
watch(() => props.templateId, (tpl) => {
  if (state && bgCanvasRef.value && strokeCanvasRef.value) {
    state.templateId = tpl;
    setupBackgroundCanvas(bgCanvasRef.value, state);
    setupStrokeCanvas(strokeCanvasRef.value, state);
  }
});

function getCanvas(): HTMLCanvasElement { return strokeCanvasRef.value!; }

function onPointerDown(e: PointerEvent) {
  e.preventDefault();
  (e.target as HTMLElement).setPointerCapture(e.pointerId);
  enginePointerDown(state, e, getCanvas());
}

function onPointerMove(e: PointerEvent) {
  e.preventDefault();
  const prevHeight = state.canvasHeight;
  const heightChanged = enginePointerMove(state, e, getCanvas());
  if (heightChanged) {
    resizeCanvases(bgCanvasRef.value!, strokeCanvasRef.value!, state);
    emit("heightChanged", state.canvasHeight);
  }
}

function onPointerUp(_e: PointerEvent) {
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

defineExpose({ doUndo, doRedo, doClear, getData, getState });
</script>

<style scoped>
.sketch-canvas-container {
  position: relative; width: fit-content; margin: 0 auto; touch-action: none;
}
.sketch-canvas { display: block; }
.sketch-canvas--bg { position: relative; }
.sketch-canvas--stroke { position: absolute; top: 0; left: 0; cursor: crosshair; }
</style>

<template>
  <div
    ref="containerRef"
    class="sketch-canvas-container"
    :style="{ transform: `translate(${viewportPanX}px, ${viewportPanY}px) scale(${viewportScale})`, transformOrigin: '0 0' }"
  >
    <canvas
      ref="bgCanvasRef"
      class="sketch-canvas sketch-canvas--bg"
    />
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
      <textarea
        ref="textEditorInputRef"
        v-model="textEditor.val"
        class="sketch-text-editor-input"
        :style="{
          width: `${textEditor.width}px`,
          height: `${textEditor.height}px`,
          fontSize: `${textEditor.fontSize}px`,
          lineHeight: `${textEditor.lineHeight}px`,
          color: textEditor.color,
          fontFamily: textEditor.fontFamily,
        }"
        @keydown.esc="cancelTextEditing"
        @blur="finishTextEditing"
      ></textarea>
    </div>
  </div>
  <Transition name="zoom-fade">
    <div
      v-if="showIndicator || zoomLocked"
      class="zoom-indicator"
      @pointerdown.stop
    >
      <span class="zoom-indicator__value">{{ Math.round(viewportScale * 100) }}%</span>
      <button
        class="zoom-indicator__lock"
        @click="toggleZoomLock"
      >
        <IconParkIcon :name="zoomLocked ? 'Lock' : 'Unlock'" />
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
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
import { renderStroke } from "@/engine/strokeRenderer";
import {
  createArrowStroke,
  createEllipseStroke,
  createLineStroke,
  createRectangleStroke,
  createTriangleStroke,
} from "@/elements/shapes";
import { createImageElement, fitImageElementSize } from "@/elements/image";
import type { ImageElement } from "@/elements/image";
import {
  angleFromElementCenter,
  hitTestElement,
  moveElement,
  resizeElementFromCorner,
  resolveElementTransformAction,
  rotateElement,
} from "@/elements/transform";
import type { ResizeCorner } from "@/elements/transform";
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
import IconParkIcon from "./IconParkIcon.vue";
import type { OcrSearchResult } from "@/search/ocrIndex";
import { isShapeEditorTool } from "./tools";
import type { EditorTool } from "./tools";
import { hasTextPointerDrag, resolveTextPointerAction } from "./textPointerAction";
import { useViewport } from "@/composables/useViewport";
import { useTextEditing } from "@/composables/useTextEditing";
import type { ReplayRecorder } from "@/recorder/recorder";
import type { ElementTransformReplayEvent, ImageTransformSample, ReplayEvent, ReplayToolSource } from "@/recorder/types";

const props = defineProps<{
  initialData: SketchData | null;
  tool: EditorTool;
  toolPresets: ToolPresetCollection;
  inputSettings: SketchInputSettings;
  templateId: string;
  lassoMode: "freehand" | "box";
  recorder?: ReplayRecorder;
  onLiveEvent?: (event: ReplayEvent) => void;
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

// ── Composables ──
const viewport = useViewport({ containerRef });
const { viewportScale, viewportPanX, viewportPanY, showIndicator, zoomLocked, toggleZoomLock, resetViewport, handleWheelZoom } = viewport;

// ── Interaction state ──
let state: EngineState;

function registerStateCallback(s: EngineState) {
  s.onPushHistorySnapshot = () => {
    if (props.recorder) {
      props.recorder.pushUndoSnapshot();
    }
  };
}

const textEditing = useTextEditing({
  state: () => state,
  getCanvas: () => strokeCanvasRef.value!,
  toolPresets: computed(() => props.toolPresets),
  updateUndoRedoState: () => updateUndoRedoState(),
  emit: (e) => emit(e),
  recorder: props.recorder,
});
const { textEditor, textEditorInputRef, startNewTextEditing, insertText, startEditText, finishTextEditing, cancelTextEditing: cancelTextEditingBase } = textEditing;
// Element interaction state
const interaction = {
  shapeStart: null as StrokePoint | null,
  imageTransform: null as {
    elementId: string;
    lastPoint: StrokePoint;
    mode: "move" | "resize" | "rotate";
    corner?: ResizeCorner;
    startAngle?: number;
    startRotation?: number;
    points: Array<{ x: number; y: number; timestamp: number }>;
    initialElement: ImageElement;
    startedAt: number;
    lastSampleAt: number;
    samples: ImageTransformSample[];
  } | null,
  elementTransform: null as { elementId: string; lastPoint: StrokePoint; mode: "move" | "resize" } | null,
  textMove: null as { elementId: string; startPoint: StrokePoint; lastPoint: StrokePoint; moved: boolean } | null,
  selectedElementId: null as string | null,
  longPressTimer: null as number | null,
  longPressPending: null as { elementId: string; startPoint: StrokePoint; event: PointerEvent } | null,
  longPressDrag: null as { elementId: string; lastPoint: StrokePoint; initialElements: SketchElement[] } | null,
};

// Lasso selection state
const lasso = {
  path: [] as LassoPoint[],
  selectedIds: [] as string[],
  box: null as { start: LassoPoint; current: LassoPoint } | null,
  move: null as {
    lastPoint: StrokePoint;
    initialElements: SketchElement[];
    initialImage?: ImageElement;
    startedAt?: number;
    lastSampleAt?: number;
    points?: Array<{ x: number; y: number; timestamp: number }>;
    samples?: ImageTransformSample[];
  } | null,
  resize: null as {
    anchor: { x: number; y: number };
    initialBounds: Bounds;
    elements: SketchElement[];
    strokes: SketchData["strokes"];
  } | null,
  longPress: null as {
    point: StrokePoint;
    elementId: string;
    timer: number;
    selected: boolean;
  } | null,
};
const LASSO_DUPLICATE_OFFSET = 24;
const LASSO_RESIZE_HANDLE_SIZE = 14;
const LASSO_MIN_RESIZE_SIZE = 16;
const LASSO_LONG_PRESS_MS = 450;
const LASSO_LONG_PRESS_MOVE_TOLERANCE = 8;
const IMAGE_TRANSFORM_SAMPLE_INTERVAL_MS = 16;

function createImageTransformSample(element: ImageElement, offsetMs: number, pointer?: { x: number; y: number }): ImageTransformSample {
  return {
    offsetMs,
    bounds: { ...element.bounds },
    rotation: element.transform.rotation || 0,
    opacity: element.opacity ?? 1,
    pointer,
  };
}

onMounted(async () => {
  if (!bgCanvasRef.value || !strokeCanvasRef.value) return;
  state = props.initialData
    ? restoreEngineState(props.initialData)
    : createEngineState("blank");
  registerStateCallback(state);
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
  { immediate: true },
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
    canvas.style.cursor = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") ${center} ${center}, auto`;
  } else {
    canvas.style.cursor = "crosshair";
  }
}

function getEngineTool(tool: EditorTool): SketchTool {
  if (tool === "eraser") return "eraser";
  if (tool === "highlighter") return "highlighter";
  return "pen";
}

function cloneReplayElement(element: SketchElement): SketchElement {
  return JSON.parse(JSON.stringify(element)) as SketchElement;
}

function getSelectedReplayElements(selectedIds: string[]): SketchElement[] {
  const selected = new Set(selectedIds);
  return getSelectableElements()
    .filter((element) => selected.has(element.id))
    .map(cloneReplayElement);
}

function recordElementTransform(
  op: ElementTransformReplayEvent["op"],
  initialElements: SketchElement[],
) {
  if (!props.recorder || initialElements.length === 0) return;
  const finalElements = getSelectedReplayElements(initialElements.map((element) => element.id));
  if (finalElements.length === 0) return;
  const event = {
    type: "elementTransform" as const,
    id: `et-${Date.now()}`,
    timestamp: Date.now(),
    op,
    elementIds: finalElements.map((element) => element.id),
    initialElements,
    finalElements,
  };
  props.recorder.record(event);
  props.onLiveEvent?.(event);
}

function isDirectDrawingTool(tool: EditorTool): boolean {
  return tool === "pen" || tool === "highlighter" || tool === "eraser";
}

watch(() => props.tool, (t) => { if (state) state.tool = getEngineTool(t); });
watch(() => props.toolPresets, (presets) => { if (state) state.toolPresets = presets; }, { deep: true });
watch(() => props.inputSettings?.enablePressure, (val) => { if (state) state.enablePressure = val ?? true; }, { immediate: true });
watch(() => props.templateId, (tpl) => {
  if (state && bgCanvasRef.value && strokeCanvasRef.value) {
    state.templateId = tpl;
    setupBackgroundCanvas(bgCanvasRef.value, state);
    setupStrokeCanvas(strokeCanvasRef.value, state);
  }
});

function getCanvas(): HTMLCanvasElement { return strokeCanvasRef.value!; }

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
  return { x: point.x, y: point.y, pressure: e.pressure || 0.5, timestamp: e.timeStamp };
}

// ── Pointer event handlers ──

function onPointerDown(e: PointerEvent) {
  e.preventDefault();

  const vpResult = viewport.handlePointerDown(e);
  if (vpResult === "two-finger") {
    if (viewport.startTwoFingerGesture(props.inputSettings.stylusOnly)) {
      if (cancelCurrentStroke(state)) fullRedrawStrokeCanvas(getCanvas(), state);
    }
    return;
  }
  if (vpResult === "right-pan") return;

  if (viewport.isPostPinchGuard()) return;
  if (!shouldDrawFromPointer(e, props.inputSettings)) return;
  (e.target as HTMLElement).setPointerCapture(e.pointerId);

  if (isDirectDrawingTool(props.tool)) {
    const point = eventPoint(e);
    enginePointerDown(state, { ...point, canvasX: point.x, canvasY: point.y }, getCanvas());
    return;
  }

  // Long-press to select and drag any element (non-lasso, non-text tools)
  if (props.tool !== "lasso" && props.tool !== "text") {
    const point = eventPoint(e);
    const hitElement = hitTestElement(getSelectableElements(), point.x, point.y);
    if (hitElement) {
      cancelLongPressTimer();
      interaction.longPressPending = { elementId: hitElement.id, startPoint: point, event: e };
      interaction.longPressTimer = window.setTimeout(() => {
        interaction.longPressTimer = null;
        interaction.longPressPending = null;
        // Cancel any in-progress drawing
        if (cancelCurrentStroke(state)) fullRedrawStrokeCanvas(getCanvas(), state);
        interaction.shapeStart = null;
        lasso.selectedIds = [hitElement.id];
        lasso.path = [];
        lasso.box = null;
        interaction.longPressDrag = { elementId: hitElement.id, lastPoint: point, initialElements: getSelectedReplayElements(lasso.selectedIds) };
        pushHistorySnapshot(state);
        fullRedrawStrokeCanvas(getCanvas(), state);
        drawLassoSelectionOutline();
      }, LASSO_LONG_PRESS_MS);
      return;
    }
    // Click on already-selected element → drag directly without long-press
    if (lasso.selectedIds.length > 0) {
      const selectedHit = hitTestElement(
        getSelectableElements().filter((el) => lasso.selectedIds.includes(el.id)),
        point.x,
        point.y,
      );
      if (selectedHit) {
        cancelLongPressTimer();
        // 单个图片选中时检测变换手柄（缩放/旋转/透明度/删除）
        if (lasso.selectedIds.length === 1 && selectedHit.type === "image") {
          const action = resolveElementTransformAction([selectedHit], selectedHit.id, point.x, point.y);
          if (action?.mode === "opacity") { cycleImageOpacity(action.element.id); return; }
          if (action?.mode === "delete") { deleteLassoSelection(); return; }
          if (action && action.mode !== "move") {
            const startTime = Date.now();
            const imageElement = action.element as ImageElement;
            interaction.imageTransform = {
              elementId: imageElement.id,
              lastPoint: point,
              mode: action.mode,
              corner: action.corner,
              startAngle: angleFromElementCenter(imageElement, point.x, point.y),
              startRotation: imageElement.transform.rotation || 0,
              points: [{ x: point.x, y: point.y, timestamp: startTime }],
              initialElement: imageElement,
              startedAt: startTime,
              lastSampleAt: startTime,
              samples: [createImageTransformSample(imageElement, 0, { x: point.x, y: point.y })],
            };
            pushHistorySnapshot(state);
            return;
          }
        }
        interaction.longPressDrag = { elementId: selectedHit.id, lastPoint: point, initialElements: getSelectedReplayElements(lasso.selectedIds) };
        pushHistorySnapshot(state);
        return;
      }
      // Click on empty canvas → deselect
      cancelLongPressTimer();
      lasso.selectedIds = [];
      lasso.path = [];
      lasso.box = null;
      fullRedrawStrokeCanvas(getCanvas(), state);
      return;
    }
  }

  if (props.tool === "text") {
    if (textEditor.value.show) {
      finishTextEditing();
    } else {
      const point = eventPoint(e);
      const action = resolveTextPointerAction(state.elements, point.x, point.y);
      if (action.type === "edit") {
        interaction.selectedElementId = action.element.id;
        interaction.textMove = {
          elementId: action.element.id,
          startPoint: point,
          lastPoint: point,
          moved: false,
        };
      } else {
        startNewTextEditing(action.x, action.y);
      }
    }
    return;
  }

  if (props.tool === "lasso") {
    const point = eventPoint(e);
    const selectionBounds = getLassoSelectionBounds();
    const selectedImage = getSingleSelectedImage();
    if (selectedImage) {
      const imageAction = resolveElementTransformAction([selectedImage], selectedImage.id, point.x, point.y);
      if (imageAction?.mode === "opacity") {
        cycleImageOpacity(imageAction.element.id);
        return;
      }
      if (imageAction?.mode === "delete") {
        deleteLassoSelection();
        return;
      }
      if (imageAction && imageAction.mode !== "move") {
        const startTime = Date.now();
        const imageElement = imageAction.element as ImageElement;
        interaction.imageTransform = {
          elementId: imageElement.id,
          lastPoint: point,
          mode: imageAction.mode,
          corner: imageAction.corner,
          startAngle: angleFromElementCenter(imageElement, point.x, point.y),
          startRotation: imageElement.transform.rotation || 0,
          points: [{ x: point.x, y: point.y, timestamp: startTime }],
          initialElement: imageElement,
          startedAt: startTime,
          lastSampleAt: startTime,
          samples: [createImageTransformSample(imageElement, 0, { x: point.x, y: point.y })],
        };
        pushHistorySnapshot(state);
        return;
      }
    }
    if (selectionBounds && !selectedImage && isPointInLassoResizeHandle(selectionBounds, point)) {
      lasso.resize = {
        anchor: { x: selectionBounds.x, y: selectionBounds.y },
        initialBounds: selectionBounds,
        elements: state.elements,
        strokes: state.strokes,
      };
      pushHistorySnapshot(state);
      return;
    }
    const selectedElement = hitTestElement(
      getSelectableElements().filter((element) => lasso.selectedIds.includes(element.id)),
      point.x,
      point.y,
    );
    if (selectedElement) {
      const startTime = Date.now();
      const selectedImage = selectedElement.type === "image" && lasso.selectedIds.length === 1 ? selectedElement as ImageElement : undefined;
      lasso.move = {
        lastPoint: point,
        initialElements: getSelectedReplayElements(lasso.selectedIds),
        initialImage: selectedImage,
        startedAt: selectedImage ? startTime : undefined,
        lastSampleAt: selectedImage ? startTime : undefined,
        points: selectedImage ? [{ x: point.x, y: point.y, timestamp: startTime }] : undefined,
        samples: selectedImage ? [createImageTransformSample(selectedImage, 0, { x: point.x, y: point.y })] : undefined,
      };
      pushHistorySnapshot(state);
      return;
    }
    const pressedElement = hitTestElement(
      getSelectableElements(),
      point.x,
      point.y,
    );
    if (pressedElement) {
      startLassoLongPress(point, pressedElement.id);
      return;
    }
    if (props.lassoMode === "box") {
      lasso.box = { start: point, current: point };
    } else {
      lasso.path = [point];
    }
    lasso.selectedIds = [];
    fullRedrawStrokeCanvas(getCanvas(), state);
    if (props.lassoMode === "box") drawLassoBox();
    else drawLassoPath();
    return;
  }

  if (props.tool === "image") {
    const point = eventPoint(e);
    const action = resolveElementTransformAction(
      state.elements.filter((item) => item.type === "image"),
      interaction.selectedElementId,
      point.x,
      point.y,
    );
    interaction.selectedElementId = action?.element.id ?? null;
    if (action?.mode === "opacity") {
      cycleImageOpacity(action.element.id);
      return;
    }
    if (action?.mode === "delete") {
      if (props.recorder) {
        const event = {
          type: "imageDelete" as const,
          id: `id-${Date.now()}`,
          timestamp: Date.now(),
          elementId: action.element.id,
        };
        props.recorder.record(event);
        props.onLiveEvent?.(event);
      }
      pushHistorySnapshot(state);
      state.elements = state.elements.filter((element) => element.id !== action.element.id);
      interaction.selectedElementId = null;
      state.isDirty = true;
      fullRedrawStrokeCanvas(getCanvas(), state);
      updateUndoRedoState();
      emit("stroke");
      return;
    }
    if (action) {
      const startTime = Date.now();
      const imageElement = action.element as ImageElement;
      interaction.imageTransform = {
        elementId: imageElement.id,
        lastPoint: point,
        mode: action.mode,
        corner: action.corner,
        startAngle: angleFromElementCenter(imageElement, point.x, point.y),
        startRotation: imageElement.transform.rotation || 0,
        points: [{ x: point.x, y: point.y, timestamp: startTime }],
        initialElement: imageElement,
        startedAt: startTime,
        lastSampleAt: startTime,
        samples: [createImageTransformSample(imageElement, 0, { x: point.x, y: point.y })],
      };
      pushHistorySnapshot(state);
    }
    fullRedrawStrokeCanvas(getCanvas(), state);
    drawSelectionOutline();
    return;
  }

  if (isShapeEditorTool(props.tool)) {
    interaction.shapeStart = eventPoint(e);
    return;
  }

  const point = eventPoint(e);
  enginePointerDown(state, { ...point, canvasX: point.x, canvasY: point.y }, getCanvas());
}

function onPointerMove(e: PointerEvent) {
  e.preventDefault();

  const vpResult = viewport.handlePointerMove(e);
  if (vpResult) return;

  // Cancel pending long-press if pointer moves beyond tolerance
  if (interaction.longPressPending) {
    const point = eventPoint(e);
    const distance = Math.hypot(point.x - interaction.longPressPending.startPoint.x, point.y - interaction.longPressPending.startPoint.y);
    if (distance > LASSO_LONG_PRESS_MOVE_TOLERANCE) {
      const savedEvent = interaction.longPressPending.event;
      cancelLongPressTimer();
      // Replay the original press event to start normal tool drawing
      onPointerDown(savedEvent);
      // Continue with this move event
    } else {
      return;
    }
  }

  // Handle active long-press drag
  if (interaction.longPressDrag) {
    const point = eventPoint(e);
    const dx = point.x - interaction.longPressDrag.lastPoint.x;
    const dy = point.y - interaction.longPressDrag.lastPoint.y;
    state.elements = translateLassoSelection(state.elements, lasso.selectedIds, dx, dy);
    state.strokes = translateStrokeSelection(state.strokes, lasso.selectedIds, dx, dy);
    interaction.longPressDrag.lastPoint = point;
    state.isDirty = true;
    fullRedrawStrokeCanvas(getCanvas(), state);
    drawLassoSelectionOutline();
    return;
  }

  if (props.tool === "lasso") {
    const point = eventPoint(e);
    if (lasso.longPress) {
      const distance = Math.hypot(point.x - lasso.longPress.point.x, point.y - lasso.longPress.point.y);
      if (!lasso.longPress.selected && distance > LASSO_LONG_PRESS_MOVE_TOLERANCE) {
        const start = lasso.longPress.point;
        cancelLassoLongPress();
        if (props.lassoMode === "box") {
          lasso.box = { start, current: point };
          lasso.selectedIds = [];
          fullRedrawStrokeCanvas(getCanvas(), state);
          drawLassoBox();
        } else {
          lasso.path = [start, point];
          lasso.selectedIds = [];
          fullRedrawStrokeCanvas(getCanvas(), state);
          drawLassoPath();
        }
      }
      return;
    }
    if (lasso.resize) {
      const width = Math.max(LASSO_MIN_RESIZE_SIZE, point.x - lasso.resize.anchor.x);
      const height = Math.max(LASSO_MIN_RESIZE_SIZE, point.y - lasso.resize.anchor.y);
      const scaleX = width / Math.max(1, lasso.resize.initialBounds.width);
      const scaleY = height / Math.max(1, lasso.resize.initialBounds.height);
      state.elements = resizeLassoSelection(lasso.resize.elements, lasso.selectedIds, lasso.resize.anchor, scaleX, scaleY);
      state.strokes = resizeStrokeSelection(lasso.resize.strokes, lasso.selectedIds, lasso.resize.anchor, scaleX, scaleY);
      state.isDirty = true;
      fullRedrawStrokeCanvas(getCanvas(), state);
      drawLassoSelectionOutline();
      return;
    }
    if (lasso.move) {
      const dx = point.x - lasso.move.lastPoint.x;
      const dy = point.y - lasso.move.lastPoint.y;
      state.elements = translateLassoSelection(state.elements, lasso.selectedIds, dx, dy);
      state.strokes = translateStrokeSelection(state.strokes, lasso.selectedIds, dx, dy);
      lasso.move.lastPoint = point;
      const now = Date.now();
      if (lasso.move.initialImage && lasso.move.startedAt != null && lasso.move.lastSampleAt != null && lasso.move.points && lasso.move.samples) {
        lasso.move.points.push({ x: point.x, y: point.y, timestamp: now });
        const updated = state.elements.find((element): element is ImageElement => element.id === lasso.move?.initialImage?.id && element.type === "image");
        if (updated && now - lasso.move.lastSampleAt >= IMAGE_TRANSFORM_SAMPLE_INTERVAL_MS) {
          lasso.move.samples.push(createImageTransformSample(updated, now - lasso.move.startedAt, { x: point.x, y: point.y }));
          lasso.move.lastSampleAt = now;
        }
      }
      state.isDirty = true;
      fullRedrawStrokeCanvas(getCanvas(), state);
      drawLassoSelectionOutline();
      return;
    }
    if (lasso.path.length > 0) {
      lasso.path.push(point);
      fullRedrawStrokeCanvas(getCanvas(), state);
      drawLassoPath();
      return;
    }
    if (lasso.box) {
      lasso.box.current = point;
      fullRedrawStrokeCanvas(getCanvas(), state);
      drawLassoBox();
      return;
    }
  }

  if (interaction.imageTransform) {
    const point = eventPoint(e);
    const dx = point.x - interaction.imageTransform.lastPoint.x;
    const dy = point.y - interaction.imageTransform.lastPoint.y;
    state.elements = state.elements.map((element) => {
      if (element.id !== interaction.imageTransform?.elementId) return element;
      if (interaction.imageTransform.mode === "move") return moveElement(element, dx, dy);
      if (interaction.imageTransform.mode === "resize") {
        return resizeElementFromCorner(element, interaction.imageTransform.corner ?? "se", dx, dy);
      }
      const angle = angleFromElementCenter(element, point.x, point.y);
      const rotation = (interaction.imageTransform.startRotation ?? 0)
        + angle
        - (interaction.imageTransform.startAngle ?? angle);
      return rotateElement(element, rotation);
    });
    interaction.imageTransform.lastPoint = point;
    const now = Date.now();
    interaction.imageTransform.points.push({ x: point.x, y: point.y, timestamp: now });
    const updated = state.elements.find((element): element is ImageElement => element.id === interaction.imageTransform?.elementId && element.type === "image");
    if (updated && now - interaction.imageTransform.lastSampleAt >= IMAGE_TRANSFORM_SAMPLE_INTERVAL_MS) {
      interaction.imageTransform.samples.push(createImageTransformSample(updated, now - interaction.imageTransform.startedAt, { x: point.x, y: point.y }));
      interaction.imageTransform.lastSampleAt = now;
    }
    state.isDirty = true;
    fullRedrawStrokeCanvas(getCanvas(), state);
    if (interaction.selectedElementId) drawSelectionOutline();
    else drawLassoSelectionOutline();
    return;
  }

  if (interaction.textMove) {
    const point = eventPoint(e);
    if (!interaction.textMove.moved && !hasTextPointerDrag(interaction.textMove.startPoint, point)) return;
    if (!interaction.textMove.moved) {
      pushHistorySnapshot(state);
      interaction.textMove.moved = true;
    }
    const dx = point.x - interaction.textMove.lastPoint.x;
    const dy = point.y - interaction.textMove.lastPoint.y;
    state.elements = state.elements.map((element) => {
      if (element.id !== interaction.textMove?.elementId) return element;
      return moveElement(element, dx, dy);
    });
    interaction.textMove.lastPoint = point;
    state.isDirty = true;
    fullRedrawStrokeCanvas(getCanvas(), state);
    drawSelectionOutline();
    return;
  }

  if (interaction.elementTransform) {
    const point = eventPoint(e);
    const dx = point.x - interaction.elementTransform.lastPoint.x;
    const dy = point.y - interaction.elementTransform.lastPoint.y;
    state.elements = state.elements.map((element) => {
      if (element.id !== interaction.elementTransform?.elementId) return element;
      return interaction.elementTransform.mode === "move"
        ? moveElement(element, dx, dy)
        : resizeElementFromCorner(element, "se", dx, dy);
    });
    interaction.elementTransform.lastPoint = point;
    state.isDirty = true;
    fullRedrawStrokeCanvas(getCanvas(), state);
    drawSelectionOutline();
    return;
  }

  if (interaction.shapeStart && isShapeEditorTool(props.tool)) {
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
    drawShapePreview(ctx, props.tool, interaction.shapeStart, point);
    ctx.restore();
    return;
  }

  if (interaction.shapeStart) return;

  const point = eventPoint(e);
  const heightChanged = enginePointerMove(state, { ...point, canvasX: point.x, canvasY: point.y }, getCanvas());
  if (heightChanged) {
    resizeCanvases(bgCanvasRef.value!, strokeCanvasRef.value!, state);
    emit("heightChanged", state.canvasHeight);
    emitPageState();
  }
}

function onPointerUp(e: PointerEvent) {
  const vpResult = viewport.handlePointerUp(e);
  if (vpResult) return;

  // Long-press pending: user released before timer fired, cancel and fall through
  if (interaction.longPressPending) {
    cancelLongPressTimer();
    // Fall through to normal tool handling
  }

  // Long-press drag: finalize the drag
  if (interaction.longPressDrag) {
    const initialElements = interaction.longPressDrag.initialElements;
    interaction.longPressDrag = null;
    recordElementTransform("move", initialElements);
    updateUndoRedoState();
    emit("stroke");
    return;
  }

  if (props.tool === "lasso") {
    if (lasso.longPress) {
      const selected = lasso.longPress.selected;
      cancelLassoLongPress();
      if (selected) {
        updateUndoRedoState();
        return;
      }
    }
    if (lasso.resize) { lasso.resize = null; updateUndoRedoState(); emit("stroke"); return; }
    if (lasso.move) {
      const move = lasso.move;
      if (move.initialImage && move.startedAt != null && move.points && move.samples && props.recorder) {
        const element = state.elements.find((el): el is ImageElement => el.id === move.initialImage?.id && el.type === "image");
        if (element) {
          const event = {
            type: "imageTransform" as const,
            id: `lm-${Date.now()}`,
            timestamp: Date.now(),
            elementId: element.id,
            op: "move" as const,
            initialElement: move.initialImage,
            finalElement: element,
            points: move.points,
            samples: [...move.samples, createImageTransformSample(element, Date.now() - move.startedAt, move.points.at(-1))],
          };
          props.recorder.record(event);
          props.onLiveEvent?.(event);
        }
      }
      if (!move.initialImage) {
        recordElementTransform("move", move.initialElements);
      }
      lasso.move = null;
      updateUndoRedoState();
      emit("stroke");
      return;
    }
    if (lasso.path.length > 0) {
      lasso.selectedIds = findElementsInLasso(getSelectableElements(), lasso.path).map((el) => el.id);
      lasso.path = [];
      fullRedrawStrokeCanvas(getCanvas(), state);
      drawLassoSelectionOutline();
      updateUndoRedoState();
      return;
    }
    if (lasso.box) {
      lasso.selectedIds = findElementsInBoxSelection(getSelectableElements(), {
        x: lasso.box.start.x,
        y: lasso.box.start.y,
        width: lasso.box.current.x - lasso.box.start.x,
        height: lasso.box.current.y - lasso.box.start.y,
      }).map((el) => el.id);
      lasso.box = null;
      fullRedrawStrokeCanvas(getCanvas(), state);
      drawLassoSelectionOutline();
      updateUndoRedoState();
      return;
    }
  }

  if (interaction.imageTransform) {
    const imgTransform = interaction.imageTransform;
    const element = state.elements.find((el) => el.id === imgTransform.elementId);
    if (element && element.type === "image" && props.recorder) {
      const finalSample = createImageTransformSample(element, Date.now() - imgTransform.startedAt, imgTransform.points.at(-1));
      const event = {
        type: "imageTransform" as const,
        id: `it-${Date.now()}`,
        timestamp: Date.now(),
        elementId: imgTransform.elementId,
        op: imgTransform.mode,
        initialElement: imgTransform.initialElement,
        finalElement: element,
        points: imgTransform.points,
        samples: [...imgTransform.samples, finalSample],
      };
      props.recorder.record(event);
      props.onLiveEvent?.(event);
    }
    interaction.imageTransform = null;
    updateUndoRedoState();
    emit("stroke");
    return;
  }
  if (interaction.textMove) {
    const textMove = interaction.textMove;
    interaction.textMove = null;
    if (textMove.moved) {
      updateUndoRedoState();
      emit("stroke");
      return;
    }
    const element = state.elements.find((item) => item.id === textMove.elementId);
    if (element?.type === "text") {
      startEditText(element);
      redrawStrokeCanvasForEditing();
    }
    return;
  }
  if (interaction.elementTransform) { interaction.elementTransform = null; updateUndoRedoState(); emit("stroke"); return; }

  if (interaction.shapeStart && isShapeEditorTool(props.tool)) {
    const preset = props.toolPresets.pen;
    const end = eventPoint(e);
    if (Math.hypot(end.x - interaction.shapeStart.x, end.y - interaction.shapeStart.y) > 4) {
      const stroke = createShapeStrokeForTool(`shape-${Date.now()}`, props.tool, interaction.shapeStart, end, preset);
      pushHistorySnapshot(state);
      state.strokes.push(stroke);
      // Record replay event
      if (props.recorder) {
        const event = {
          type: "shape" as const,
          id: `re-${Date.now()}`,
          timestamp: Date.now(),
          stroke,
        };
        props.recorder.record(event);
        props.onLiveEvent?.(event);
      }
    }
    interaction.shapeStart = null;
    fullRedrawStrokeCanvas(getCanvas(), state);
    updateUndoRedoState();
    emit("stroke");
    return;
  }

  // Before enginePointerUp, capture pre-state for eraser detection
  const preStrokeIds = props.recorder && props.tool === "eraser"
    ? new Set(state.strokes.map((s) => s.id))
    : null;

  const completed = enginePointerUp(state);
  if (completed) {
    if (props.tool === "eraser" && props.toolPresets.eraser.mode === "stroke") {
      fullRedrawStrokeCanvas(getCanvas(), state);
    }
    updateUndoRedoState();
    emit("stroke");

    // Record replay event
    if (props.recorder) {
      if (props.tool === "eraser" && preStrokeIds) {
        const erasedIds = [...preStrokeIds].filter((id) => !state.strokes.some((s) => s.id === id));
        if (erasedIds.length > 0) {
          const event = {
            type: "erase" as const,
            id: `re-${Date.now()}`,
            timestamp: Date.now(),
            erasedIds,
          };
          props.recorder.record(event);
          props.onLiveEvent?.(event);
        }
        if (props.toolPresets.eraser.mode !== "stroke") {
          const lastStroke = state.strokes[state.strokes.length - 1];
          if (lastStroke?.tool === "eraser") {
            const event = {
              type: "stroke" as const,
              id: `re-${Date.now()}`,
              timestamp: Date.now(),
              stroke: lastStroke,
            };
            props.recorder.record(event);
            // 不广播 eraser 笔迹——viewer 不应看到橡皮的拖拽轨迹
          }
        }
      } else if (props.tool !== "eraser") {
        const lastStroke = state.strokes[state.strokes.length - 1];
        if (lastStroke) {
          const event = {
            type: "stroke" as const,
            id: `re-${Date.now()}`,
            timestamp: Date.now(),
            stroke: lastStroke,
          };
          props.recorder.record(event);
          props.onLiveEvent?.(event);
        }
      }
    }
  }
}

// ── Shape helpers ──

function createShapeStrokeForTool(id: string, tool: EditorTool, start: StrokePoint, end: StrokePoint, preset: ToolPresetCollection["pen"]): Stroke {
  if (tool === "line") return createLineStroke(id, start, end, preset);
  if (tool === "arrow") return createArrowStroke(id, start, end, preset);
  if (tool === "rectangle") return createRectangleStroke(id, start, end, preset);
  if (tool === "triangle") return createTriangleStroke(id, start, end, preset);
  return createEllipseStroke(id, start, end, preset);
}

function drawShapePreview(ctx: CanvasRenderingContext2D, tool: EditorTool, start: StrokePoint, end: StrokePoint): void {
  ctx.beginPath();
  if (tool === "line") {
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
  } else if (tool === "arrow") {
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const headLength = Math.max(12, Math.min(28, length * 0.25));
    const wingAngle = Math.PI / 7;
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.lineTo(end.x - Math.cos(angle - wingAngle) * headLength, end.y - Math.sin(angle - wingAngle) * headLength);
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - Math.cos(angle + wingAngle) * headLength, end.y - Math.sin(angle + wingAngle) * headLength);
  } else if (tool === "rectangle") {
    ctx.rect(Math.min(start.x, end.x), Math.min(start.y, end.y), Math.abs(end.x - start.x), Math.abs(end.y - start.y));
  } else if (tool === "ellipse") {
    ctx.ellipse((start.x + end.x) / 2, (start.y + end.y) / 2, Math.abs(end.x - start.x) / 2, Math.abs(end.y - start.y) / 2, 0, 0, Math.PI * 2);
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

// ── Undo/redo/page state ──

function updateUndoRedoState() {
  emit("update:canUndo", state.undoStack.length > 0);
  emit("update:canRedo", state.redoStack.length > 0);
}

function emitPageState() {
  const navigator = createPageNavigator(serializeState(state));
  const currentIndex = navigator.current?.index ?? 0;
  emit("pagesChanged", { current: currentIndex + 1, total: Math.max(1, navigator.pages.length) });
}

function redrawStrokeCanvasForEditing() {
  const hiddenElementIds = textEditor.value.show && textEditor.value.elementId
    ? new Set([textEditor.value.elementId])
    : undefined;
  fullRedrawStrokeCanvas(getCanvas(), state, { hiddenElementIds });
}

function cancelTextEditing() {
  cancelTextEditingBase();
  fullRedrawStrokeCanvas(getCanvas(), state);
}

// ── Lasso drawing helpers ──

function drawSelectionOutline() {
  if (!interaction.selectedElementId) return;
  const element = state.elements.find((item) => item.id === interaction.selectedElementId);
  if (!element) return;
  const ctx = getCanvas().getContext("2d")!;
  ctx.save();
  drawElementTransformOutline(ctx, element, true);
  ctx.restore();
}

function drawLassoPath() {
  if (lasso.path.length === 0) return;
  const ctx = getCanvas().getContext("2d")!;
  ctx.save();
  ctx.strokeStyle = "#2f80ed";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([7, 5]);
  ctx.beginPath();
  ctx.moveTo(lasso.path[0].x, lasso.path[0].y);
  for (const point of lasso.path.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.stroke();
  ctx.restore();
}

function drawLassoBox() {
  if (!lasso.box) return;
  const x = Math.min(lasso.box.start.x, lasso.box.current.x);
  const y = Math.min(lasso.box.start.y, lasso.box.current.y);
  const width = Math.abs(lasso.box.current.x - lasso.box.start.x);
  const height = Math.abs(lasso.box.current.y - lasso.box.start.y);
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
  const selected = getSelectableElements().filter((el) => lasso.selectedIds.includes(el.id));
  if (selected.length === 0) return;
  const bounds = getBoundsForElements(selected);
  const ctx = getCanvas().getContext("2d")!;
  ctx.save();
  for (const el of selected) drawElementTransformOutline(ctx, el, selected.length === 1 && el.type === "image");
  if (bounds && !getSingleSelectedImage()) {
    ctx.fillStyle = "#2f80ed";
    ctx.fillRect(bounds.x + bounds.width - LASSO_RESIZE_HANDLE_SIZE, bounds.y + bounds.height - LASSO_RESIZE_HANDLE_SIZE, LASSO_RESIZE_HANDLE_SIZE, LASSO_RESIZE_HANDLE_SIZE);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.strokeRect(bounds.x + bounds.width - LASSO_RESIZE_HANDLE_SIZE, bounds.y + bounds.height - LASSO_RESIZE_HANDLE_SIZE, LASSO_RESIZE_HANDLE_SIZE, LASSO_RESIZE_HANDLE_SIZE);
  }
  ctx.restore();
}

function drawElementTransformOutline(ctx: CanvasRenderingContext2D, element: SketchElement, withHandles: boolean) {
  const centerX = element.bounds.x + element.bounds.width / 2;
  const centerY = element.bounds.y + element.bounds.height / 2;
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(element.transform.rotation || 0);
  ctx.strokeStyle = "#2f80ed";
  ctx.lineWidth = 1.25;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(-element.bounds.width / 2, -element.bounds.height / 2, element.bounds.width, element.bounds.height);
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(47, 128, 237, 0.12)";
  ctx.fillRect(-element.bounds.width / 2, -element.bounds.height / 2, element.bounds.width, element.bounds.height);
  if (withHandles) {
    const halfHandle = 5;
    const corners = [
      [-element.bounds.width / 2, -element.bounds.height / 2],
      [element.bounds.width / 2, -element.bounds.height / 2],
      [-element.bounds.width / 2, element.bounds.height / 2],
      [element.bounds.width / 2, element.bounds.height / 2],
    ];
    ctx.fillStyle = "#2f80ed";
    for (const [x, y] of corners) ctx.fillRect(x - halfHandle, y - halfHandle, halfHandle * 2, halfHandle * 2);
    ctx.beginPath();
    ctx.moveTo(0, -element.bounds.height / 2);
    ctx.lineTo(0, -element.bounds.height / 2 - 32);
    ctx.strokeStyle = "#2f80ed";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -element.bounds.height / 2 - 32, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    const opacityX = -element.bounds.width / 2 - 28;
    const opacityY = -element.bounds.height / 2 - 28;
    ctx.beginPath();
    ctx.arc(opacityX, opacityY, 11, 0, Math.PI * 2);
    ctx.fillStyle = "#2f80ed";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(Math.round(((element.type === "image" ? element.opacity : 1) ?? 1) * 100)), opacityX, opacityY);
    const deleteX = element.bounds.width / 2 + 28;
    const deleteY = -element.bounds.height / 2 - 28;
    ctx.beginPath();
    ctx.arc(deleteX, deleteY, 9, 0, Math.PI * 2);
    ctx.fillStyle = "#e5484d";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(deleteX - 4, deleteY - 4);
    ctx.lineTo(deleteX + 4, deleteY + 4);
    ctx.moveTo(deleteX + 4, deleteY - 4);
    ctx.lineTo(deleteX - 4, deleteY + 4);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

function getBoundsForElements(elements: SketchElement[]): Bounds | null {
  if (elements.length === 0) return null;
  const minX = Math.min(...elements.map((el) => el.bounds.x));
  const minY = Math.min(...elements.map((el) => el.bounds.y));
  const maxX = Math.max(...elements.map((el) => el.bounds.x + el.bounds.width));
  const maxY = Math.max(...elements.map((el) => el.bounds.y + el.bounds.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function getLassoSelectionBounds(): Bounds | null {
  return getBoundsForElements(getSelectableElements().filter((el) => lasso.selectedIds.includes(el.id)));
}

function isPointInLassoResizeHandle(bounds: Bounds, point: StrokePoint): boolean {
  const left = bounds.x + bounds.width - LASSO_RESIZE_HANDLE_SIZE;
  const top = bounds.y + bounds.height - LASSO_RESIZE_HANDLE_SIZE;
  return point.x >= left && point.x <= bounds.x + bounds.width && point.y >= top && point.y <= bounds.y + bounds.height;
}

function getSingleSelectedImage(): SketchElement | null {
  if (lasso.selectedIds.length !== 1) return null;
  const element = state.elements.find((item) => item.id === lasso.selectedIds[0]);
  return element?.type === "image" ? element : null;
}

function startLassoLongPress(point: StrokePoint, elementId: string) {
  cancelLassoLongPress();
  const timer = window.setTimeout(() => {
    if (!lasso.longPress || lasso.longPress.elementId !== elementId) return;
    lasso.longPress.selected = true;
    lasso.selectedIds = [elementId];
    lasso.path = [];
    lasso.box = null;
    fullRedrawStrokeCanvas(getCanvas(), state);
    drawLassoSelectionOutline();
  }, LASSO_LONG_PRESS_MS);
  lasso.longPress = { point, elementId, timer, selected: false };
}

function cancelLassoLongPress() {
  if (!lasso.longPress) return;
  window.clearTimeout(lasso.longPress.timer);
  lasso.longPress = null;
}

function cancelLongPressTimer() {
  if (interaction.longPressTimer != null) {
    window.clearTimeout(interaction.longPressTimer);
    interaction.longPressTimer = null;
  }
  interaction.longPressPending = null;
}

function getSelectableElements() {
  const strokeElements = migrateStrokesToElements(state.strokes);
  const strokeIds = new Set(state.strokes.map((s) => s.id));
  return [
    ...strokeElements,
    ...state.elements.filter((el) => el.type !== "stroke" || !strokeIds.has(el.id)),
  ];
}

function clearInteractionState() {
  cancelLassoLongPress();
  cancelLongPressTimer();
  interaction.shapeStart = null;
  interaction.imageTransform = null;
  interaction.elementTransform = null;
  interaction.textMove = null;
  interaction.selectedElementId = null;
  interaction.longPressDrag = null;
  lasso.path = [];
  lasso.box = null;
  lasso.selectedIds = [];
  lasso.move = null;
  lasso.resize = null;
}

// ── Canvas double-click for text editing ──

function onCanvasDoubleClick(e: MouseEvent) {
  if (props.tool !== "text") return;
  const point = eventPoint(e as PointerEvent);
  const element = hitTestElement(
    state.elements.filter((item) => item.type === "text"),
    point.x,
    point.y,
  );
  if (!element || element.type !== "text") return;
  startEditText(element as any);
  redrawStrokeCanvasForEditing();
}

// ── Public API ──

function doUndo() {
  lasso.selectedIds = [];
  if (props.recorder) {
    props.recorder.undo();
  }
  engineUndo(state);
  fullRedrawStrokeCanvas(getCanvas(), state);
  updateUndoRedoState();
  emit("stroke");
}
function doRedo() {
  lasso.selectedIds = [];
  if (props.recorder) {
    props.recorder.redo();
  }
  engineRedo(state);
  fullRedrawStrokeCanvas(getCanvas(), state);
  updateUndoRedoState();
  emit("stroke");
}
function doClear() {
  lasso.selectedIds = [];
  if (props.recorder) {
    props.recorder.clear();
    props.recorder.clearHistory();
  }
  engineClear(state);
  fullRedrawStrokeCanvas(getCanvas(), state);
  updateUndoRedoState();
  emit("stroke");
}
function getData(): SketchData {
  const data = serializeState(state);
  if (props.recorder) {
    data.replayEvents = props.recorder.getEvents();
  }
  return data;
}
function getState(): EngineState { return state; }
function getPageOverviewItems() { return createPageOverviewItems(serializeState(state)); }

async function restoreData(data: SketchData) {
  if (!bgCanvasRef.value || !strokeCanvasRef.value) return;
  clearInteractionState();
  state = restoreEngineState(data);
  registerStateCallback(state);
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

function applyLiveEvent(event: { type: string; [key: string]: any }): void {
  if (!strokeCanvasRef.value) return;
  if (event.type === "stroke" || event.type === "shape") {
    state.strokes.push(event.stroke);
    const ctx = strokeCanvasRef.value.getContext("2d");
    if (ctx) renderStroke(ctx, event.stroke);
  } else if (event.type === "erase") {
    const erasedSet = new Set(event.erasedIds);
    state.strokes = state.strokes.filter((s) => !erasedSet.has(s.id));
    fullRedrawStrokeCanvas(strokeCanvasRef.value, state);
  }
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
  try { next = removeSketchPage(before, current.id); } catch { return false; }
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
  containerRef.value?.parentElement?.scrollTo({ top: page.y, behavior: "smooth" });
}

function deleteLassoSelection() {
  if (lasso.selectedIds.length === 0) return;
  pushHistorySnapshot(state);
  state.elements = removeLassoSelection(state.elements, lasso.selectedIds);
  state.strokes = removeStrokeSelection(state.strokes, lasso.selectedIds);
  lasso.selectedIds = [];
  state.isDirty = true;
  fullRedrawStrokeCanvas(getCanvas(), state);
  updateUndoRedoState();
  emit("stroke");
}

function getNextImageOpacity(opacity = 1): number {
  const steps = [1, 0.75, 0.5, 0.25];
  const currentIndex = steps.findIndex((step) => Math.abs(step - opacity) < 0.01);
  return steps[(currentIndex + 1) % steps.length];
}

function cycleImageOpacity(elementId: string) {
  const initial = state.elements.find((el): el is ImageElement => el.id === elementId && el.type === "image");
  if (!initial) return;
  pushHistorySnapshot(state);
  state.elements = state.elements.map((element) => {
    if (element.id !== elementId || element.type !== "image") return element;
    return {
      ...element,
      opacity: getNextImageOpacity(element.opacity ?? 1),
    };
  });
  state.isDirty = true;
  fullRedrawStrokeCanvas(getCanvas(), state);
  if (props.tool === "lasso") drawLassoSelectionOutline();
  else drawSelectionOutline();
  updateUndoRedoState();
  if (props.recorder) {
    const updated = state.elements.find((el) => el.id === elementId);
    if (updated && updated.type === "image") {
      const event = {
        type: "imageTransform" as const,
        id: `io-${Date.now()}`,
        timestamp: Date.now(),
        elementId,
        op: "opacity" as const,
        initialElement: initial,
        finalElement: updated,
        samples: [
          createImageTransformSample(initial, 0),
          createImageTransformSample(updated, 120),
        ],
      };
      props.recorder.record(event);
      props.onLiveEvent?.(event);
    }
  }
  emit("stroke");
}

function recolorLasso(color: string) {
  if (lasso.selectedIds.length === 0) return;
  pushHistorySnapshot(state);
  state.elements = recolorLassoSelection(state.elements, lasso.selectedIds, color);
  state.strokes = recolorStrokeSelection(state.strokes, lasso.selectedIds, color);
  state.isDirty = true;
  fullRedrawStrokeCanvas(getCanvas(), state);
  drawLassoSelectionOutline();
  updateUndoRedoState();
  emit("stroke");
}

function duplicateLassoSelection() {
  if (lasso.selectedIds.length === 0) return;
  const copiedIds = lasso.selectedIds.map((id) => `copy-${Date.now()}-${id}`);
  const idByOriginal = new Map(lasso.selectedIds.map((id, index) => [id, copiedIds[index]]));
  const createCopyId = (id: string) => idByOriginal.get(id) ?? `copy-${Date.now()}-${id}`;
  pushHistorySnapshot(state);
  state.elements = duplicateLassoElements(state.elements, lasso.selectedIds, LASSO_DUPLICATE_OFFSET, LASSO_DUPLICATE_OFFSET, createCopyId);
  state.strokes = duplicateStrokeSelection(state.strokes, lasso.selectedIds, LASSO_DUPLICATE_OFFSET, LASSO_DUPLICATE_OFFSET, createCopyId);
  lasso.selectedIds = copiedIds;
  state.isDirty = true;
  fullRedrawStrokeCanvas(getCanvas(), state);
  drawLassoSelectionOutline();
  updateUndoRedoState();
  emit("stroke");
}

async function insertImage(src: string, options: { source?: ReplayToolSource; loadingMs?: number } = {}) {
  const image = await preloadImage(src);
  const elementSize = fitImageElementSize({
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
  });
  const position = createInsertElementPosition({
    canvasWidth: state.canvasWidth,
    pageMode: state.pageMode,
    activePageId: state.activePageId,
    pages: state.pages,
    elementWidth: elementSize.width,
    topOffset: 140,
  });
  const element = createImageElement(`image-${Date.now()}`, {
    x: position.x,
    y: position.y,
    src,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
  });
  pushHistorySnapshot(state);
  state.elements = [...state.elements, element];
  fullRedrawStrokeCanvas(getCanvas(), state);
  updateUndoRedoState();
  // Record replay event
  if (props.recorder) {
    const event = {
      type: "image" as const,
      id: `re-${Date.now()}`,
      timestamp: Date.now(),
      element,
      source: options.source,
      loadingMs: options.loadingMs,
    };
    props.recorder.record(event);
    props.onLiveEvent?.(event);
  }
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

// ── Keyboard move selection ──

let keyboardMoveActive = false;
let keyboardMoveInitialElements: SketchElement[] = [];

function moveSelectionByKeyboard(dx: number, dy: number) {
  if (lasso.selectedIds.length === 0) return;
  if (!keyboardMoveActive) {
    pushHistorySnapshot(state);
    keyboardMoveInitialElements = getSelectedReplayElements(lasso.selectedIds);
    keyboardMoveActive = true;
  }
  state.elements = translateLassoSelection(state.elements, lasso.selectedIds, dx, dy);
  state.strokes = translateStrokeSelection(state.strokes, lasso.selectedIds, dx, dy);
  state.isDirty = true;
  fullRedrawStrokeCanvas(getCanvas(), state);
  drawLassoSelectionOutline();
}

function finishKeyboardMove() {
  if (!keyboardMoveActive) return;
  keyboardMoveActive = false;
  recordElementTransform("move", keyboardMoveInitialElements);
  keyboardMoveInitialElements = [];
  updateUndoRedoState();
  emit("stroke");
}

defineExpose({
  doUndo,
  doRedo,
  doClear,
  getData,
  getState,
  getPageOverviewItems,
  insertText: () => insertText(state),
  insertImage,
  restoreData,
  applyLiveEvent,
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
  moveSelectionByKeyboard,
  finishKeyboardMove,
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
  background: transparent;
  border: 0;
  border-radius: 2px;
  padding: 0;
  min-width: 150px;
  box-shadow: none;
  outline: 1px solid var(--b3-theme-primary, #2f80ed);
  font-weight: 500;
  resize: none;
  overflow: hidden;
  white-space: pre-wrap;
  word-wrap: break-word;
}

/* ── 浮动缩放指示器 ── */
.zoom-indicator {
  position: fixed;
  top: calc(var(--sketch-editor-header-top, 12px) + var(--sketch-editor-header-height, 92px) + var(--sketch-editor-floating-gap, 16px));
  left: 50%;
  transform: translateX(-50%);
  z-index: 1100;
  display: flex;
  align-items: center;
  gap: 6px;
  width: max-content;
  padding: 5px 8px;
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
  min-width: 4ch;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.zoom-indicator__lock {
  appearance: none;
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #fff;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  font-size: 14px;
  padding: 0;
  border-radius: 6px;
  transition: background 0.15s ease;
  line-height: 1;
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

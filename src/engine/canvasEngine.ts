import type { Stroke, StrokePoint, SketchTool, SketchData, ToolPresetCollection } from "@/types/sketch";
import {
  CANVAS_LOGICAL_WIDTH,
  CANVAS_HEIGHT_INCREMENT,
} from "@/types/sketch";
import { getTemplate } from "@/template";
import { normalizeToolPresets } from "@/tools/presets";
import { migrateStrokesToElements, withStrokeBounds } from "@/elements/model";
import type { SketchElement } from "@/elements/model";
import { splitElementsForRender } from "@/elements/renderOrder";
import {
  filterStrokePointsByDistance,
  getPressureWidth,
  getSmoothedSegments,
} from "./strokeSmoothing";

let idCounter = 0;
const MIN_POINT_DISTANCE = 1.5;
const ERASER_HIT_PADDING = 2;
const imageCache = new Map<string, HTMLImageElement>();
function newId(): string {
  return `s${Date.now()}-${++idCounter}`;
}

export interface EngineState {
  strokes: Stroke[];
  elements: SketchElement[];
  currentStroke: Stroke | null;
  undoStack: EngineSnapshot[];
  redoStack: EngineSnapshot[];
  tool: SketchTool;
  toolPresets: ToolPresetCollection;
  canvasWidth: number;
  canvasHeight: number;
  templateId: string;
  isDirty: boolean;
}

export interface EngineSnapshot {
  strokes: Stroke[];
  elements: SketchElement[];
}

export function createEngineState(
  templateId: string,
  canvasWidth = CANVAS_LOGICAL_WIDTH,
  canvasHeight = 1200
): EngineState {
  return {
    strokes: [],
    elements: [],
    currentStroke: null,
    undoStack: [],
    redoStack: [],
    tool: "pen",
    toolPresets: normalizeToolPresets(),
    canvasWidth,
    canvasHeight,
    templateId,
    isDirty: false,
  };
}

export function restoreEngineState(data: SketchData): EngineState {
  return {
    strokes: [...data.strokes],
    elements: data.elements ?? migrateStrokesToElements(data.strokes),
    currentStroke: null,
    undoStack: [],
    redoStack: [],
    tool: "pen",
    toolPresets: normalizeToolPresets(data.toolPresets),
    canvasWidth: data.canvasWidth,
    canvasHeight: data.canvasHeight,
    templateId: data.template,
    isDirty: false,
  };
}

export async function preloadElementImages(elements: SketchElement[]): Promise<void> {
  const imageSources = elements
    .filter((element) => element.type === "image")
    .map((element) => element.src);

  await Promise.all(imageSources.map((src) => preloadImage(src)));
}

export function preloadImage(src: string): Promise<void> {
  const cached = imageCache.get(src);
  if (cached?.complete) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      imageCache.set(src, image);
      resolve();
    };
    image.onerror = () => reject(new Error("Failed to load image element"));
    image.src = src;
  });
}

export function pushHistorySnapshot(state: EngineState): void {
  state.undoStack.push(createSnapshot(state));
  state.redoStack = [];
}

function createSnapshot(state: EngineState): EngineSnapshot {
  return {
    strokes: [...state.strokes],
    elements: state.elements.map((element) => ({ ...element, bounds: { ...element.bounds } })),
  };
}

function restoreSnapshot(state: EngineState, snapshot: EngineSnapshot): void {
  state.strokes = [...snapshot.strokes];
  state.elements = snapshot.elements.map((element) => ({ ...element, bounds: { ...element.bounds } }));
}

export function setupBackgroundCanvas(
  canvas: HTMLCanvasElement,
  state: EngineState
): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = state.canvasWidth * dpr;
  canvas.height = state.canvasHeight * dpr;
  canvas.style.width = `${state.canvasWidth}px`;
  canvas.style.height = `${state.canvasHeight}px`;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  const template = getTemplate(state.templateId);
  template.render(ctx, state.canvasWidth, state.canvasHeight);
}

export function setupStrokeCanvas(
  canvas: HTMLCanvasElement,
  state: EngineState
): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = state.canvasWidth * dpr;
  canvas.height = state.canvasHeight * dpr;
  canvas.style.width = `${state.canvasWidth}px`;
  canvas.style.height = `${state.canvasHeight}px`;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  const layers = splitElementsForRender(state.elements);
  renderNonStrokeElements(ctx, layers.background);
  for (const stroke of state.strokes) {
    renderStroke(ctx, stroke);
  }
  renderNonStrokeElements(ctx, layers.foreground);
}

export function handlePointerDown(
  state: EngineState,
  e: PointerEvent,
  canvas: HTMLCanvasElement
): void {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const preset = state.toolPresets[state.tool];
  state.currentStroke = {
    id: newId(),
    points: [{ x, y, pressure: e.pressure || 0.5, timestamp: e.timeStamp }],
    color: state.tool === "eraser" ? "#000000" : preset.color,
    width: preset.width,
    opacity: preset.opacity,
    tool: state.tool,
  };
}

export function handlePointerMove(
  state: EngineState,
  e: PointerEvent,
  canvas: HTMLCanvasElement
): boolean {
  if (!state.currentStroke) return false;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const lastPoint = state.currentStroke.points[state.currentStroke.points.length - 1];
  const nextPoint = { x, y, pressure: e.pressure || 0.5, timestamp: e.timeStamp };
  if (Math.hypot(lastPoint.x - x, lastPoint.y - y) < MIN_POINT_DISTANCE) {
    return false;
  }
  state.currentStroke.points.push(nextPoint);

  let heightChanged = false;
  if (y > state.canvasHeight - 100) {
    state.canvasHeight += CANVAS_HEIGHT_INCREMENT;
    heightChanged = true;
  }

  const ctx = canvas.getContext("2d")!;
  const pts = state.currentStroke.points;
  if (pts.length >= 2) {
    const prev = pts[pts.length - 2];
    const curr = pts[pts.length - 1];
    renderStrokeSegment(ctx, state.currentStroke, prev, curr);
  }
  return heightChanged;
}

export function handlePointerUp(state: EngineState): boolean {
  if (!state.currentStroke) return false;
  state.currentStroke.points = filterStrokePointsByDistance(state.currentStroke.points, MIN_POINT_DISTANCE);
  if (state.currentStroke.tool === "eraser" && state.toolPresets.eraser.mode === "stroke") {
    const hitIds = findStrokeEraseHits(state.strokes, state.currentStroke);
    state.currentStroke = null;
    if (hitIds.size === 0) return false;
    pushHistorySnapshot(state);
    state.strokes = state.strokes.filter((stroke) => !hitIds.has(stroke.id));
    state.isDirty = true;
    return true;
  }
  pushHistorySnapshot(state);
  state.strokes.push(withStrokeBounds(state.currentStroke));
  state.currentStroke = null;
  state.isDirty = true;
  return true;
}

export function undo(state: EngineState): boolean {
  if (state.undoStack.length === 0) return false;
  state.redoStack.push(createSnapshot(state));
  restoreSnapshot(state, state.undoStack.pop()!);
  state.isDirty = true;
  return true;
}

export function redo(state: EngineState): boolean {
  if (state.redoStack.length === 0) return false;
  state.undoStack.push(createSnapshot(state));
  restoreSnapshot(state, state.redoStack.pop()!);
  state.isDirty = true;
  return true;
}

export function clearAll(state: EngineState): void {
  if (state.strokes.length === 0 && state.elements.length === 0) return;
  pushHistorySnapshot(state);
  state.strokes = [];
  state.elements = [];
  state.isDirty = true;
}

export function fullRedrawStrokeCanvas(
  canvas: HTMLCanvasElement,
  state: EngineState
): void {
  const ctx = canvas.getContext("2d")!;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  const layers = splitElementsForRender(state.elements);
  renderNonStrokeElements(ctx, layers.background);
  for (const stroke of state.strokes) {
    renderStroke(ctx, stroke);
  }
  renderNonStrokeElements(ctx, layers.foreground);
}

export function resizeCanvases(
  bgCanvas: HTMLCanvasElement,
  strokeCanvas: HTMLCanvasElement,
  state: EngineState
): void {
  setupBackgroundCanvas(bgCanvas, state);
  setupStrokeCanvas(strokeCanvas, state);
}

export function serializeState(state: EngineState): SketchData {
  const strokes = state.strokes.map(withStrokeBounds);
  return {
    version: 1,
    template: state.templateId,
    canvasWidth: state.canvasWidth,
    canvasHeight: state.canvasHeight,
    toolPresets: state.toolPresets,
    elements: [
      ...migrateStrokesToElements(strokes),
      ...state.elements.filter((element) => element.type !== "stroke"),
    ],
    strokes,
  };
}

function renderNonStrokeElements(ctx: CanvasRenderingContext2D, elements: SketchElement[]): void {
  for (const element of elements) {
    if (element.type === "image") {
      renderImageElement(ctx, element);
      continue;
    }
    if (element.type !== "text") continue;
    ctx.save();
    ctx.fillStyle = element.style.color;
    ctx.font = `${element.style.fontSize}px ${element.style.fontFamily}`;
    ctx.textBaseline = "top";
    ctx.fillText(element.text, element.bounds.x, element.bounds.y, element.bounds.width);
    ctx.restore();
  }
}

function renderImageElement(ctx: CanvasRenderingContext2D, element: Extract<SketchElement, { type: "image" }>): void {
  const image = imageCache.get(element.src);
  if (image?.complete) {
    ctx.drawImage(
      image,
      element.bounds.x,
      element.bounds.y,
      element.bounds.width,
      element.bounds.height,
    );
    return;
  }

  ctx.save();
  ctx.fillStyle = "#f4f4f4";
  ctx.strokeStyle = "#c8c8c8";
  ctx.lineWidth = 1;
  ctx.fillRect(element.bounds.x, element.bounds.y, element.bounds.width, element.bounds.height);
  ctx.strokeRect(element.bounds.x, element.bounds.y, element.bounds.width, element.bounds.height);
  ctx.restore();
}

function renderStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const { points, color, width, tool } = stroke;
  if (points.length < 2) return;
  ctx.save();
  if (tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
  } else {
    ctx.globalAlpha = stroke.opacity ?? 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = color;
  }
  ctx.lineWidth = getPressureWidth(width, points[0].pressure);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const segment of getSmoothedSegments(points)) {
    ctx.quadraticCurveTo(
      segment.control.x,
      segment.control.y,
      segment.end.x,
      segment.end.y,
    );
  }
  ctx.stroke();
  ctx.restore();
}

function renderStrokeSegment(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  prev: StrokePoint,
  curr: StrokePoint,
): void {
  ctx.save();
  if (stroke.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
  } else {
    ctx.globalAlpha = stroke.opacity ?? 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = stroke.color;
  }
  ctx.lineWidth = getPressureWidth(stroke.width, curr.pressure);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(prev.x, prev.y);
  ctx.lineTo(curr.x, curr.y);
  ctx.stroke();
  ctx.restore();
}

function findStrokeEraseHits(strokes: Stroke[], eraserStroke: Stroke): Set<string> {
  const hitIds = new Set<string>();
  const threshold = eraserStroke.width / 2 + ERASER_HIT_PADDING;

  for (const stroke of strokes) {
    if (stroke.tool === "eraser") continue;
    if (doesEraserHitStroke(eraserStroke.points, stroke, threshold + stroke.width / 2)) {
      hitIds.add(stroke.id);
    }
  }

  return hitIds;
}

function doesEraserHitStroke(eraserPoints: StrokePoint[], stroke: Stroke, threshold: number): boolean {
  for (const eraserPoint of eraserPoints) {
    if (stroke.points.length === 1) {
      if (distance(eraserPoint, stroke.points[0]) <= threshold) return true;
      continue;
    }

    for (let index = 1; index < stroke.points.length; index += 1) {
      if (distanceToSegment(eraserPoint, stroke.points[index - 1], stroke.points[index]) <= threshold) {
        return true;
      }
    }
  }

  return false;
}

function distance(a: StrokePoint, b: StrokePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distanceToSegment(point: StrokePoint, start: StrokePoint, end: StrokePoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return distance(point, start);

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

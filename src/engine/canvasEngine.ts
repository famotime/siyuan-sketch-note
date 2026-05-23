import type { Stroke, StrokePoint, SketchTool, SketchData } from "@/types/sketch";
import {
  DEFAULT_PEN_WIDTH,
  DEFAULT_ERASER_WIDTH,
  CANVAS_LOGICAL_WIDTH,
  CANVAS_HEIGHT_INCREMENT,
} from "@/types/sketch";
import { getTemplate } from "@/template";

let idCounter = 0;
function newId(): string {
  return `s${Date.now()}-${++idCounter}`;
}

export interface EngineState {
  strokes: Stroke[];
  currentStroke: Stroke | null;
  undoStack: Stroke[][];
  redoStack: Stroke[][];
  tool: SketchTool;
  color: string;
  penWidth: number;
  eraserWidth: number;
  canvasWidth: number;
  canvasHeight: number;
  templateId: string;
  isDirty: boolean;
}

export function createEngineState(
  templateId: string,
  canvasWidth = CANVAS_LOGICAL_WIDTH,
  canvasHeight = 1200
): EngineState {
  return {
    strokes: [],
    currentStroke: null,
    undoStack: [],
    redoStack: [],
    tool: "pen",
    color: "#000000",
    penWidth: DEFAULT_PEN_WIDTH,
    eraserWidth: DEFAULT_ERASER_WIDTH,
    canvasWidth,
    canvasHeight,
    templateId,
    isDirty: false,
  };
}

export function restoreEngineState(data: SketchData): EngineState {
  return {
    strokes: [...data.strokes],
    currentStroke: null,
    undoStack: [],
    redoStack: [],
    tool: "pen",
    color: "#000000",
    penWidth: DEFAULT_PEN_WIDTH,
    eraserWidth: DEFAULT_ERASER_WIDTH,
    canvasWidth: data.canvasWidth,
    canvasHeight: data.canvasHeight,
    templateId: data.template,
    isDirty: false,
  };
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
  for (const stroke of state.strokes) {
    renderStroke(ctx, stroke);
  }
}

export function handlePointerDown(
  state: EngineState,
  e: PointerEvent,
  canvas: HTMLCanvasElement
): void {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  state.currentStroke = {
    id: newId(),
    points: [{ x, y, pressure: e.pressure || 0.5, timestamp: e.timeStamp }],
    color: state.tool === "eraser" ? "#000000" : state.color,
    width: state.tool === "eraser" ? state.eraserWidth : state.penWidth,
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
  state.currentStroke.points.push({ x, y, pressure: e.pressure || 0.5, timestamp: e.timeStamp });

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
    ctx.save();
    if (state.currentStroke.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = state.currentStroke.color;
    }
    ctx.lineWidth = state.currentStroke.width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.stroke();
    ctx.restore();
  }
  return heightChanged;
}

export function handlePointerUp(state: EngineState): boolean {
  if (!state.currentStroke) return false;
  state.undoStack.push([...state.strokes]);
  state.redoStack = [];
  state.strokes.push(state.currentStroke);
  state.currentStroke = null;
  state.isDirty = true;
  return true;
}

export function undo(state: EngineState): boolean {
  if (state.undoStack.length === 0) return false;
  state.redoStack.push([...state.strokes]);
  state.strokes = state.undoStack.pop()!;
  state.isDirty = true;
  return true;
}

export function redo(state: EngineState): boolean {
  if (state.redoStack.length === 0) return false;
  state.undoStack.push([...state.strokes]);
  state.strokes = state.redoStack.pop()!;
  state.isDirty = true;
  return true;
}

export function clearAll(state: EngineState): void {
  if (state.strokes.length === 0) return;
  state.undoStack.push([...state.strokes]);
  state.redoStack = [];
  state.strokes = [];
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
  for (const stroke of state.strokes) {
    renderStroke(ctx, stroke);
  }
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
  return {
    version: 1,
    template: state.templateId,
    canvasWidth: state.canvasWidth,
    canvasHeight: state.canvasHeight,
    strokes: state.strokes,
    thumbnail: null,
  };
}

function renderStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const { points, color, width, tool } = stroke;
  if (points.length < 2) return;
  ctx.save();
  if (tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = color;
  }
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
  ctx.restore();
}
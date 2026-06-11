import type { SketchData, Stroke } from "@/types/sketch";
import type { LiveSupportedEvent } from "./types";
import { renderStroke } from "@/engine/strokeRenderer";

export interface ViewerRenderer {
  canvas: HTMLCanvasElement;
  state: ViewerState;
}

export interface ViewerState {
  strokes: Stroke[];
  canvasWidth: number;
  canvasHeight: number;
}

export function createViewerRenderer(canvas: HTMLCanvasElement): ViewerRenderer {
  return {
    canvas,
    state: {
      strokes: [],
      canvasWidth: 800,
      canvasHeight: 1200,
    },
  };
}

export function applySnapshot(renderer: ViewerRenderer, data: SketchData): void {
  renderer.state.strokes = [...data.strokes];
  renderer.state.canvasWidth = data.canvasWidth;
  renderer.state.canvasHeight = data.canvasHeight;
  fullRedraw(renderer);
}

export function applyEvent(renderer: ViewerRenderer, event: LiveSupportedEvent): void {
  switch (event.type) {
    case "stroke":
    case "shape":
      renderer.state.strokes.push(event.stroke);
      renderStroke(renderer.canvas.getContext("2d")!, event.stroke);
      break;

    case "erase": {
      const erasedSet = new Set(event.erasedIds);
      renderer.state.strokes = renderer.state.strokes.filter(
        (s) => !erasedSet.has(s.id),
      );
      fullRedraw(renderer);
      break;
    }
  }
}

export function clearViewer(renderer: ViewerRenderer): void {
  renderer.state.strokes = [];
  const ctx = renderer.canvas.getContext("2d");
  if (ctx) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, renderer.canvas.width, renderer.canvas.height);
    ctx.restore();
  }
}

function fullRedraw(renderer: ViewerRenderer): void {
  const ctx = renderer.canvas.getContext("2d");
  if (!ctx) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, renderer.canvas.width, renderer.canvas.height);
  ctx.restore();
  for (const stroke of renderer.state.strokes) {
    renderStroke(ctx, stroke);
  }
}

import { CANVAS_LOGICAL_WIDTH } from "@/types/sketch";
import { getTemplate } from "@/template";
import type { Stroke } from "@/types/sketch";

const THUMBNAIL_WIDTH = CANVAS_LOGICAL_WIDTH;

/**
 * Render strokes to a PNG data URL for thumbnail display.
 * Uses a separate offscreen canvas at logical resolution.
 */
export function thumbnailCanvas(
  strokes: Stroke[],
  templateId: string,
  canvasHeight: number
): string {
  const width = THUMBNAIL_WIDTH;
  const height = canvasHeight;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // Render template background
  const template = getTemplate(templateId);
  template.render(ctx, width, height);

  // Render all strokes
  for (const stroke of strokes) {
    renderStrokeToCtx(ctx, stroke);
  }

  return canvas.toDataURL("image/png");
}

function renderStrokeToCtx(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
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

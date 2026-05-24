import { getTemplate } from "@/template";
import type { Stroke } from "@/types/sketch";

const PADDING = 40;
const MIN_WIDTH = 200;
const MIN_HEIGHT = 150;

/**
 * Calculate the bounding box of all strokes, with padding.
 * Returns null if there are no strokes.
 */
function strokesBounds(strokes: Stroke[]): { x: number; y: number; w: number; h: number } | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const stroke of strokes) {
    const halfW = stroke.width / 2;
    for (const pt of stroke.points) {
      minX = Math.min(minX, pt.x - halfW);
      minY = Math.min(minY, pt.y - halfW);
      maxX = Math.max(maxX, pt.x + halfW);
      maxY = Math.max(maxY, pt.y + halfW);
    }
  }

  if (minX === Infinity) return null;

  return {
    x: minX - PADDING,
    y: minY - PADDING,
    w: maxX - minX + PADDING * 2,
    h: maxY - minY + PADDING * 2,
  };
}

/**
 * Render strokes to a PNG data URL.
 * Canvas size is determined by the actual stroke bounding box + padding,
 * rather than the full editing canvas size.
 */
export function thumbnailCanvas(
  strokes: Stroke[],
  templateId: string,
  _canvasHeight: number
): string {
  const bounds = strokesBounds(strokes);

  const width = bounds ? Math.max(Math.ceil(bounds.w), MIN_WIDTH) : MIN_WIDTH;
  const height = bounds ? Math.max(Math.ceil(bounds.h), MIN_HEIGHT) : MIN_HEIGHT;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // Render template background at the output size
  const template = getTemplate(templateId);
  template.render(ctx, width, height);

  // Translate so that the stroke bounding box origin maps to (0, 0)
  if (bounds) {
    ctx.save();
    ctx.translate(-bounds.x, -bounds.y);
    for (const stroke of strokes) {
      renderStrokeToCtx(ctx, stroke);
    }
    ctx.restore();
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

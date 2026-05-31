import type { Stroke, StrokePoint } from "@/types/sketch";
import { resolveBrushProfile } from "@/tools/brushProfiles";
import {
  getBrushOpacity,
  getBrushPressureWidth,
  getSmoothedSegments,
} from "./strokeSmoothing";

export function renderStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const { points, color, width, tool, isShape } = stroke;
  if (points.length < 2) return;
  const profile = resolveBrushProfile(stroke.brushProfileId, stroke.tool, {
    tool: stroke.tool,
    penSubtype: stroke.penSubtype,
    highlighterSubtype: stroke.highlighterSubtype,
  });
  ctx.save();
  if (tool === "eraser") {
    ctx.globalCompositeOperation = profile.blendMode;
    ctx.strokeStyle = "rgba(0,0,0,1)";
  } else {
    ctx.globalAlpha = getBrushOpacity(stroke.opacity ?? 1, points[0].pressure, profile);
    ctx.globalCompositeOperation = profile.blendMode;
    ctx.strokeStyle = color;
  }
  ctx.lineJoin = profile.lineJoin;
  ctx.lineCap = profile.lineCap;

  const firstPressure = points[0].pressure;
  const allSame = points.every((p) => p.pressure === firstPressure);

  if (isShape) {
    ctx.lineWidth = getBrushPressureWidth(width, firstPressure, profile);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
  } else if (allSame) {
    ctx.lineWidth = getBrushPressureWidth(width, firstPressure, profile);
    if (tool !== "eraser") {
      ctx.globalAlpha = getBrushOpacity(stroke.opacity ?? 1, firstPressure, profile);
    }
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
  } else {
    const segments = getSmoothedSegments(points);
    let currentX = points[0].x;
    let currentY = points[0].y;
    for (const segment of segments) {
      ctx.lineWidth = getBrushPressureWidth(width, segment.control.pressure, profile);
      if (tool !== "eraser") {
        ctx.globalAlpha = getBrushOpacity(stroke.opacity ?? 1, segment.control.pressure, profile);
      }
      ctx.beginPath();
      ctx.moveTo(currentX, currentY);
      ctx.quadraticCurveTo(
        segment.control.x,
        segment.control.y,
        segment.end.x,
        segment.end.y,
      );
      ctx.stroke();
      currentX = segment.end.x;
      currentY = segment.end.y;
    }
  }
  ctx.restore();
}

export function renderStrokeSegment(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  prev: StrokePoint,
  curr: StrokePoint,
): void {
  const profile = resolveBrushProfile(stroke.brushProfileId, stroke.tool, {
    tool: stroke.tool,
    penSubtype: stroke.penSubtype,
    highlighterSubtype: stroke.highlighterSubtype,
  });
  ctx.save();
  if (stroke.tool === "eraser") {
    ctx.globalCompositeOperation = profile.blendMode;
    ctx.strokeStyle = "rgba(0,0,0,1)";
  } else {
    ctx.globalAlpha = getBrushOpacity(stroke.opacity ?? 1, curr.pressure, profile);
    ctx.globalCompositeOperation = profile.blendMode;
    ctx.strokeStyle = stroke.color;
  }
  ctx.lineWidth = getBrushPressureWidth(stroke.width, curr.pressure, profile);
  ctx.lineJoin = profile.lineJoin;
  ctx.lineCap = profile.lineCap;
  ctx.beginPath();
  ctx.moveTo(prev.x, prev.y);
  ctx.lineTo(curr.x, curr.y);
  ctx.stroke();
  ctx.restore();
}

import type { Bounds, Transform } from "./model";
import { withStrokeBounds } from "./model";
import type { Stroke, StrokePoint, ToolPreset } from "@/types/sketch";

export interface Point {
  x: number;
  y: number;
}

export interface ShapeStyle {
  color: string;
  width: number;
  opacity: number;
}

export interface ShapeElement {
  id: string;
  type: "shape";
  shape: "line" | "arrow" | "rectangle" | "ellipse" | "triangle";
  start: Point;
  end: Point;
  style: ShapeStyle;
  bounds: Bounds;
  transform: Transform;
  zIndex: number;
}

function defaultTransform(): Transform {
  return {
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
  };
}

function boundsFromPoints(start: Point, end: Point, strokeWidth: number): Bounds {
  const halfWidth = strokeWidth / 2;
  const minX = Math.min(start.x, end.x) - halfWidth;
  const minY = Math.min(start.y, end.y) - halfWidth;
  const maxX = Math.max(start.x, end.x) + halfWidth;
  const maxY = Math.max(start.y, end.y) + halfWidth;
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function createShape(
  id: string,
  shape: ShapeElement["shape"],
  start: Point,
  end: Point,
  style: ShapeStyle,
): ShapeElement {
  return {
    id,
    type: "shape",
    shape,
    start,
    end,
    style,
    bounds: boundsFromPoints(start, end, style.width),
    transform: defaultTransform(),
    zIndex: 0,
  };
}

export function createLineShape(
  id: string,
  start: Point,
  end: Point,
  style: ShapeStyle,
): ShapeElement {
  return createShape(id, "line", start, end, style);
}

export function createArrowShape(
  id: string,
  start: Point,
  end: Point,
  style: ShapeStyle,
): ShapeElement {
  return createShape(id, "arrow", start, end, style);
}

export function createRectangleShape(
  id: string,
  start: Point,
  end: Point,
  style: ShapeStyle,
): ShapeElement {
  return createShape(id, "rectangle", start, end, style);
}

export function createEllipseShape(
  id: string,
  start: Point,
  end: Point,
  style: ShapeStyle,
): ShapeElement {
  return createShape(id, "ellipse", start, end, style);
}

export function createTriangleShape(
  id: string,
  start: Point,
  end: Point,
  style: ShapeStyle,
): ShapeElement {
  return createShape(id, "triangle", start, end, style);
}

export function getShapeBounds(shape: ShapeElement): Bounds {
  return boundsFromPoints(shape.start, shape.end, shape.style.width);
}

function strokePoint(point: Point, timestamp: number): StrokePoint {
  return {
    x: point.x,
    y: point.y,
    pressure: 0.5,
    timestamp,
  };
}

function createShapeStroke(
  id: string,
  points: Point[],
  preset: ToolPreset,
): Stroke {
  return withStrokeBounds({
    id,
    points: points.map((point, index) => strokePoint(point, index)),
    color: preset.color,
    width: preset.width,
    opacity: preset.opacity,
    tool: "pen",
  });
}

export function createLineStroke(
  id: string,
  start: Point,
  end: Point,
  preset: ToolPreset,
): Stroke {
  return createShapeStroke(id, [start, end], preset);
}

export function createArrowStroke(
  id: string,
  start: Point,
  end: Point,
  preset: ToolPreset,
): Stroke {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const headLength = Math.max(12, Math.min(28, length * 0.25));
  const wingAngle = Math.PI / 7;
  const left = {
    x: end.x - Math.cos(angle - wingAngle) * headLength,
    y: end.y - Math.sin(angle - wingAngle) * headLength,
  };
  const right = {
    x: end.x - Math.cos(angle + wingAngle) * headLength,
    y: end.y - Math.sin(angle + wingAngle) * headLength,
  };

  return createShapeStroke(id, [
    start,
    end,
    left,
    end,
    right,
    end,
  ], preset);
}

export function createRectangleStroke(
  id: string,
  start: Point,
  end: Point,
  preset: ToolPreset,
): Stroke {
  return createShapeStroke(id, [
    start,
    { x: end.x, y: start.y },
    end,
    { x: start.x, y: end.y },
    start,
  ], preset);
}

export function createTriangleStroke(
  id: string,
  start: Point,
  end: Point,
  preset: ToolPreset,
): Stroke {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  const top = {
    x: (minX + maxX) / 2,
    y: minY,
  };
  const right = {
    x: maxX,
    y: maxY,
  };
  const left = {
    x: minX,
    y: maxY,
  };
  return createShapeStroke(id, [top, right, left, top], preset);
}

export function createEllipseStroke(
  id: string,
  start: Point,
  end: Point,
  preset: ToolPreset,
): Stroke {
  const center = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
  const radiusX = Math.abs(end.x - start.x) / 2;
  const radiusY = Math.abs(end.y - start.y) / 2;
  const points: Point[] = [];
  const steps = 32;
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    points.push({
      x: center.x + Math.cos(angle) * radiusX,
      y: center.y + Math.sin(angle) * radiusY,
    });
  }
  return createShapeStroke(id, points, preset);
}

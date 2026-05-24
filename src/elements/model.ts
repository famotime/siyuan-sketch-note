import type { Stroke } from "@/types/sketch";

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Transform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export interface StrokeElement {
  id: string;
  type: "stroke";
  stroke: Stroke;
  bounds: Bounds;
  transform: Transform;
  zIndex: number;
}

export type SketchElement = StrokeElement;

export function calculateStrokeBounds(stroke: Stroke): Bounds {
  if (stroke.points.length === 0) {
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    };
  }

  const halfWidth = stroke.width / 2;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of stroke.points) {
    minX = Math.min(minX, point.x - halfWidth);
    minY = Math.min(minY, point.y - halfWidth);
    maxX = Math.max(maxX, point.x + halfWidth);
    maxY = Math.max(maxY, point.y + halfWidth);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function migrateStrokesToElements(strokes: Stroke[]): SketchElement[] {
  return strokes.map((stroke, index) => ({
    id: stroke.id,
    type: "stroke",
    stroke,
    bounds: calculateStrokeBounds(stroke),
    transform: {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    },
    zIndex: index,
  }));
}

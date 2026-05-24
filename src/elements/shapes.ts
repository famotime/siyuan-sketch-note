import type { Bounds, Transform } from "./model";

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
  shape: "line" | "rectangle" | "ellipse";
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

export function getShapeBounds(shape: ShapeElement): Bounds {
  return boundsFromPoints(shape.start, shape.end, shape.style.width);
}

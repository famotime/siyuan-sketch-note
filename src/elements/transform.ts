import type { Bounds, SketchElement } from "./model";

export type ResizeCorner = "nw" | "ne" | "sw" | "se";

const MIN_ELEMENT_SIZE = 48;
const RESIZE_CORNER_SIZE = 28;
const ROTATION_HANDLE_OFFSET = 32;
const ROTATION_HANDLE_SIZE = 14;
const DELETE_HANDLE_OFFSET = 28;
const DELETE_HANDLE_SIZE = 16;
const OPACITY_HANDLE_OFFSET = 28;
const OPACITY_HANDLE_SIZE = 16;
const STROKE_HIT_MIN_TOLERANCE = 6;

export interface ElementTransformAction {
  element: SketchElement;
  mode: "move" | "resize" | "rotate" | "delete" | "opacity";
  corner?: ResizeCorner;
}

function updateElementBounds<T extends SketchElement>(element: T, bounds: Bounds): T {
  return {
    ...element,
    bounds,
  };
}

export function moveElement<T extends SketchElement>(element: T, dx: number, dy: number): T {
  return {
    ...updateElementBounds(element, {
      ...element.bounds,
      x: element.bounds.x + dx,
      y: element.bounds.y + dy,
    }),
    transform: {
      ...element.transform,
      x: element.transform.x + dx,
      y: element.transform.y + dy,
    },
  };
}

export function resizeElementFromCorner<T extends SketchElement>(
  element: T,
  corner: ResizeCorner,
  dx: number,
  dy: number,
): T {
  const { bounds } = element;
  let x = bounds.x;
  let y = bounds.y;
  let width = bounds.width;
  let height = bounds.height;

  if (corner.includes("e")) {
    width = Math.max(MIN_ELEMENT_SIZE, bounds.width + dx);
  }
  if (corner.includes("s")) {
    height = Math.max(MIN_ELEMENT_SIZE, bounds.height + dy);
  }
  if (corner.includes("w")) {
    width = Math.max(MIN_ELEMENT_SIZE, bounds.width - dx);
    x = bounds.x + (bounds.width - width);
  }
  if (corner.includes("n")) {
    height = Math.max(MIN_ELEMENT_SIZE, bounds.height - dy);
    y = bounds.y + (bounds.height - height);
  }

  return updateElementBounds(element, {
    x,
    y,
    width,
    height,
  });
}

export function rotateElement<T extends SketchElement>(element: T, rotation: number): T {
  return {
    ...element,
    transform: {
      ...element.transform,
      rotation,
    },
  };
}

function getElementCenter(element: SketchElement): { x: number; y: number } {
  return {
    x: element.bounds.x + element.bounds.width / 2,
    y: element.bounds.y + element.bounds.height / 2,
  };
}

function rotatePointAroundCenter(x: number, y: number, center: { x: number; y: number }, angle: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = x - center.x;
  const dy = y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

function inverseRotatePointForElement(element: SketchElement, x: number, y: number) {
  return rotatePointAroundCenter(x, y, getElementCenter(element), -(element.transform.rotation || 0));
}

export function hitTestElement(elements: SketchElement[], x: number, y: number): SketchElement | null {
  const ordered = [...elements].sort((a, b) => b.zIndex - a.zIndex);
  return ordered.find((element) => {
    const point = inverseRotatePointForElement(element, x, y);
    if (element.type === "stroke") {
      return isPointInStrokeElement(element, point.x, point.y);
    }
    return point.x >= element.bounds.x
      && point.x <= element.bounds.x + element.bounds.width
      && point.y >= element.bounds.y
      && point.y <= element.bounds.y + element.bounds.height;
  }) ?? null;
}

function isPointInStrokeElement(element: SketchElement & { type: "stroke" }, x: number, y: number): boolean {
  const tolerance = Math.max(STROKE_HIT_MIN_TOLERANCE, element.stroke.width / 2);
  if (
    x < element.bounds.x - tolerance
    || x > element.bounds.x + element.bounds.width + tolerance
    || y < element.bounds.y - tolerance
    || y > element.bounds.y + element.bounds.height + tolerance
  ) {
    return false;
  }

  const points = element.stroke.points;
  if (points.length === 0) return false;
  if (points.length === 1) return Math.hypot(x - points[0].x, y - points[0].y) <= tolerance;

  for (let index = 1; index < points.length; index++) {
    if (distanceToSegment(x, y, points[index - 1].x, points[index - 1].y, points[index].x, points[index].y) <= tolerance) {
      return true;
    }
  }
  return false;
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  const x = ax + t * dx;
  const y = ay + t * dy;
  return Math.hypot(px - x, py - y);
}

function getRotatedCorner(element: SketchElement, corner: ResizeCorner) {
  const left = element.bounds.x;
  const right = element.bounds.x + element.bounds.width;
  const top = element.bounds.y;
  const bottom = element.bounds.y + element.bounds.height;
  const point = {
    x: corner.includes("e") ? right : left,
    y: corner.includes("s") ? bottom : top,
  };
  return rotatePointAroundCenter(point.x, point.y, getElementCenter(element), element.transform.rotation || 0);
}

export function getResizeCornerAtPoint(element: SketchElement, x: number, y: number): ResizeCorner | null {
  for (const corner of ["nw", "ne", "sw", "se"] as const) {
    const point = getRotatedCorner(element, corner);
    if (
      Math.abs(x - point.x) <= RESIZE_CORNER_SIZE / 2
      && Math.abs(y - point.y) <= RESIZE_CORNER_SIZE / 2
    ) {
      return corner;
    }
  }
  return null;
}

export function isInResizeCorner(element: SketchElement, x: number, y: number): boolean {
  return getResizeCornerAtPoint(element, x, y) !== null;
}

export function getRotationHandlePoint(element: SketchElement): { x: number; y: number } {
  const center = getElementCenter(element);
  return rotatePointAroundCenter(
    center.x,
    element.bounds.y - ROTATION_HANDLE_OFFSET,
    center,
    element.transform.rotation || 0,
  );
}

export function getDeleteHandlePoint(element: SketchElement): { x: number; y: number } {
  const center = getElementCenter(element);
  return rotatePointAroundCenter(
    element.bounds.x + element.bounds.width + DELETE_HANDLE_OFFSET,
    element.bounds.y - DELETE_HANDLE_OFFSET,
    center,
    element.transform.rotation || 0,
  );
}

export function getOpacityHandlePoint(element: SketchElement): { x: number; y: number } {
  const center = getElementCenter(element);
  return rotatePointAroundCenter(
    element.bounds.x - OPACITY_HANDLE_OFFSET,
    element.bounds.y - OPACITY_HANDLE_OFFSET,
    center,
    element.transform.rotation || 0,
  );
}

export function isInRotationHandle(element: SketchElement, x: number, y: number): boolean {
  const handle = getRotationHandlePoint(element);
  return Math.hypot(x - handle.x, y - handle.y) <= ROTATION_HANDLE_SIZE;
}

export function isInDeleteHandle(element: SketchElement, x: number, y: number): boolean {
  const handle = getDeleteHandlePoint(element);
  return Math.hypot(x - handle.x, y - handle.y) <= DELETE_HANDLE_SIZE;
}

export function isInOpacityHandle(element: SketchElement, x: number, y: number): boolean {
  const handle = getOpacityHandlePoint(element);
  return Math.hypot(x - handle.x, y - handle.y) <= OPACITY_HANDLE_SIZE;
}

export function angleFromElementCenter(element: SketchElement, x: number, y: number): number {
  const center = getElementCenter(element);
  return Math.atan2(y - center.y, x - center.x);
}

export function resolveElementTransformAction(
  elements: SketchElement[],
  selectedElementId: string | null,
  x: number,
  y: number,
): ElementTransformAction | null {
  const selectedElement = selectedElementId
    ? elements.find((element) => element.id === selectedElementId)
    : null;

  if (selectedElement) {
    if (isInOpacityHandle(selectedElement, x, y)) {
      return { element: selectedElement, mode: "opacity" };
    }
    if (isInDeleteHandle(selectedElement, x, y)) {
      return { element: selectedElement, mode: "delete" };
    }
    if (isInRotationHandle(selectedElement, x, y)) {
      return { element: selectedElement, mode: "rotate" };
    }
    const resizeCorner = getResizeCornerAtPoint(selectedElement, x, y);
    if (resizeCorner) {
      return { element: selectedElement, mode: "resize", corner: resizeCorner };
    }
  }

  const element = hitTestElement(elements, x, y);
  return element ? { element, mode: "move" } : null;
}

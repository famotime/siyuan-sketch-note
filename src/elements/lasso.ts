import type { SketchElement } from "./model";

export interface Point {
  x: number;
  y: number;
}

function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects = ((a.y > point.y) !== (b.y > point.y))
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function getElementCenter(element: SketchElement): Point {
  return {
    x: element.bounds.x + element.bounds.width / 2 + element.transform.x,
    y: element.bounds.y + element.bounds.height / 2 + element.transform.y,
  };
}

export function findElementsInLasso(
  elements: SketchElement[],
  polygon: Point[],
): SketchElement[] {
  if (polygon.length < 3) return [];
  return elements.filter((element) => isPointInPolygon(getElementCenter(element), polygon));
}

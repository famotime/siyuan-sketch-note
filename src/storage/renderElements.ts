import type { SketchElement } from "@/elements/model";

export function translateElementsForRender(
  elements: SketchElement[],
  tx: number,
  ty: number,
): SketchElement[] {
  if (tx === 0 && ty === 0) return elements;

  return elements.map((element) => ({
    ...element,
    bounds: {
      ...element.bounds,
      x: element.bounds.x + tx,
      y: element.bounds.y + ty,
    },
    transform: {
      ...element.transform,
      x: element.transform.x + tx,
      y: element.transform.y + ty,
    },
  }));
}

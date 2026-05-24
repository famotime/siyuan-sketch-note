import type { Bounds, SketchElement } from "./model";

export type ResizeCorner = "se";

const MIN_ELEMENT_SIZE = 48;

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
  if (corner !== "se") return element;

  return updateElementBounds(element, {
    ...element.bounds,
    width: Math.max(MIN_ELEMENT_SIZE, element.bounds.width + dx),
    height: Math.max(MIN_ELEMENT_SIZE, element.bounds.height + dy),
  });
}

export function hitTestElement(elements: SketchElement[], x: number, y: number): SketchElement | null {
  const ordered = [...elements].sort((a, b) => b.zIndex - a.zIndex);
  return ordered.find((element) =>
    x >= element.bounds.x
    && x <= element.bounds.x + element.bounds.width
    && y >= element.bounds.y
    && y <= element.bounds.y + element.bounds.height,
  ) ?? null;
}

export function isInResizeCorner(element: SketchElement, x: number, y: number): boolean {
  const cornerSize = 28;
  const right = element.bounds.x + element.bounds.width;
  const bottom = element.bounds.y + element.bounds.height;
  return x >= right - cornerSize && x <= right && y >= bottom - cornerSize && y <= bottom;
}

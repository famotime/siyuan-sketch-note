import type { SketchElement } from "@/elements/model";
import { hitTestElement } from "@/elements/transform";

const TEXT_DRAG_THRESHOLD = 4;

export type TextPointerAction =
  | { type: "edit"; element: SketchElement & { type: "text" } }
  | { type: "create"; x: number; y: number };

export interface TextPointerPoint {
  x: number;
  y: number;
}

export function resolveTextPointerAction(
  elements: SketchElement[],
  x: number,
  y: number,
): TextPointerAction {
  const element = hitTestElement(
    elements.filter((item) => item.type === "text"),
    x,
    y,
  );

  if (element?.type === "text") {
    return {
      type: "edit",
      element,
    };
  }

  return {
    type: "create",
    x,
    y,
  };
}

export function hasTextPointerDrag(
  start: TextPointerPoint,
  current: TextPointerPoint,
  threshold = TEXT_DRAG_THRESHOLD,
): boolean {
  return Math.hypot(current.x - start.x, current.y - start.y) >= threshold;
}

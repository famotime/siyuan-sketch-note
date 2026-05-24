import { moveElement } from "./transform";
import type { Stroke } from "@/types/sketch";
import type { SketchElement } from "./model";

function selectionSet(selectedIds: string[]): Set<string> {
  return new Set(selectedIds);
}

export function translateLassoSelection(
  elements: SketchElement[],
  selectedIds: string[],
  dx: number,
  dy: number,
): SketchElement[] {
  const selected = selectionSet(selectedIds);
  return elements.map((element) =>
    selected.has(element.id) ? moveElement(element, dx, dy) : element,
  );
}

export function removeLassoSelection(
  elements: SketchElement[],
  selectedIds: string[],
): SketchElement[] {
  const selected = selectionSet(selectedIds);
  return elements.filter((element) => !selected.has(element.id));
}

export function translateStrokeSelection(
  strokes: Stroke[],
  selectedIds: string[],
  dx: number,
  dy: number,
): Stroke[] {
  const selected = selectionSet(selectedIds);
  return strokes.map((stroke) => {
    if (!selected.has(stroke.id)) return stroke;
    return {
      ...stroke,
      points: stroke.points.map((point) => ({
        ...point,
        x: point.x + dx,
        y: point.y + dy,
      })),
    };
  });
}

export function removeStrokeSelection(
  strokes: Stroke[],
  selectedIds: string[],
): Stroke[] {
  const selected = selectionSet(selectedIds);
  return strokes.filter((stroke) => !selected.has(stroke.id));
}

export function recolorLassoSelection(
  elements: SketchElement[],
  selectedIds: string[],
  color: string,
): SketchElement[] {
  const selected = selectionSet(selectedIds);
  return elements.map((element) => {
    if (!selected.has(element.id) || element.type !== "stroke") return element;
    return {
      ...element,
      stroke: {
        ...element.stroke,
        color,
      },
    };
  });
}

export function recolorStrokeSelection(
  strokes: Stroke[],
  selectedIds: string[],
  color: string,
): Stroke[] {
  const selected = selectionSet(selectedIds);
  return strokes.map((stroke) =>
    selected.has(stroke.id)
      ? { ...stroke, color }
      : stroke,
  );
}

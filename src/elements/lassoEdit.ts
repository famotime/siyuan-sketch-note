import { moveElement } from "./transform";
import type { Stroke } from "@/types/sketch";
import type { Bounds, SketchElement } from "./model";
import { withStrokeBounds } from "./model";

function selectionSet(selectedIds: string[]): Set<string> {
  return new Set(selectedIds);
}

function translateBounds(bounds: Bounds, dx: number, dy: number): Bounds {
  return {
    ...bounds,
    x: bounds.x + dx,
    y: bounds.y + dy,
  };
}

function translateStroke(stroke: Stroke, dx: number, dy: number, id = stroke.id): Stroke {
  const boundedStroke = withStrokeBounds(stroke);
  return {
    ...boundedStroke,
    id,
    points: boundedStroke.points.map((point) => ({
      ...point,
      x: point.x + dx,
      y: point.y + dy,
    })),
    bounds: translateBounds(boundedStroke.bounds!, dx, dy),
  };
}

function duplicateElement(
  element: SketchElement,
  dx: number,
  dy: number,
  createId: (id: string) => string,
): SketchElement {
  const id = createId(element.id);
  const base = {
    ...element,
    id,
    bounds: translateBounds(element.bounds, dx, dy),
    transform: { ...element.transform },
  };

  if (element.type === "stroke") {
    return {
      ...base,
      type: "stroke",
      stroke: translateStroke(element.stroke, dx, dy, id),
    };
  }

  if (element.type === "text") {
    return {
      ...base,
      type: "text",
      style: { ...element.style },
    };
  }

  if (element.type === "shape") {
    return {
      ...base,
      type: "shape",
      start: {
        x: element.start.x + dx,
        y: element.start.y + dy,
      },
      end: {
        x: element.end.x + dx,
        y: element.end.y + dy,
      },
      style: { ...element.style },
    };
  }

  return {
    ...base,
    type: "image",
  };
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
  return strokes.map((stroke) =>
    selected.has(stroke.id) ? translateStroke(stroke, dx, dy) : stroke,
  );
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

export function duplicateLassoSelection(
  elements: SketchElement[],
  selectedIds: string[],
  dx: number,
  dy: number,
  createId: (id: string) => string,
): SketchElement[] {
  const selected = selectionSet(selectedIds);
  const duplicates = elements
    .filter((element) => selected.has(element.id))
    .map((element) => duplicateElement(element, dx, dy, createId));
  return [...elements, ...duplicates];
}

export function duplicateStrokeSelection(
  strokes: Stroke[],
  selectedIds: string[],
  dx: number,
  dy: number,
  createId: (id: string) => string,
): Stroke[] {
  const selected = selectionSet(selectedIds);
  const duplicates = strokes
    .filter((stroke) => selected.has(stroke.id))
    .map((stroke) => translateStroke(stroke, dx, dy, createId(stroke.id)));
  return [...strokes, ...duplicates];
}

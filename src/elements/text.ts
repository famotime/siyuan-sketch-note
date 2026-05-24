import type { Bounds, Transform } from "./model";

export interface TextStyle {
  color: string;
  fontSize: number;
  fontFamily: string;
}

export interface TextElement {
  id: string;
  type: "text";
  text: string;
  bounds: Bounds;
  style: TextStyle;
  transform: Transform;
  zIndex: number;
}

interface CreateTextElementInput {
  x: number;
  y: number;
  text: string;
  width?: number;
  height?: number;
  style?: Partial<TextStyle>;
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

export function createTextElement(id: string, input: CreateTextElementInput): TextElement {
  return {
    id,
    type: "text",
    text: input.text,
    bounds: {
      x: input.x,
      y: input.y,
      width: input.width ?? 220,
      height: input.height ?? 80,
    },
    style: {
      color: input.style?.color ?? "#000000",
      fontSize: input.style?.fontSize ?? 18,
      fontFamily: input.style?.fontFamily ?? "sans-serif",
    },
    transform: defaultTransform(),
    zIndex: 0,
  };
}

export function updateTextElement(
  element: TextElement,
  patch: Partial<Pick<TextElement, "text" | "bounds">> & { fontSize?: number; color?: string },
): TextElement {
  return {
    ...element,
    text: patch.text ?? element.text,
    bounds: patch.bounds ?? element.bounds,
    style: {
      ...element.style,
      color: patch.color ?? element.style.color,
      fontSize: patch.fontSize ?? element.style.fontSize,
    },
  };
}

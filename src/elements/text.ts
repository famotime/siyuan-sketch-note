import type { Bounds, Transform } from "./model";
import { defaultTransform } from "./model";

export const TEXT_LINE_HEIGHT_RATIO = 1.2;
export const TEXT_VERTICAL_PADDING = 8;

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

export function getTextLineHeight(fontSize: number): number {
  return Math.ceil(fontSize * TEXT_LINE_HEIGHT_RATIO);
}

export function calculateTextBoundsHeight(text: string, fontSize: number): number {
  const lineCount = Math.max(1, text.split("\n").length);
  return lineCount * getTextLineHeight(fontSize) + TEXT_VERTICAL_PADDING;
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
  patch: Partial<Pick<TextElement, "text" | "bounds">> & {
    color?: string;
    fontFamily?: string;
    fontSize?: number;
  },
): TextElement {
  return {
    ...element,
    text: patch.text ?? element.text,
    bounds: patch.bounds ?? element.bounds,
    style: {
      ...element.style,
      color: patch.color ?? element.style.color,
      fontFamily: patch.fontFamily ?? element.style.fontFamily,
      fontSize: patch.fontSize ?? element.style.fontSize,
    },
  };
}

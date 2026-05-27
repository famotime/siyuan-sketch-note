import type { Bounds, Transform } from "./model";
import { defaultTransform } from "./model";

export interface ImageElement {
  id: string;
  type: "image";
  src: string;
  alt: string;
  opacity: number;
  bounds: Bounds;
  transform: Transform;
  zIndex: number;
}

interface CreateImageElementInput {
  x: number;
  y: number;
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  opacity?: number;
}

export function createImageElement(id: string, input: CreateImageElementInput): ImageElement {
  return {
    id,
    type: "image",
    src: input.src,
    alt: input.alt ?? "",
    opacity: input.opacity ?? 1,
    bounds: {
      x: input.x,
      y: input.y,
      width: input.width ?? 320,
      height: input.height ?? 240,
    },
    transform: defaultTransform(),
    zIndex: 0,
  };
}

export function updateImageElement(
  element: ImageElement,
  patch: Partial<Pick<ImageElement, "alt" | "bounds" | "opacity" | "src">>,
): ImageElement {
  return {
    ...element,
    src: patch.src ?? element.src,
    alt: patch.alt ?? element.alt,
    opacity: patch.opacity ?? element.opacity,
    bounds: patch.bounds ?? element.bounds,
  };
}

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
  naturalWidth?: number;
  naturalHeight?: number;
  opacity?: number;
}

const DEFAULT_IMAGE_WIDTH = 320;
const DEFAULT_IMAGE_HEIGHT = 240;

export function fitImageElementSize(input: {
  width?: number;
  height?: number;
  naturalWidth?: number;
  naturalHeight?: number;
}): { width: number; height: number } {
  if (input.width != null || input.height != null) {
    return {
      width: input.width ?? DEFAULT_IMAGE_WIDTH,
      height: input.height ?? DEFAULT_IMAGE_HEIGHT,
    };
  }

  if (
    input.naturalWidth != null
    && input.naturalHeight != null
    && Number.isFinite(input.naturalWidth)
    && Number.isFinite(input.naturalHeight)
    && input.naturalWidth > 0
    && input.naturalHeight > 0
  ) {
    const scale = Math.min(DEFAULT_IMAGE_WIDTH / input.naturalWidth, DEFAULT_IMAGE_HEIGHT / input.naturalHeight);
    return {
      width: Math.round(input.naturalWidth * scale),
      height: Math.round(input.naturalHeight * scale),
    };
  }

  return {
    width: DEFAULT_IMAGE_WIDTH,
    height: DEFAULT_IMAGE_HEIGHT,
  };
}

export function createImageElement(id: string, input: CreateImageElementInput): ImageElement {
  const size = fitImageElementSize(input);

  return {
    id,
    type: "image",
    src: input.src,
    alt: input.alt ?? "",
    opacity: input.opacity ?? 1,
    bounds: {
      x: input.x,
      y: input.y,
      width: size.width,
      height: size.height,
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

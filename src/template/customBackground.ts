import type { SketchData } from "@/types/sketch";

export interface CustomBackgroundTemplate {
  id: string;
  nameKey: string;
  src: string;
  fit: "cover" | "contain" | "stretch";
}

export interface CustomBackgroundDrawRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

export function createCustomBackgroundTemplate(
  id: string,
  src: string,
  fit: CustomBackgroundTemplate["fit"] = "cover",
): CustomBackgroundTemplate {
  return {
    id: `custom:${id}`,
    nameKey: "templateCustomBackground",
    src,
    fit,
  };
}

export function isCustomBackgroundTemplateId(id: string): boolean {
  return id.startsWith("custom:");
}

export function getCustomBackgroundTemplate(
  data: Pick<SketchData, "customBackgrounds" | "template">,
): CustomBackgroundTemplate | null {
  if (!isCustomBackgroundTemplateId(data.template)) return null;
  return data.customBackgrounds?.find((item) => item.id === data.template) ?? null;
}

export function getCustomBackgroundSource(data: Pick<SketchData, "customBackgrounds" | "template">): string | null {
  return getCustomBackgroundTemplate(data)?.src ?? null;
}

export function getCustomBackgroundDrawRect(options: {
  imageWidth: number;
  imageHeight: number;
  targetWidth: number;
  targetHeight: number;
  fit: CustomBackgroundTemplate["fit"];
}): CustomBackgroundDrawRect {
  const { imageWidth, imageHeight, targetWidth, targetHeight, fit } = options;

  if (fit === "stretch") {
    return {
      sx: 0,
      sy: 0,
      sw: imageWidth,
      sh: imageHeight,
      dx: 0,
      dy: 0,
      dw: targetWidth,
      dh: targetHeight,
    };
  }

  const imageRatio = imageWidth / imageHeight;
  const targetRatio = targetWidth / targetHeight;

  if (fit === "contain") {
    const dw = imageRatio > targetRatio ? targetWidth : targetHeight * imageRatio;
    const dh = imageRatio > targetRatio ? targetWidth / imageRatio : targetHeight;

    return {
      sx: 0,
      sy: 0,
      sw: imageWidth,
      sh: imageHeight,
      dx: (targetWidth - dw) / 2,
      dy: (targetHeight - dh) / 2,
      dw,
      dh,
    };
  }

  const sw = imageRatio > targetRatio ? imageHeight * targetRatio : imageWidth;
  const sh = imageRatio > targetRatio ? imageHeight : imageWidth / targetRatio;

  return {
    sx: (imageWidth - sw) / 2,
    sy: (imageHeight - sh) / 2,
    sw,
    sh,
    dx: 0,
    dy: 0,
    dw: targetWidth,
    dh: targetHeight,
  };
}

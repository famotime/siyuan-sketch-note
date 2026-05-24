import type { SketchData } from "@/types/sketch";

export interface CustomBackgroundTemplate {
  id: string;
  nameKey: string;
  src: string;
  fit: "cover" | "contain" | "stretch";
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

export function getCustomBackgroundSource(data: Pick<SketchData, "customBackgrounds" | "template">): string | null {
  if (!isCustomBackgroundTemplateId(data.template)) return null;
  return data.customBackgrounds?.find((item) => item.id === data.template)?.src ?? null;
}

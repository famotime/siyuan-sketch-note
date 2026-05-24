import type { SketchElement } from "./model";

export interface ElementRenderLayers {
  background: SketchElement[];
  foreground: SketchElement[];
}

export function splitElementsForRender(elements: SketchElement[]): ElementRenderLayers {
  return {
    background: elements.filter((element) => element.type === "image"),
    foreground: elements.filter((element) => element.type !== "image"),
  };
}

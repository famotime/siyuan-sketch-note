import { describe, expect, it } from "vitest";
import type { SketchElement } from "./model";
import { splitElementsForRender } from "./renderOrder";

const image = {
  id: "image-1",
  type: "image",
  src: "data:image/png;base64,AAA",
} as SketchElement;
const text = {
  id: "text-1",
  type: "text",
  text: "Note",
} as SketchElement;

describe("element render order", () => {
  it("renders imported images behind ink and text above ink", () => {
    const layers = splitElementsForRender([text, image]);

    expect(layers.background).toEqual([image]);
    expect(layers.foreground).toEqual([text]);
  });
});

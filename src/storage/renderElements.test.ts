import { describe, expect, it } from "vitest";
import { createTextElement } from "@/elements/text";
import { translateElementsForRender } from "./renderElements";

describe("render elements", () => {
  it("translates element bounds for page exports without mutating source elements", () => {
    const element = createTextElement("text-1", {
      x: 80,
      y: 1120,
      text: "page 2",
    });

    const translated = translateElementsForRender([element], 0, -1000);

    expect(translated[0].bounds).toMatchObject({ x: 80, y: 120 });
    expect(translated[0].transform).toMatchObject({ x: 0, y: -1000 });
    expect(element.bounds).toMatchObject({ x: 80, y: 1120 });
    expect(element.transform).toMatchObject({ x: 0, y: 0 });
  });

  it("returns original element references when no translation is needed", () => {
    const element = createTextElement("text-1", {
      x: 80,
      y: 120,
      text: "page 1",
    });

    const translated = translateElementsForRender([element], 0, 0);

    expect(translated[0]).toBe(element);
  });
});

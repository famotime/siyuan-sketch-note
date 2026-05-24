import { describe, expect, it } from "vitest";
import { createImageElement } from "./image";
import {
  moveElement,
  resizeElementFromCorner,
} from "./transform";

describe("element transforms", () => {
  it("moves an element by delta without mutating the original", () => {
    const element = createImageElement("image-1", {
      x: 20,
      y: 30,
      src: "data:image/png;base64,AAA",
    });

    const moved = moveElement(element, 12, -8);

    expect(moved.bounds).toEqual({
      x: 32,
      y: 22,
      width: 320,
      height: 240,
    });
    expect(element.bounds.x).toBe(20);
    expect(element.bounds.y).toBe(30);
  });

  it("keeps transform translation in sync when moving an element", () => {
    const element = createImageElement("image-1", {
      x: 20,
      y: 30,
      src: "data:image/png;base64,AAA",
    });

    const moved = moveElement(moveElement(element, 12, -8), -2, 18);

    expect(moved.bounds).toMatchObject({ x: 30, y: 40 });
    expect(moved.transform).toMatchObject({ x: 10, y: 10 });
    expect(element.transform).toMatchObject({ x: 0, y: 0 });
  });

  it("resizes from the bottom right corner with a minimum size", () => {
    const element = createImageElement("image-1", {
      x: 20,
      y: 30,
      src: "data:image/png;base64,AAA",
      width: 320,
      height: 240,
    });

    const resized = resizeElementFromCorner(element, "se", -400, -400);

    expect(resized.bounds).toEqual({
      x: 20,
      y: 30,
      width: 48,
      height: 48,
    });
    expect(element.bounds.width).toBe(320);
    expect(element.bounds.height).toBe(240);
  });
});

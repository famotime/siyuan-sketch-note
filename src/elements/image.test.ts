import { describe, expect, it } from "vitest";
import {
  createImageElement,
  updateImageElement,
} from "./image";

describe("image elements", () => {
  it("creates an image element with predictable bounds and source metadata", () => {
    const element = createImageElement("image-1", {
      x: 32,
      y: 48,
      src: "data:image/png;base64,AAA",
      alt: "Imported diagram",
    });

    expect(element).toMatchObject({
      id: "image-1",
      type: "image",
      src: "data:image/png;base64,AAA",
      alt: "Imported diagram",
      opacity: 1,
      bounds: {
        x: 32,
        y: 48,
        width: 320,
        height: 240,
      },
      transform: {
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
      },
      zIndex: 0,
    });
  });

  it("updates image geometry without mutating the original element", () => {
    const element = createImageElement("image-1", {
      x: 0,
      y: 0,
      src: "data:image/png;base64,AAA",
    });

    const updated = updateImageElement(element, {
      bounds: {
        x: 10,
        y: 20,
        width: 180,
        height: 120,
      },
      alt: "Updated",
      opacity: 0.5,
    });

    expect(updated.bounds).toEqual({
      x: 10,
      y: 20,
      width: 180,
      height: 120,
    });
    expect(updated.alt).toBe("Updated");
    expect(updated.opacity).toBe(0.5);
    expect(element.bounds).toEqual({
      x: 0,
      y: 0,
      width: 320,
      height: 240,
    });
    expect(element.alt).toBe("");
    expect(element.opacity).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import type { Stroke } from "@/types/sketch";
import { createImageElement } from "./image";
import { migrateStrokesToElements } from "./model";
import {
  getDeleteHandlePoint,
  getOpacityHandlePoint,
  getRotationHandlePoint,
  hitTestElement,
  moveElement,
  resizeElementFromCorner,
  resolveElementTransformAction,
  rotateElement,
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

  it("resizes from the top left corner by moving the origin", () => {
    const element = createImageElement("image-1", {
      x: 20,
      y: 30,
      src: "data:image/png;base64,AAA",
      width: 320,
      height: 240,
    });

    const resized = resizeElementFromCorner(element, "nw", 20, 30);

    expect(resized.bounds).toEqual({
      x: 40,
      y: 60,
      width: 300,
      height: 210,
    });
    expect(element.bounds).toMatchObject({ x: 20, y: 30, width: 320, height: 240 });
  });

  it("rotates an element without mutating the original", () => {
    const element = createImageElement("image-1", {
      x: 20,
      y: 30,
      src: "data:image/png;base64,AAA",
    });

    const rotated = rotateElement(element, Math.PI / 4);

    expect(rotated.transform.rotation).toBeCloseTo(Math.PI / 4);
    expect(element.transform.rotation).toBe(0);
  });

  it("hit-tests rotated elements against their rendered rectangle", () => {
    const element = rotateElement(
      createImageElement("image-1", {
        x: 0,
        y: 0,
        src: "data:image/png;base64,AAA",
        width: 100,
        height: 40,
      }),
      Math.PI / 2,
    );

    expect(hitTestElement([element], 50, 65)?.id).toBe("image-1");
    expect(hitTestElement([element], 95, 20)).toBeNull();
  });

  it("hit-tests stroke elements by path distance instead of the whole bounds rectangle", () => {
    const stroke: Stroke = {
      id: "stroke-1",
      tool: "pen",
      color: "#000000",
      width: 10,
      opacity: 1,
      points: [
        { x: 10, y: 10, pressure: 0.5, timestamp: 1 },
        { x: 110, y: 110, pressure: 0.5, timestamp: 2 },
      ],
    };
    const [element] = migrateStrokesToElements([stroke]);

    expect(hitTestElement([element], 50, 50)?.id).toBe("stroke-1");
    expect(hitTestElement([element], 20, 100)).toBeNull();
  });

  it("resolves selected resize handles outside the image bounds", () => {
    const element = createImageElement("image-1", {
      x: 20,
      y: 30,
      src: "data:image/png;base64,AAA",
      width: 320,
      height: 240,
    });

    const action = resolveElementTransformAction([element], "image-1", 346, 276);

    expect(action?.element.id).toBe("image-1");
    expect(action?.mode).toBe("resize");
    expect(action?.corner).toBe("se");
  });

  it("resolves resize handles after the image is rotated", () => {
    const element = rotateElement(
      createImageElement("image-1", {
        x: 20,
        y: 30,
        src: "data:image/png;base64,AAA",
        width: 320,
        height: 240,
      }),
      Math.PI / 6,
    );

    const action = resolveElementTransformAction([element], "image-1", 258.6, 333.9);

    expect(action?.mode).toBe("resize");
    expect(action?.corner).toBe("se");
  });

  it("resolves selected rotation handles above the image bounds", () => {
    const element = createImageElement("image-1", {
      x: 20,
      y: 30,
      src: "data:image/png;base64,AAA",
      width: 320,
      height: 240,
    });
    const handle = getRotationHandlePoint(element);

    const action = resolveElementTransformAction([element], "image-1", handle.x, handle.y);

    expect(action?.element.id).toBe("image-1");
    expect(action?.mode).toBe("rotate");
  });

  it("resolves selected delete handles outside the image bounds", () => {
    const element = createImageElement("image-1", {
      x: 20,
      y: 30,
      src: "data:image/png;base64,AAA",
      width: 320,
      height: 240,
    });
    const handle = getDeleteHandlePoint(element);

    const action = resolveElementTransformAction([element], "image-1", handle.x, handle.y);

    expect(action?.element.id).toBe("image-1");
    expect(action?.mode).toBe("delete");
  });

  it("resolves selected opacity handles outside the image bounds", () => {
    const element = createImageElement("image-1", {
      x: 20,
      y: 30,
      src: "data:image/png;base64,AAA",
      width: 320,
      height: 240,
    });
    const handle = getOpacityHandlePoint(element);

    const action = resolveElementTransformAction([element], "image-1", handle.x, handle.y);

    expect(action?.element.id).toBe("image-1");
    expect(action?.mode).toBe("opacity");
  });

  it("falls back to moving the topmost image body when no handle is selected", () => {
    const element = createImageElement("image-1", {
      x: 20,
      y: 30,
      src: "data:image/png;base64,AAA",
      width: 320,
      height: 240,
    });

    const action = resolveElementTransformAction([element], null, 120, 130);

    expect(action?.element.id).toBe("image-1");
    expect(action?.mode).toBe("move");
  });
});

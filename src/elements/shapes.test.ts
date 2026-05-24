import { describe, expect, it } from "vitest";
import {
  createEllipseShape,
  createLineShape,
  createRectangleShape,
  getShapeBounds,
} from "./shapes";

describe("shape elements", () => {
  it("creates a line shape with normalized bounds", () => {
    const shape = createLineShape("line-1", { x: 30, y: 40 }, { x: 10, y: 20 }, {
      color: "#111111",
      width: 4,
      opacity: 0.8,
    });

    expect(shape.bounds).toEqual({
      x: 8,
      y: 18,
      width: 24,
      height: 24,
    });
  });

  it("creates rectangle and ellipse shapes with the same bounds contract", () => {
    const rectangle = createRectangleShape("rect-1", { x: 10, y: 20 }, { x: 50, y: 70 }, {
      color: "#222222",
      width: 2,
      opacity: 1,
    });
    const ellipse = createEllipseShape("ellipse-1", { x: 50, y: 70 }, { x: 10, y: 20 }, {
      color: "#333333",
      width: 2,
      opacity: 0.5,
    });

    expect(getShapeBounds(rectangle)).toEqual({ x: 9, y: 19, width: 42, height: 52 });
    expect(getShapeBounds(ellipse)).toEqual({ x: 9, y: 19, width: 42, height: 52 });
  });
});

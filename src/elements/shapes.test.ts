import { describe, expect, it } from "vitest";
import {
  createArrowStroke,
  createEllipseShape,
  createLineShape,
  createRectangleShape,
  createTriangleStroke,
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

  it("creates an arrow stroke with a shaft and two arrowhead wings", () => {
    const stroke = createArrowStroke("arrow-1", { x: 10, y: 10 }, { x: 70, y: 10 }, {
      tool: "pen",
      color: "#111111",
      width: 4,
      opacity: 1,
      mode: "ink",
    });

    expect(stroke.points).toHaveLength(6);
    expect(stroke.points[0]).toMatchObject({ x: 10, y: 10 });
    expect(stroke.points[1]).toMatchObject({ x: 70, y: 10 });
    expect(stroke.points[2].x).toBeLessThan(70);
    expect(stroke.points[2].y).toBeGreaterThan(10);
    expect(stroke.points[3].x).toBeCloseTo(70);
    expect(stroke.points[4].x).toBeLessThan(70);
    expect(stroke.points[4].y).toBeLessThan(10);
    expect(stroke.points[5].x).toBeCloseTo(70);
    expect(stroke.bounds).toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
      width: expect.any(Number),
      height: expect.any(Number),
    });
    expect(stroke.color).toBe("#111111");
  });

  it("creates a closed triangle stroke inside the drag bounds", () => {
    const stroke = createTriangleStroke("triangle-1", { x: 10, y: 20 }, { x: 70, y: 80 }, {
      tool: "pen",
      color: "#444444",
      width: 4,
      opacity: 0.7,
      mode: "ink",
    });

    expect(stroke.points).toEqual([
      { x: 40, y: 20, pressure: 0.5, timestamp: 0 },
      { x: 70, y: 80, pressure: 0.5, timestamp: 1 },
      { x: 10, y: 80, pressure: 0.5, timestamp: 2 },
      { x: 40, y: 20, pressure: 0.5, timestamp: 3 },
    ]);
    expect(stroke.color).toBe("#444444");
    expect(stroke.opacity).toBe(0.7);
    expect(stroke.bounds).toEqual({ x: 8, y: 18, width: 64, height: 64 });
  });
});

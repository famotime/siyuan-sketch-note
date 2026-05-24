import { describe, expect, it } from "vitest";
import {
  createRulerState,
  moveRuler,
  projectPointToRuler,
  rotateRuler,
  snapRulerAngle,
} from "./ruler";

describe("ruler geometry", () => {
  it("snaps angles to common increments", () => {
    expect(snapRulerAngle(2)).toBe(0);
    expect(snapRulerAngle(43)).toBe(45);
    expect(snapRulerAngle(91)).toBe(90);
    expect(snapRulerAngle(359)).toBe(0);
  });

  it("projects points onto the ruler baseline", () => {
    const ruler = createRulerState({
      x: 0,
      y: 0,
      angle: 0,
      length: 200,
    });

    expect(projectPointToRuler({ x: 30, y: 40 }, ruler)).toEqual({
      x: 30,
      y: 0,
    });
  });

  it("moves ruler without changing angle or length", () => {
    const ruler = createRulerState({
      x: 20,
      y: 30,
      angle: 45,
      length: 200,
    });

    expect(moveRuler(ruler, 10, -5)).toEqual({
      x: 30,
      y: 25,
      angle: 45,
      length: 200,
    });
  });

  it("rotates ruler around its anchor and snaps to common angles", () => {
    const ruler = createRulerState({
      x: 20,
      y: 30,
      angle: 0,
      length: 200,
    });

    expect(rotateRuler(ruler, 44)).toMatchObject({
      x: 20,
      y: 30,
      angle: 45,
      length: 200,
    });
  });

  it("projects points onto a diagonal ruler baseline", () => {
    const ruler = createRulerState({
      x: 0,
      y: 0,
      angle: 45,
      length: 200,
    });
    const projected = projectPointToRuler({ x: 20, y: 0 }, ruler);

    expect(projected.x).toBeCloseTo(10, 5);
    expect(projected.y).toBeCloseTo(10, 5);
  });
});

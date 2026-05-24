import { describe, expect, it } from "vitest";
import {
  createRulerState,
  projectPointToRuler,
  snapRulerAngle,
} from "./ruler";

describe("ruler geometry", () => {
  it("snaps angles to common increments", () => {
    expect(snapRulerAngle(2)).toBe(0);
    expect(snapRulerAngle(43)).toBe(45);
    expect(snapRulerAngle(91)).toBe(90);
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
});

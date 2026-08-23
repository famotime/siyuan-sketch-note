import { describe, it, expect } from "vitest";
import { SpringMassStabilizer, DEFAULT_STABILIZER_OPTIONS } from "./springMassStabilizer";

describe("SpringMassStabilizer", () => {
  it("should initialize at starting point correctly", () => {
    const stabilizer = new SpringMassStabilizer({ x: 100, y: 100, pressure: 0.5 });
    const current = stabilizer.getCurrentStrokePoint();
    expect(current.x).toBe(100);
    expect(current.y).toBe(100);
    expect(current.pressure).toBe(0.5);
  });

  it("should generate interpolated points towards target point on step", () => {
    const stabilizer = new SpringMassStabilizer(
      { x: 0, y: 0, pressure: 0.2 },
      DEFAULT_STABILIZER_OPTIONS.smooth,
      1000,
    );

    stabilizer.setTarget({ x: 100, y: 100, pressure: 0.8 });
    const points = stabilizer.step(1016); // 16ms step

    expect(points.length).toBeGreaterThan(0);
    const last = points[points.length - 1];
    expect(last.x).toBeGreaterThan(0);
    expect(last.x).toBeLessThanOrEqual(100);
    expect(last.y).toBeGreaterThan(0);
    expect(last.y).toBeLessThanOrEqual(100);
  });

  it("should sub-step for large distance jumps", () => {
    const stabilizer = new SpringMassStabilizer(
      { x: 0, y: 0, pressure: 0.5 },
      { ...DEFAULT_STABILIZER_OPTIONS.smooth, maxPointDist: 10 },
      1000,
    );

    stabilizer.setTarget({ x: 200, y: 200, pressure: 0.5 });
    const points = stabilizer.step(1016);

    // 200px distance with maxPointDist 10 should produce multiple sub-steps
    expect(points.length).toBeGreaterThan(1);
    for (let i = 1; i < points.length; i++) {
      const stepDist = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      expect(stepDist).toBeLessThan(150); // Each sub-step is bounded
    }
  });

  it("should finalize to target endpoint when finish is called", () => {
    const stabilizer = new SpringMassStabilizer(
      { x: 10, y: 10, pressure: 0.5 },
      DEFAULT_STABILIZER_OPTIONS.smooth,
      1000,
    );

    stabilizer.setTarget({ x: 12, y: 12, pressure: 0.9 });
    const finalPoints = stabilizer.finish(1020);

    expect(finalPoints.length).toBeGreaterThanOrEqual(1);
    const finalPt = finalPoints[finalPoints.length - 1];
    expect(finalPt.x).toBe(12);
    expect(finalPt.y).toBe(12);
    expect(finalPt.pressure).toBe(0.9);
  });
});

import { describe, expect, it } from "vitest";
import type { StrokePoint } from "@/types/sketch";
import {
  getBrushOpacity,
  getBrushPressureWidth,
  filterStrokePointsByDistance,
  getPressureWidth,
  getSmoothedSegments,
} from "./strokeSmoothing";

function pt(x: number, y: number, pressure = 0.5): StrokePoint {
  return {
    x,
    y,
    pressure,
    timestamp: x + y,
  };
}

describe("stroke smoothing", () => {
  it("filters jitter points while preserving first and last points", () => {
    const points = [
      pt(0, 0),
      pt(0.3, 0.2),
      pt(0.6, 0.2),
      pt(4, 0),
      pt(4.2, 0.1),
      pt(8, 0),
    ];

    expect(filterStrokePointsByDistance(points, 2)).toEqual([
      points[0],
      points[3],
      points[5],
    ]);
  });

  it("returns stable quadratic segments that end at the final point", () => {
    const points = [
      pt(0, 0),
      pt(10, 0),
      pt(20, 10),
      pt(30, 10),
    ];

    expect(getSmoothedSegments(points)).toEqual([
      {
        control: pt(10, 0),
        end: { x: 15, y: 5 },
      },
      {
        control: pt(20, 10),
        end: { x: 25, y: 10 },
      },
      {
        control: pt(30, 10),
        end: pt(30, 10),
      },
    ]);
  });

  it("maps pressure to visible line width within a bounded range", () => {
    expect(getPressureWidth(10, 0)).toBe(5);
    expect(getPressureWidth(10, 0.5)).toBe(10);
    expect(getPressureWidth(10, 1)).toBe(15);
    expect(getPressureWidth(10, 3)).toBe(15);
  });

  it("maps brush profile pressure to width and opacity independently", () => {
    const pencil = {
      id: "pen.pencil",
      tool: "pen" as const,
      sizePressure: { min: 0.85, max: 1.15, curve: "linear" as const },
      opacityPressure: { min: 0.6, max: 1, curve: "linear" as const },
      flow: 0.82,
      taper: { start: 0.12, end: 0.18 },
      lineCap: "round" as const,
      lineJoin: "round" as const,
      texture: { kind: "grain" as const, amount: 0.18 },
      smoothing: 0.55,
      blendMode: "source-over" as const,
    };

    expect(getBrushPressureWidth(10, 0, pencil)).toBe(8.5);
    expect(getBrushPressureWidth(10, 1, pencil)).toBe(11.5);
    expect(getBrushOpacity(0.65, 0, pencil)).toBeCloseTo(0.3198, 4);
    expect(getBrushOpacity(0.65, 1, pencil)).toBeCloseTo(0.533, 4);
  });
});

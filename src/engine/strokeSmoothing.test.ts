import { describe, expect, it } from "vitest";
import type { StrokePoint } from "@/types/sketch";
import {
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
});

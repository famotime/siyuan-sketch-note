import { describe, expect, it } from "vitest";
import type { Stroke } from "@/types/sketch";
import {
  migrateSketchData,
  recoverSketchData,
} from "./migrations";

const stroke: Stroke = {
  id: "stroke-1",
  tool: "pen",
  color: "#000000",
  width: 8,
  opacity: 1,
  points: [
    { x: 10, y: 20, pressure: 0.5, timestamp: 1 },
    { x: 30, y: 40, pressure: 0.5, timestamp: 2 },
  ],
};

describe("sketch data migrations", () => {
  it("migrates legacy v1 data without elements into stroke elements", () => {
    const data = migrateSketchData({
      version: 1,
      template: "grid",
      canvasWidth: 800,
      canvasHeight: 1200,
      strokes: [stroke],
    });

    expect(data.elements).toHaveLength(1);
    expect(data.elements?.[0]).toMatchObject({
      id: "stroke-1",
      type: "stroke",
      stroke,
    });
  });

  it("recovers corrupted data to an empty sketch and preserves the raw payload", () => {
    const result = recoverSketchData({
      version: 1,
      template: "grid",
      canvasWidth: 800,
      canvasHeight: 1200,
      strokes: "not-array",
    });

    expect(result.data.strokes).toEqual([]);
    expect(result.data.elements).toEqual([]);
    expect(result.recovered).toBe(true);
    expect(result.reason).toContain("strokes");
    expect(result.data.recovery).toMatchObject({
      recovered: true,
      reason: expect.stringContaining("strokes"),
    });
    expect(result.raw).toMatchObject({ strokes: "not-array" });
  });
});

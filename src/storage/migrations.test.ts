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
    expect(data.strokes[0].bounds).toEqual({
      x: 6,
      y: 16,
      width: 28,
      height: 28,
    });
    expect(data.elements?.[0]).toMatchObject({
      id: "stroke-1",
      type: "stroke",
      stroke: {
        ...stroke,
        bounds: {
          x: 6,
          y: 16,
          width: 28,
          height: 28,
        },
      },
    });
    expect(data.recentColors.slice(0, 5)).toEqual(["#000000", "#e74c3c", "#3498db", "#2ecc71", "#f39c12"]);
  });

  it("normalizes persisted recent color slots", () => {
    const data = migrateSketchData({
      version: 1,
      template: "grid",
      canvasWidth: 800,
      canvasHeight: 1200,
      recentColors: ["#ABCDEF", "not-color", "#abcdef", "#123456"],
      strokes: [],
    });

    expect(data.recentColors.slice(0, 6)).toEqual([
      "#abcdef",
      "#123456",
      "#000000",
      "#e74c3c",
      "#3498db",
      "#2ecc71",
    ]);
  });

  it("normalizes persisted highlighter color slots independently", () => {
    const data = migrateSketchData({
      version: 1,
      template: "grid",
      canvasWidth: 800,
      canvasHeight: 1200,
      recentColors: ["#111111"],
      highlighterRecentColors: ["#FFF176", "not-color", "#abcdef"],
      strokes: [],
    });

    expect(data.recentColors[0]).toBe("#111111");
    expect(data.highlighterRecentColors?.slice(0, 3)).toEqual([
      "#fff176",
      "#abcdef",
      "#81c784",
    ]);
    expect(data.recentColors).not.toContain("#abcdef");
  });

  it("reconstructs missing page metadata for paged sketches", () => {
    const data = migrateSketchData({
      version: 1,
      template: "grid",
      canvasWidth: 800,
      canvasHeight: 2000,
      pageMode: "paged",
      strokes: [],
    });

    expect(data.pages).toEqual([
      { id: "page-1", index: 0, x: 0, y: 0, width: 800, height: 1000 },
      { id: "page-2", index: 1, x: 0, y: 1000, width: 800, height: 1000 },
    ]);
    expect(data.activePageId).toBe("page-1");
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

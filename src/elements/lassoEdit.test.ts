import { describe, expect, it } from "vitest";
import type { SketchElement } from "./model";
import {
  duplicateLassoSelection,
  duplicateStrokeSelection,
  recolorStrokeSelection,
  recolorLassoSelection,
  removeLassoSelection,
  removeStrokeSelection,
  translateStrokeSelection,
  translateLassoSelection,
} from "./lassoEdit";

const elements: SketchElement[] = [
  {
    id: "stroke-1",
    type: "stroke",
    stroke: {
      id: "stroke-1",
      tool: "pen",
      color: "#000000",
      width: 4,
      points: [
        { x: 10, y: 10, pressure: 0.5, timestamp: 1 },
        { x: 30, y: 30, pressure: 0.5, timestamp: 2 },
      ],
      bounds: { x: 8, y: 8, width: 24, height: 24 },
    },
    bounds: { x: 8, y: 8, width: 24, height: 24 },
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    zIndex: 0,
  },
  {
    id: "text-1",
    type: "text",
    text: "hello",
    bounds: { x: 100, y: 120, width: 160, height: 48 },
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    zIndex: 1,
    style: {
      color: "#222222",
      fontSize: 18,
      fontFamily: "sans-serif",
    },
  },
];

describe("lasso edit operations", () => {
  it("moves only selected elements", () => {
    const next = translateLassoSelection(elements, ["stroke-1"], 20, 30);

    expect(next.find((element) => element.id === "stroke-1")?.bounds).toMatchObject({
      x: 28,
      y: 38,
    });
    expect(next.find((element) => element.id === "text-1")?.bounds).toMatchObject({
      x: 100,
      y: 120,
    });
  });

  it("removes selected elements without mutating the original list", () => {
    const next = removeLassoSelection(elements, ["text-1"]);

    expect(next.map((element) => element.id)).toEqual(["stroke-1"]);
    expect(elements.map((element) => element.id)).toEqual(["stroke-1", "text-1"]);
  });

  it("recolors selected stroke elements and leaves non-stroke elements unchanged", () => {
    const next = recolorLassoSelection(elements, ["stroke-1", "text-1"], "#e74c3c");

    const stroke = next.find((element) => element.id === "stroke-1");
    const text = next.find((element) => element.id === "text-1");
    expect(stroke?.type).toBe("stroke");
    if (stroke?.type === "stroke") {
      expect(stroke.stroke.color).toBe("#e74c3c");
    }
    expect(text).toMatchObject(elements[1]);
  });

  it("moves selected stroke points", () => {
    const next = translateStrokeSelection([elements[0].stroke], ["stroke-1"], 5, 7);

    expect(next[0].points).toEqual([
      { x: 15, y: 17, pressure: 0.5, timestamp: 1 },
      { x: 35, y: 37, pressure: 0.5, timestamp: 2 },
    ]);
    expect(next[0].bounds).toEqual({ x: 13, y: 15, width: 24, height: 24 });
  });

  it("removes selected strokes", () => {
    expect(removeStrokeSelection([elements[0].stroke], ["stroke-1"])).toEqual([]);
  });

  it("recolors selected strokes", () => {
    const next = recolorStrokeSelection([elements[0].stroke], ["stroke-1"], "#3498db");

    expect(next[0].color).toBe("#3498db");
  });

  it("duplicates selected elements with new ids and an offset", () => {
    const next = duplicateLassoSelection(elements, ["text-1"], 12, 16, (id) => `copy-${id}`);

    expect(next).toHaveLength(3);
    expect(next[2]).toMatchObject({
      id: "copy-text-1",
      type: "text",
      bounds: { x: 112, y: 136, width: 160, height: 48 },
    });
    expect(elements).toHaveLength(2);
  });

  it("duplicates selected strokes with new ids and shifted points", () => {
    const next = duplicateStrokeSelection([elements[0].stroke], ["stroke-1"], 12, 16, (id) => `copy-${id}`);

    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({
      id: "copy-stroke-1",
      points: [
        { x: 22, y: 26, pressure: 0.5, timestamp: 1 },
        { x: 42, y: 46, pressure: 0.5, timestamp: 2 },
      ],
      bounds: { x: 20, y: 24, width: 24, height: 24 },
    });
  });
});

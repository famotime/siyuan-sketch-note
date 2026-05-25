import { describe, expect, it } from "vitest";
import type { Stroke } from "@/types/sketch";
import {
  loadSketchData,
  storageKey,
} from ".";

const legacyStorageKey = (blockId: string) => `sketch:${blockId}`;

const stroke: Stroke = {
  id: "stroke-1",
  tool: "pen",
  color: "#111111",
  width: 4,
  opacity: 1,
  points: [
    { x: 10, y: 20, pressure: 0.5, timestamp: 1 },
    { x: 30, y: 40, pressure: 0.5, timestamp: 2 },
  ],
};

describe("sketch storage", () => {
  it("uses a filesystem-safe storage key", () => {
    const key = storageKey("block-1");

    expect(key).toBe("sketch-block-1.json");
    expect(key).not.toMatch(/[<>:"/\\|?*]/);
  });

  it("falls back to legacy colon-prefixed storage keys", async () => {
    const keys: string[] = [];
    const data = await loadSketchData(async (key) => {
      keys.push(key);
      return key === legacyStorageKey("block-1")
        ? {
            version: 1,
            template: "blank",
            canvasWidth: 800,
            canvasHeight: 1200,
            strokes: [stroke],
          }
        : null;
    }, "block-1");

    expect(keys).toEqual([
      storageKey("block-1"),
      legacyStorageKey("block-1"),
    ]);
    expect(data?.strokes).toHaveLength(1);
  });

  it("loads legacy v1 data through migrations", async () => {
    const data = await loadSketchData(async (key) => {
      expect(key).toBe(storageKey("block-1"));
      return {
        version: 1,
        template: "blank",
        canvasWidth: 800,
        canvasHeight: 1200,
        strokes: [stroke],
      };
    }, "block-1");

    expect(data?.elements).toHaveLength(1);
    expect(data?.elements?.[0]).toMatchObject({ type: "stroke", stroke });
  });

  it("recovers corrupted saved data as an empty editable sketch", async () => {
    const data = await loadSketchData(async () => ({
      version: 1,
      template: "grid",
      canvasWidth: 800,
      canvasHeight: 1200,
      strokes: null,
    }), "block-1");

    expect(data).toMatchObject({
      version: 1,
      template: "blank",
      canvasWidth: 800,
      canvasHeight: 1200,
      strokes: [],
      elements: [],
    });
  });
});

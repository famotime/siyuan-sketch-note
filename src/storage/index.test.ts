import { describe, expect, it } from "vitest";
import type { Stroke } from "@/types/sketch";
import {
  createEmptySketchData,
  loadEditorPreferences,
  loadSketchData,
  saveEditorPreferences,
  storageKey,
  editorPreferencesKey,
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

  it("uses a stable editor preferences storage key", () => {
    expect(editorPreferencesKey()).toBe("sketch-editor-preferences.json");
  });

  it("loads normalized editor preferences", async () => {
    const preferences = await loadEditorPreferences(async (key) => {
      expect(key).toBe(editorPreferencesKey());
      return {
        template: "grid",
        inputSettings: { stylusOnly: true },
      };
    });

    expect(preferences).toEqual({
      template: "grid",
      inputSettings: {
        stylusOnly: true,
        enablePressure: false,
      },
      customBackgrounds: [],
    });
  });

  it("saves normalized editor preferences", async () => {
    const saved: Array<{ key: string; data: any }> = [];

    await saveEditorPreferences(async (key, data) => {
      saved.push({ key, data });
    }, {
      template: "grid",
      inputSettings: { stylusOnly: true, enablePressure: true },
    });

    expect(saved).toEqual([{
      key: editorPreferencesKey(),
      data: {
        template: "grid",
        inputSettings: {
          stylusOnly: true,
          enablePressure: true,
        },
        customBackgrounds: [],
      },
    }]);
  });

  it("creates empty sketch data from editor preferences", () => {
    const data = createEmptySketchData({
      template: "custom:bg-1",
      inputSettings: { stylusOnly: true, enablePressure: true },
      customBackgrounds: [{
        id: "custom:bg-1",
        nameKey: "templateCustomBackground",
        src: "data:image/png;base64,AAA",
        fit: "contain",
      }],
    });

    expect(data).toMatchObject({
      template: "custom:bg-1",
      inputSettings: { stylusOnly: true, enablePressure: true },
      customBackgrounds: [{
        id: "custom:bg-1",
        fit: "contain",
      }],
      elements: [],
      strokes: [],
    });
  });
});

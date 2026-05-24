import { describe, expect, it } from "vitest";
import {
  createDefaultToolPresets,
  normalizeToolPreset,
  updateToolPreset,
} from "./presets";

describe("tool presets", () => {
  it("creates independent defaults for pen, highlighter, and eraser", () => {
    const presets = createDefaultToolPresets();

    expect(presets.pen).toMatchObject({
      tool: "pen",
      color: "#000000",
      width: 3,
      opacity: 1,
      mode: "ink",
    });
    expect(presets.highlighter).toMatchObject({
      tool: "highlighter",
      color: "#fff176",
      width: 18,
      opacity: 0.45,
      mode: "marker",
    });
    expect(presets.eraser).toMatchObject({
      tool: "eraser",
      color: "#000000",
      width: 20,
      opacity: 1,
      mode: "pixel",
    });
  });

  it("clamps width and opacity when normalizing a preset", () => {
    expect(normalizeToolPreset({
      tool: "pen",
      color: "#111111",
      width: 0,
      opacity: 3,
      mode: "ink",
    })).toMatchObject({
      width: 1,
      opacity: 1,
    });

    expect(normalizeToolPreset({
      tool: "highlighter",
      color: "#222222",
      width: 80,
      opacity: -1,
      mode: "marker",
    })).toMatchObject({
      width: 30,
      opacity: 0.1,
    });
  });

  it("updates one preset without mutating the original preset collection", () => {
    const presets = createDefaultToolPresets();
    const updated = updateToolPreset(presets, "highlighter", {
      width: 24,
      opacity: 0.6,
    });

    expect(updated.highlighter.width).toBe(24);
    expect(updated.highlighter.opacity).toBe(0.6);
    expect(presets.highlighter.width).toBe(18);
    expect(updated.pen).toEqual(presets.pen);
    expect(updated.eraser).toEqual(presets.eraser);
  });
});

import { describe, expect, it } from "vitest";
import {
  createDefaultToolPresets,
  getBrushProfileForPreset,
  normalizeToolPreset,
  updateToolPreset,
} from "./presets";

describe("tool presets", () => {
  it("creates independent defaults for pen, highlighter, and eraser", () => {
    const presets = createDefaultToolPresets();

    expect(presets.pen).toMatchObject({
      tool: "pen",
      color: "#1f2a7a",
      width: 1.8,
      opacity: 1,
      mode: "ink",
      penSubtype: "ballpoint",
      brushProfileId: "pen.ballpoint",
    });
    expect(presets.highlighter).toMatchObject({
      tool: "highlighter",
      color: "#fff176",
      width: 21,
      opacity: 0.36,
      mode: "marker",
      highlighterSubtype: "round",
      brushProfileId: "highlighter.round",
    });
    expect(presets.eraser).toMatchObject({
      tool: "eraser",
      color: "#000000",
      width: 24,
      opacity: 1,
      mode: "pixel",
      brushProfileId: "eraser.pixel",
    });
  });

  it("resolves brush profiles with richer rendering controls", () => {
    const presets = createDefaultToolPresets();

    expect(getBrushProfileForPreset(presets.pen)).toMatchObject({
      id: "pen.ballpoint",
      sizePressure: { min: 0.95, max: 1.08, curve: "linear" },
      opacityPressure: { min: 1, max: 1, curve: "linear" },
      flow: 1,
      taper: { start: 0.05, end: 0.08 },
      lineCap: "round",
      lineJoin: "round",
    });

    expect(getBrushProfileForPreset({
      ...presets.highlighter,
      highlighterSubtype: "square",
      brushProfileId: "highlighter.square",
    })).toMatchObject({
      id: "highlighter.square",
      lineCap: "butt",
      flow: 0.72,
      opacityPressure: { min: 1, max: 1, curve: "linear" },
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
      brushProfileId: "pen.ballpoint",
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
    expect(presets.highlighter.width).toBe(21);
    expect(updated.pen).toEqual(presets.pen);
    expect(updated.eraser).toEqual(presets.eraser);
  });
});

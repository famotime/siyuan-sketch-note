import type { SketchTool, ToolPreset, ToolPresetCollection } from "@/types/sketch";
import {
  DEFAULT_ERASER_WIDTH,
  DEFAULT_HIGHLIGHTER_WIDTH,
  DEFAULT_PEN_WIDTH,
} from "@/types/sketch";

const MIN_WIDTH = 1;
const MAX_WIDTH = 30;
const MIN_OPACITY = 0.1;
const MAX_OPACITY = 1;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createDefaultToolPresets(): ToolPresetCollection {
  return {
    pen: {
      tool: "pen",
      color: "#000000",
      width: DEFAULT_PEN_WIDTH,
      opacity: 1,
      mode: "ink",
    },
    highlighter: {
      tool: "highlighter",
      color: "#fff176",
      width: DEFAULT_HIGHLIGHTER_WIDTH,
      opacity: 0.45,
      mode: "marker",
    },
    eraser: {
      tool: "eraser",
      color: "#000000",
      width: DEFAULT_ERASER_WIDTH,
      opacity: 1,
      mode: "pixel",
    },
  };
}

export function normalizeToolPreset(preset: ToolPreset): ToolPreset {
  return {
    ...preset,
    width: clamp(Number.isFinite(preset.width) ? preset.width : MIN_WIDTH, MIN_WIDTH, MAX_WIDTH),
    opacity: clamp(Number.isFinite(preset.opacity) ? preset.opacity : MAX_OPACITY, MIN_OPACITY, MAX_OPACITY),
  };
}

export function normalizeToolPresets(input?: Partial<ToolPresetCollection>): ToolPresetCollection {
  const defaults = createDefaultToolPresets();
  return {
    pen: normalizeToolPreset({
      ...defaults.pen,
      ...input?.pen,
      tool: "pen",
    }),
    highlighter: normalizeToolPreset({
      ...defaults.highlighter,
      ...input?.highlighter,
      tool: "highlighter",
    }),
    eraser: normalizeToolPreset({
      ...defaults.eraser,
      ...input?.eraser,
      tool: "eraser",
    }),
  };
}

export function updateToolPreset(
  presets: ToolPresetCollection,
  tool: SketchTool,
  patch: Partial<Omit<ToolPreset, "tool">>,
): ToolPresetCollection {
  return {
    ...presets,
    [tool]: normalizeToolPreset({
      ...presets[tool],
      ...patch,
      tool,
    }),
  };
}

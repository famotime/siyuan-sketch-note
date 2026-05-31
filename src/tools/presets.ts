import type {
  SketchTool,
  ToolPreset,
  ToolPresetCollection,
  PenSubtype,
  HighlighterSubtype,
} from "@/types/sketch";
import {
  DEFAULT_ERASER_WIDTH,
  DEFAULT_PEN_SUBTYPE,
  DEFAULT_HIGHLIGHTER_SUBTYPE,
  PEN_SUBTYPE_DEFAULTS,
  HIGHLIGHTER_SUBTYPE_DEFAULTS,
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
      ...PEN_SUBTYPE_DEFAULTS[DEFAULT_PEN_SUBTYPE],
      mode: "ink",
      penSubtype: DEFAULT_PEN_SUBTYPE,
    },
    highlighter: {
      tool: "highlighter",
      ...HIGHLIGHTER_SUBTYPE_DEFAULTS[DEFAULT_HIGHLIGHTER_SUBTYPE],
      mode: "marker",
      highlighterSubtype: DEFAULT_HIGHLIGHTER_SUBTYPE,
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
  const normalized = {
    ...preset,
    width: clamp(Number.isFinite(preset.width) ? preset.width : MIN_WIDTH, MIN_WIDTH, MAX_WIDTH),
    opacity: clamp(Number.isFinite(preset.opacity) ? preset.opacity : MAX_OPACITY, MIN_OPACITY, MAX_OPACITY),
  };
  if (normalized.tool === "pen" && !normalized.penSubtype) {
    normalized.penSubtype = DEFAULT_PEN_SUBTYPE;
  }
  if (normalized.tool === "highlighter" && !normalized.highlighterSubtype) {
    normalized.highlighterSubtype = DEFAULT_HIGHLIGHTER_SUBTYPE;
  }
  return normalized;
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

export function applyPenSubtypeDefaults(
  presets: ToolPresetCollection,
  subtype: PenSubtype,
): ToolPresetCollection {
  const defaults = PEN_SUBTYPE_DEFAULTS[subtype];
  return {
    ...presets,
    pen: normalizeToolPreset({
      ...presets.pen,
      ...defaults,
      tool: "pen",
      mode: "ink",
      penSubtype: subtype,
    }),
  };
}

export function applyHighlighterSubtypeDefaults(
  presets: ToolPresetCollection,
  subtype: HighlighterSubtype,
): ToolPresetCollection {
  const defaults = HIGHLIGHTER_SUBTYPE_DEFAULTS[subtype];
  return {
    ...presets,
    highlighter: normalizeToolPreset({
      ...presets.highlighter,
      ...defaults,
      tool: "highlighter",
      mode: "marker",
      highlighterSubtype: subtype,
    }),
  };
}

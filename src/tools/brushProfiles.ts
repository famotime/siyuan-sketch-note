import type { BrushProfile, HighlighterSubtype, PenSubtype, SketchTool, ToolPreset } from "@/types/sketch";
import {
  DEFAULT_HIGHLIGHTER_SUBTYPE,
  DEFAULT_PEN_SUBTYPE,
} from "@/types/sketch";

export const PEN_BRUSH_PROFILE_IDS: Record<PenSubtype, string> = {
  pencil: "pen.pencil",
  ballpoint: "pen.ballpoint",
  fountain: "pen.fountain",
  brush: "pen.brush",
};

export const HIGHLIGHTER_BRUSH_PROFILE_IDS: Record<HighlighterSubtype, string> = {
  round: "highlighter.round",
  square: "highlighter.square",
  watercolor: "highlighter.watercolor",
};

export const ERASER_BRUSH_PROFILE_ID = "eraser.pixel";

export const BRUSH_PROFILES: Record<string, BrushProfile> = {
  [PEN_BRUSH_PROFILE_IDS.pencil]: {
    id: PEN_BRUSH_PROFILE_IDS.pencil,
    tool: "pen",
    sizePressure: { min: 0.85, max: 1.15, curve: "linear" },
    opacityPressure: { min: 0.6, max: 1, curve: "linear" },
    flow: 0.82,
    taper: { start: 0.12, end: 0.18 },
    lineCap: "round",
    lineJoin: "round",
    texture: { kind: "grain", amount: 0.18 },
    smoothing: 0.55,
    blendMode: "source-over",
  },
  [PEN_BRUSH_PROFILE_IDS.ballpoint]: {
    id: PEN_BRUSH_PROFILE_IDS.ballpoint,
    tool: "pen",
    sizePressure: { min: 0.95, max: 1.08, curve: "linear" },
    opacityPressure: { min: 1, max: 1, curve: "linear" },
    flow: 1,
    taper: { start: 0.05, end: 0.08 },
    lineCap: "round",
    lineJoin: "round",
    texture: { kind: "none", amount: 0 },
    smoothing: 0.72,
    blendMode: "source-over",
  },
  [PEN_BRUSH_PROFILE_IDS.fountain]: {
    id: PEN_BRUSH_PROFILE_IDS.fountain,
    tool: "pen",
    sizePressure: { min: 0.55, max: 1.9, curve: "sigmoid" },
    opacityPressure: { min: 0.92, max: 1, curve: "linear" },
    flow: 0.96,
    taper: { start: 0.14, end: 0.2 },
    lineCap: "round",
    lineJoin: "round",
    texture: { kind: "none", amount: 0 },
    smoothing: 0.78,
    blendMode: "source-over",
  },
  [PEN_BRUSH_PROFILE_IDS.brush]: {
    id: PEN_BRUSH_PROFILE_IDS.brush,
    tool: "pen",
    sizePressure: { min: 0.32, max: 2.35, curve: "sigmoid" },
    opacityPressure: { min: 0.88, max: 1, curve: "linear" },
    flow: 0.94,
    taper: { start: 0.22, end: 0.3 },
    lineCap: "round",
    lineJoin: "round",
    texture: { kind: "none", amount: 0 },
    smoothing: 0.82,
    blendMode: "source-over",
  },
  [HIGHLIGHTER_BRUSH_PROFILE_IDS.round]: {
    id: HIGHLIGHTER_BRUSH_PROFILE_IDS.round,
    tool: "highlighter",
    sizePressure: { min: 1, max: 1, curve: "linear" },
    opacityPressure: { min: 1, max: 1, curve: "linear" },
    flow: 0.78,
    taper: { start: 0, end: 0 },
    lineCap: "round",
    lineJoin: "round",
    texture: { kind: "none", amount: 0 },
    smoothing: 0.65,
    blendMode: "source-over",
  },
  [HIGHLIGHTER_BRUSH_PROFILE_IDS.square]: {
    id: HIGHLIGHTER_BRUSH_PROFILE_IDS.square,
    tool: "highlighter",
    sizePressure: { min: 1, max: 1, curve: "linear" },
    opacityPressure: { min: 1, max: 1, curve: "linear" },
    flow: 0.72,
    taper: { start: 0, end: 0 },
    lineCap: "butt",
    lineJoin: "miter",
    texture: { kind: "none", amount: 0 },
    smoothing: 0.55,
    blendMode: "source-over",
  },
  [HIGHLIGHTER_BRUSH_PROFILE_IDS.watercolor]: {
    id: HIGHLIGHTER_BRUSH_PROFILE_IDS.watercolor,
    tool: "highlighter",
    sizePressure: { min: 0.95, max: 1.08, curve: "linear" },
    opacityPressure: { min: 0.85, max: 1, curve: "linear" },
    flow: 0.58,
    taper: { start: 0.08, end: 0.12 },
    lineCap: "round",
    lineJoin: "round",
    texture: { kind: "wash", amount: 0.12 },
    smoothing: 0.7,
    blendMode: "source-over",
  },
  [ERASER_BRUSH_PROFILE_ID]: {
    id: ERASER_BRUSH_PROFILE_ID,
    tool: "eraser",
    sizePressure: { min: 1, max: 1, curve: "linear" },
    opacityPressure: { min: 1, max: 1, curve: "linear" },
    flow: 1,
    taper: { start: 0, end: 0 },
    lineCap: "round",
    lineJoin: "round",
    texture: { kind: "none", amount: 0 },
    smoothing: 0.45,
    blendMode: "destination-out",
  },
};

export function getDefaultBrushProfileId(tool: SketchTool, preset?: Partial<ToolPreset>): string {
  if (tool === "pen") {
    const subtype = preset?.penSubtype ?? DEFAULT_PEN_SUBTYPE;
    return PEN_BRUSH_PROFILE_IDS[subtype];
  }
  if (tool === "highlighter") {
    const subtype = preset?.highlighterSubtype ?? DEFAULT_HIGHLIGHTER_SUBTYPE;
    return HIGHLIGHTER_BRUSH_PROFILE_IDS[subtype];
  }
  return ERASER_BRUSH_PROFILE_ID;
}

export function resolveBrushProfile(profileId: string | undefined, tool: SketchTool, preset?: Partial<ToolPreset>): BrushProfile {
  const fallbackId = getDefaultBrushProfileId(tool, preset);
  const profile = profileId ? BRUSH_PROFILES[profileId] : undefined;
  return profile?.tool === tool ? profile : BRUSH_PROFILES[fallbackId];
}

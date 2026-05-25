import type { Bounds, SketchElement } from "@/elements/model";
import type { SketchInputSettings } from "@/editor/inputMode";
import type { OcrIndex } from "@/search/ocrIndex";
import type { CustomBackgroundTemplate } from "@/template/customBackground";

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number; // 0~1, default 0.5 when unavailable
  timestamp: number; // ms
}

export interface Stroke {
  id: string;
  points: StrokePoint[];
  color: string; // hex color
  width: number; // base line width in px
  opacity?: number; // 0~1, default 1 for old data
  tool: SketchTool;
  bounds?: Bounds; // precomputed bounds for large documents
  isShape?: boolean; // 是否为几何形状（跳过贝塞尔平滑）
}

export interface SketchData {
  version: 1;
  template: string; // template id: "blank" | "grid"
  canvasWidth: number;
  canvasHeight: number;
  pageMode?: SketchPageMode;
  pages?: SketchPage[];
  activePageId?: string;
  recovery?: SketchDataRecoveryInfo;
  ocrIndex?: OcrIndex;
  toolPresets?: ToolPresetCollection;
  inputSettings?: SketchInputSettings;
  customBackgrounds?: CustomBackgroundTemplate[];
  recentColors?: string[];
  elements?: SketchElement[];
  strokes: Stroke[];
}

export interface SketchDataRecoveryInfo {
  recovered: boolean;
  reason: string;
}

export type SketchPageMode = "infinite" | "paged";

export interface SketchPage {
  id: string;
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const DEFAULT_SKETCH_DATA: SketchData = {
  version: 1,
  template: "blank",
  canvasWidth: 800,
  canvasHeight: 1200,
  strokes: [],
};

export type SketchTool = "pen" | "highlighter" | "eraser";

export interface ToolPreset {
  tool: SketchTool;
  color: string;
  width: number;
  opacity: number;
  mode: "ink" | "marker" | "pixel" | "stroke";
}

export type ToolPresetCollection = Record<SketchTool, ToolPreset>;

export const PRESET_COLORS = [
  "#000000",
  "#e74c3c",
  "#3498db",
  "#2ecc71",
  "#f39c12",
] as const;

export const HIGHLIGHTER_PRESET_COLORS = [
  "#fff176", // 荧光黄 (默认)
  "#81c784", // 荧光绿
  "#ffb74d", // 荧光橙
  "#64b5f6", // 荧光蓝
  "#f06292", // 荧光粉
] as const;

export const DEFAULT_PEN_WIDTH = 3;
export const DEFAULT_HIGHLIGHTER_WIDTH = 18;
export const DEFAULT_ERASER_WIDTH = 20;
export const CANVAS_LOGICAL_WIDTH = 800;
export const CANVAS_INITIAL_HEIGHT = 1200;
export const CANVAS_HEIGHT_INCREMENT = 600;

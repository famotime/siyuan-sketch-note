import type { Stroke, ToolPreset } from "@/types/sketch";
import type { SketchElement } from "@/elements/model";
import type { ImageElement } from "@/elements/image";

export type ReplayEventType = ReplayEvent["type"];

export type ReplayToolSource = "mainToolbar" | "floatingToolbar" | "topBar" | "shortcut" | "canvas" | "paste";

export interface ImageTransformSample {
  offsetMs: number;
  bounds: ImageElement["bounds"];
  rotation: number;
  opacity: number;
  pointer?: { x: number; y: number };
}

export type ReplayEvent =
  | StrokeReplayEvent
  | EraseReplayEvent
  | ShapeReplayEvent
  | TextReplayEvent
  | ImageReplayEvent
  | ImageTransformReplayEvent
  | ImageDeleteReplayEvent
  | ToolSwitchReplayEvent;

export interface StrokeReplayEvent {
  type: "stroke";
  id: string;
  timestamp: number;
  stroke: Stroke;
}

export interface EraseReplayEvent {
  type: "erase";
  id: string;
  timestamp: number;
  erasedIds: string[];
}

export interface ShapeReplayEvent {
  type: "shape";
  id: string;
  timestamp: number;
  stroke: Stroke;
}

export interface TextReplayEvent {
  type: "text";
  id: string;
  timestamp: number;
  element: Extract<SketchElement, { type: "text" }>;
}

export interface ImageReplayEvent {
  type: "image";
  id: string;
  timestamp: number;
  element: Extract<SketchElement, { type: "image" }>;
  source?: ReplayToolSource;
  loadingMs?: number;
}

export interface ImageTransformReplayEvent {
  type: "imageTransform";
  id: string;
  timestamp: number;
  elementId: string;
  op: "move" | "resize" | "rotate" | "opacity";
  initialElement?: ImageElement;
  finalElement: ImageElement;
  points?: Array<{ x: number; y: number; timestamp: number }>;
  samples?: ImageTransformSample[];
}

export interface ImageDeleteReplayEvent {
  type: "imageDelete";
  id: string;
  timestamp: number;
  elementId: string;
}

export interface ToolSwitchReplayEvent {
  type: "toolSwitch";
  id: string;
  timestamp: number;
  tool: string;
  preset: ToolPreset;
  source?: ReplayToolSource;
}

export interface ReplayRecorderConfig {
  stroke: boolean;
  erase: boolean;
  shape: boolean;
  text: boolean;
  image: boolean;
  imageTransform: boolean;
  imageDelete: boolean;
  toolSwitch: boolean;
}

export const DEFAULT_RECORDER_CONFIG: ReplayRecorderConfig = {
  stroke: true,
  erase: true,
  shape: true,
  text: true,
  image: true,
  imageTransform: true,
  imageDelete: true,
  toolSwitch: true,
};

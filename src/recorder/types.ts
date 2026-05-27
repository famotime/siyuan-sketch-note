import type { Stroke, SketchTool, ToolPreset } from "@/types/sketch";
import type { SketchElement } from "@/elements/model";

export type ReplayEventType = ReplayEvent["type"];

export type ReplayEvent =
  | StrokeReplayEvent
  | EraseReplayEvent
  | ShapeReplayEvent
  | TextReplayEvent
  | ImageReplayEvent
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
}

export interface ToolSwitchReplayEvent {
  type: "toolSwitch";
  id: string;
  timestamp: number;
  tool: SketchTool;
  preset: ToolPreset;
}

export interface ReplayRecorderConfig {
  stroke: boolean;
  erase: boolean;
  shape: boolean;
  text: boolean;
  image: boolean;
  toolSwitch: boolean;
}

export const DEFAULT_RECORDER_CONFIG: ReplayRecorderConfig = {
  stroke: true,
  erase: true,
  shape: true,
  text: true,
  image: false,
  toolSwitch: false,
};

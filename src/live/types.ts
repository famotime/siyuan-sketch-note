import type { ReplayEvent } from "@/recorder/types";
import type { SketchData } from "@/types/sketch";

export type LiveRole = "writer" | "viewer";

export type LiveConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

export interface LiveChannelInfo {
  sketchId: string;
  channel: string;
  protocolVersion: 1;
}

/** MVP 只同步 stroke/erase/shape */
export type LiveSupportedEvent = Extract<
  ReplayEvent,
  { type: "stroke" | "erase" | "shape" }
>;

export type LiveMessage =
  | ClientHelloMessage
  | ServerReadyMessage
  | SketchSnapshotMessage
  | SketchEventMessage
  | ClientResumeMessage
  | LiveErrorMessage;

export interface ClientHelloMessage {
  type: "client.hello";
  clientId: string;
  sketchId: string;
  role: "writer";
  protocolVersion: 1;
}

export interface ServerReadyMessage {
  type: "server.ready";
  sketchId: string;
  accepted: boolean;
  protocolVersion: 1;
  requiredSnapshot: boolean;
}

export interface SketchSnapshotMessage {
  type: "sketch.snapshot";
  sketchId: string;
  revision: number;
  data: SketchData;
}

export interface SketchEventMessage {
  type: "sketch.event";
  sketchId: string;
  revision: number;
  event: LiveSupportedEvent;
}

export interface ClientResumeMessage {
  type: "client.resume";
  sketchId: string;
  lastKnownViewerRevision: number;
  writerRevision: number;
}

export interface LiveErrorMessage {
  type: "error";
  sketchId?: string;
  code: "unauthorized" | "revision_mismatch" | "unsupported_protocol" | "invalid_message";
  message: string;
}

export const LIVE_PROTOCOL_VERSION = 1;
export const LIVE_CHANNEL_PREFIX = "sketch";
export const LIVE_CHANNEL_SUFFIX = "live";
export const LIVE_EVENT_CACHE_SIZE = 500;

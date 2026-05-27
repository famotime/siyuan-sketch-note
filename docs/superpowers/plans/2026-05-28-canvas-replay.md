# Canvas Operation Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a canvas operation replay feature that records drawing operations as an event sequence and plays them back as a point-by-point animation with video-player-style controls.

**Architecture:** Independent recording layer (`src/recorder/`) decoupled from the canvas engine. `ReplayRecorder` captures events at operation completion points in SketchCanvas.vue. `ReplayPlayer` drives a temporary canvas for playback using `requestAnimationFrame`. Events are stored in `SketchData.replayEvents` for persistence.

**Tech Stack:** Vue 3 Composition API, TypeScript, HTML5 Canvas, requestAnimationFrame

---

### Task 1: Define ReplayEvent types

**Files:**
- Create: `src/recorder/types.ts`

- [ ] **Step 1: Create the ReplayEvent type definitions**

```typescript
// src/recorder/types.ts
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
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit src/recorder/types.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/recorder/types.ts
git commit -m "feat(recorder): 定义 ReplayEvent 类型和录制器配置"
```

---

### Task 2: Add replayEvents to SketchData

**Files:**
- Modify: `src/types/sketch.ts:24-41`

- [ ] **Step 1: Add import and replayEvents field to SketchData**

In `src/types/sketch.ts`, add import at top:

```typescript
import type { ReplayEvent } from "@/recorder/types";
```

Add `replayEvents` field to `SketchData` interface after `strokes`:

```typescript
export interface SketchData {
  version: 1;
  template: string;
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
  highlighterRecentColors?: string[];
  elements?: SketchElement[];
  strokes: Stroke[];
  replayEvents?: ReplayEvent[];
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/types/sketch.ts
git commit -m "feat(types): SketchData 添加 replayEvents 可选字段"
```

---

### Task 3: Implement ReplayRecorder with tests

**Files:**
- Create: `src/recorder/recorder.ts`
- Create: `src/recorder/recorder.test.ts`

- [ ] **Step 1: Write failing tests for ReplayRecorder**

```typescript
// src/recorder/recorder.test.ts
import { describe, it, expect } from "vitest";
import { ReplayRecorder } from "./recorder";
import type { StrokeReplayEvent, ToolSwitchReplayEvent } from "./types";

describe("ReplayRecorder", () => {
  it("records enabled events", () => {
    const recorder = new ReplayRecorder();
    const event: StrokeReplayEvent = {
      type: "stroke",
      id: "e1",
      timestamp: 1000,
      stroke: {
        id: "s1",
        points: [{ x: 0, y: 0, pressure: 0.5, timestamp: 1000 }],
        color: "#000",
        width: 3,
        tool: "pen",
      },
    };
    recorder.record(event);
    expect(recorder.getEvents()).toHaveLength(1);
    expect(recorder.getEvents()[0]).toBe(event);
  });

  it("filters disabled events", () => {
    const recorder = new ReplayRecorder();
    recorder.setEnabled("toolSwitch", false);
    const event: ToolSwitchReplayEvent = {
      type: "toolSwitch",
      id: "e1",
      timestamp: 1000,
      tool: "pen",
      preset: { tool: "pen", color: "#000", width: 3, opacity: 1, mode: "ink" },
    };
    recorder.record(event);
    expect(recorder.getEvents()).toHaveLength(0);
  });

  it("respects default config", () => {
    const recorder = new ReplayRecorder();
    const imageEvent = {
      type: "image" as const,
      id: "e1",
      timestamp: 1000,
      element: {
        id: "img1",
        type: "image" as const,
        src: "data:image/png;base64,abc",
        alt: "",
        opacity: 1,
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
        zIndex: 0,
      },
    };
    recorder.record(imageEvent);
    expect(recorder.getEvents()).toHaveLength(0); // image disabled by default
  });

  it("clear resets events", () => {
    const recorder = new ReplayRecorder();
    recorder.record({
      type: "stroke",
      id: "e1",
      timestamp: 1000,
      stroke: { id: "s1", points: [], color: "#000", width: 3, tool: "pen" },
    });
    recorder.clear();
    expect(recorder.getEvents()).toHaveLength(0);
  });

  it("setEnabled toggles filtering", () => {
    const recorder = new ReplayRecorder();
    recorder.setEnabled("image", true);
    const imageEvent = {
      type: "image" as const,
      id: "e1",
      timestamp: 1000,
      element: {
        id: "img1",
        type: "image" as const,
        src: "data:image/png;base64,abc",
        alt: "",
        opacity: 1,
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
        zIndex: 0,
      },
    };
    recorder.record(imageEvent);
    expect(recorder.getEvents()).toHaveLength(1);
  });

  it("getEvents returns a copy", () => {
    const recorder = new ReplayRecorder();
    recorder.record({
      type: "stroke",
      id: "e1",
      timestamp: 1000,
      stroke: { id: "s1", points: [], color: "#000", width: 3, tool: "pen" },
    });
    const events = recorder.getEvents();
    events.pop();
    expect(recorder.getEvents()).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/recorder/recorder.test.ts`
Expected: FAIL - module not found

- [ ] **Step 3: Implement ReplayRecorder**

```typescript
// src/recorder/recorder.ts
import type { ReplayEvent, ReplayEventType, ReplayRecorderConfig } from "./types";
import { DEFAULT_RECORDER_CONFIG } from "./types";

export class ReplayRecorder {
  private events: ReplayEvent[] = [];
  private config: ReplayRecorderConfig;

  constructor(config: Partial<ReplayRecorderConfig> = {}) {
    this.config = { ...DEFAULT_RECORDER_CONFIG, ...config };
  }

  record(event: ReplayEvent): void {
    if (!this.config[event.type]) return;
    this.events.push(event);
  }

  getEvents(): ReplayEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events = [];
  }

  setEnabled(type: ReplayEventType, enabled: boolean): void {
    this.config[type] = enabled;
  }

  isEnabled(type: ReplayEventType): boolean {
    return this.config[type];
  }

  getConfig(): ReplayRecorderConfig {
    return { ...this.config };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/recorder/recorder.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/recorder/recorder.ts src/recorder/recorder.test.ts
git commit -m "feat(recorder): 实现 ReplayRecorder 录制器"
```

---

### Task 4: Implement fallback reconstruction with tests

**Files:**
- Create: `src/recorder/reconstruct.ts`
- Create: `src/recorder/reconstruct.test.ts`

- [ ] **Step 1: Write failing tests for reconstructFromData**

```typescript
// src/recorder/reconstruct.test.ts
import { describe, it, expect } from "vitest";
import { reconstructFromData } from "./reconstruct";
import type { SketchData } from "@/types/sketch";

describe("reconstructFromData", () => {
  it("converts strokes to stroke events sorted by first point timestamp", () => {
    const data: SketchData = {
      version: 1,
      template: "blank",
      canvasWidth: 800,
      canvasHeight: 1200,
      strokes: [
        {
          id: "s2",
          points: [{ x: 10, y: 10, pressure: 0.5, timestamp: 2000 }],
          color: "#000",
          width: 3,
          tool: "pen",
        },
        {
          id: "s1",
          points: [{ x: 0, y: 0, pressure: 0.5, timestamp: 1000 }],
          color: "#000",
          width: 3,
          tool: "pen",
        },
      ],
    };
    const events = reconstructFromData(data);
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("stroke");
    expect(events[0].timestamp).toBe(1000);
    expect(events[1].timestamp).toBe(2000);
  });

  it("converts isShape strokes to shape events", () => {
    const data: SketchData = {
      version: 1,
      template: "blank",
      canvasWidth: 800,
      canvasHeight: 1200,
      strokes: [
        {
          id: "shape1",
          points: [
            { x: 0, y: 0, pressure: 0.5, timestamp: 1000 },
            { x: 100, y: 100, pressure: 0.5, timestamp: 1000 },
          ],
          color: "#000",
          width: 3,
          tool: "pen",
          isShape: true,
        },
      ],
    };
    const events = reconstructFromData(data);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("shape");
  });

  it("converts text elements to text events", () => {
    const data: SketchData = {
      version: 1,
      template: "blank",
      canvasWidth: 800,
      canvasHeight: 1200,
      strokes: [],
      elements: [
        {
          id: "text1",
          type: "text",
          text: "hello",
          bounds: { x: 10, y: 10, width: 100, height: 30 },
          style: { color: "#000", fontSize: 18, fontFamily: "sans-serif" },
          transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
          zIndex: 0,
        },
      ],
    };
    const events = reconstructFromData(data);
    const textEvents = events.filter((e) => e.type === "text");
    expect(textEvents).toHaveLength(1);
  });

  it("returns empty array for empty data", () => {
    const data: SketchData = {
      version: 1,
      template: "blank",
      canvasWidth: 800,
      canvasHeight: 1200,
      strokes: [],
    };
    expect(reconstructFromData(data)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/recorder/reconstruct.test.ts`
Expected: FAIL - module not found

- [ ] **Step 3: Implement reconstructFromData**

```typescript
// src/recorder/reconstruct.ts
import type { SketchData } from "@/types/sketch";
import type { ReplayEvent } from "./types";

let idCounter = 0;

function newEventId(): string {
  return `re-${Date.now()}-${++idCounter}`;
}

export function reconstructFromData(data: SketchData): ReplayEvent[] {
  const events: ReplayEvent[] = [];

  // Convert strokes to events, sorted by first point timestamp
  const sortedStrokes = [...data.strokes].sort((a, b) => {
    const tsA = a.points[0]?.timestamp ?? 0;
    const tsB = b.points[0]?.timestamp ?? 0;
    return tsA - tsB;
  });

  for (const stroke of sortedStrokes) {
    const timestamp = stroke.points[0]?.timestamp ?? 0;
    if (stroke.isShape) {
      events.push({ type: "shape", id: newEventId(), timestamp, stroke });
    } else {
      events.push({ type: "stroke", id: newEventId(), timestamp, stroke });
    }
  }

  // Convert non-stroke elements
  if (data.elements) {
    for (const element of data.elements) {
      if (element.type === "text") {
        events.push({ type: "text", id: newEventId(), timestamp: 0, element });
      } else if (element.type === "image") {
        events.push({ type: "image", id: newEventId(), timestamp: 0, element });
      }
      // Skip "stroke" elements — already handled via strokes array
    }
  }

  // Sort by timestamp (stable: strokes with timestamps come before elements with timestamp 0)
  events.sort((a, b) => a.timestamp - b.timestamp);

  return events;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/recorder/reconstruct.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/recorder/reconstruct.ts src/recorder/reconstruct.test.ts
git commit -m "feat(recorder): 实现降级重建逻辑 reconstructFromData"
```

---

### Task 5: Implement ReplayPlayer with tests

**Files:**
- Create: `src/recorder/player.ts`
- Create: `src/recorder/player.test.ts`

- [ ] **Step 1: Write failing tests for ReplayPlayer state machine**

```typescript
// src/recorder/player.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ReplayPlayer } from "./player";
import type { ReplayEvent } from "./types";

// Mock requestAnimationFrame
let rafCallback: FrameRequestCallback | null = null;
let rafId = 0;

beforeEach(() => {
  rafCallback = null;
  rafId = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    rafCallback = cb;
    return ++rafId;
  });
  vi.stubGlobal("cancelAnimationFrame", () => { rafCallback = null; });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function tickFrame(time: number) {
  if (rafCallback) {
    const cb = rafCallback;
    rafCallback = null;
    cb(time);
  }
}

const mockEvents: ReplayEvent[] = [
  {
    type: "stroke",
    id: "e1",
    timestamp: 1000,
    stroke: {
      id: "s1",
      points: [
        { x: 0, y: 0, pressure: 0.5, timestamp: 1000 },
        { x: 10, y: 10, pressure: 0.5, timestamp: 1010 },
        { x: 20, y: 20, pressure: 0.5, timestamp: 1020 },
      ],
      color: "#000",
      width: 3,
      tool: "pen",
    },
  },
  {
    type: "erase",
    id: "e2",
    timestamp: 2000,
    erasedIds: ["s0"],
  },
];

describe("ReplayPlayer", () => {
  it("starts in idle state", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 1200;
    const player = new ReplayPlayer(mockEvents, canvas);
    expect(player.getState()).toBe("idle");
    expect(player.getProgress()).toBe(0);
  });

  it("transitions to playing on play()", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 1200;
    const player = new ReplayPlayer(mockEvents, canvas);
    const stateChanges: string[] = [];
    player.onStateChange = (s) => stateChanges.push(s);
    player.play();
    expect(player.getState()).toBe("playing");
    expect(stateChanges).toContain("playing");
  });

  it("transitions to paused on pause()", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 1200;
    const player = new ReplayPlayer(mockEvents, canvas);
    player.play();
    player.pause();
    expect(player.getState()).toBe("paused");
  });

  it("resets to idle on reset()", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 1200;
    const player = new ReplayPlayer(mockEvents, canvas);
    player.play();
    player.reset();
    expect(player.getState()).toBe("idle");
    expect(player.getProgress()).toBe(0);
  });

  it("reports completion when all events played", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 1200;
    const player = new ReplayPlayer(mockEvents, canvas);
    let completed = false;
    player.onComplete = () => { completed = true; };
    player.play();
    // Simulate enough frames to play through all events
    for (let i = 0; i < 200; i++) {
      tickFrame(i * 16);
    }
    expect(completed).toBe(true);
    expect(player.getState()).toBe("idle");
  });

  it("setSpeed changes playback speed", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 1200;
    const player = new ReplayPlayer(mockEvents, canvas);
    player.setSpeed(4);
    // Speed affects point-per-frame rate, no error expected
    player.play();
    expect(player.getState()).toBe("playing");
  });

  it("goToEvent jumps to specific event index when paused", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 1200;
    const player = new ReplayPlayer(mockEvents, canvas);
    player.goToEvent(1);
    expect(player.getProgress()).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/recorder/player.test.ts`
Expected: FAIL - module not found

- [ ] **Step 3: Implement ReplayPlayer**

```typescript
// src/recorder/player.ts
import type { ReplayEvent, StrokeReplayEvent, ShapeReplayEvent } from "./types";
import type { Stroke, StrokePoint } from "@/types/sketch";
import { getPressureWidth, getSmoothedSegments } from "@/engine/strokeSmoothing";

export type PlaybackState = "idle" | "playing" | "paused";
export type PlaybackSpeed = 1 | 2 | 4;

const CHAR_DELAY_MS = 30;
const IMAGE_FADE_MS = 200;
const MAX_GAP_MS = 10000;
const COMPRESSED_GAP_MS = 2000;

export class ReplayPlayer {
  private events: ReplayEvent[];
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: PlaybackState = "idle";
  private speed: PlaybackSpeed = 1;
  private currentIndex = 0;
  private animFrameId: number | null = null;
  private lastFrameTime = 0;
  private dpr: number;

  // Per-event animation state
  private strokeAnimIndex = 0;
  private textAnimIndex = 0;
  private textAnimTimer = 0;
  private imageAnimProgress = 0;

  // Completed strokes for erase visualization
  private completedStrokes: Map<string, Stroke> = new Map();

  onStateChange?: (state: PlaybackState) => void;
  onProgress?: (current: number, total: number) => void;
  onComplete?: () => void;

  constructor(events: ReplayEvent[], canvas: HTMLCanvasElement) {
    this.events = events;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.dpr = window.devicePixelRatio || 1;
  }

  getState(): PlaybackState {
    return this.state;
  }

  getProgress(): number {
    return this.events.length === 0 ? 0 : this.currentIndex / this.events.length;
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }

  getTotalEvents(): number {
    return this.events.length;
  }

  getSpeed(): PlaybackSpeed {
    return this.speed;
  }

  play(): void {
    if (this.state === "playing") return;
    if (this.currentIndex >= this.events.length) {
      this.currentIndex = 0;
      this.clearCanvas();
      this.completedStrokes.clear();
    }
    this.state = "playing";
    this.onStateChange?.("playing");
    this.lastFrameTime = performance.now();
    this.scheduleFrame();
  }

  pause(): void {
    if (this.state !== "playing") return;
    this.state = "paused";
    this.onStateChange?.("paused");
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  reset(): void {
    this.pause();
    this.state = "idle";
    this.currentIndex = 0;
    this.strokeAnimIndex = 0;
    this.textAnimIndex = 0;
    this.textAnimTimer = 0;
    this.imageAnimProgress = 0;
    this.completedStrokes.clear();
    this.clearCanvas();
    this.onStateChange?.("idle");
    this.onProgress?.(0, this.events.length);
  }

  setSpeed(speed: PlaybackSpeed): void {
    this.speed = speed;
  }

  goToEvent(index: number): void {
    const wasPlaying = this.state === "playing";
    if (wasPlaying) this.pause();

    // Rebuild state up to index
    this.clearCanvas();
    this.completedStrokes.clear();
    this.currentIndex = Math.max(0, Math.min(index, this.events.length));
    this.strokeAnimIndex = 0;
    this.textAnimIndex = 0;
    this.imageAnimProgress = 0;

    // Instantly render all events before currentIndex
    for (let i = 0; i < this.currentIndex; i++) {
      this.renderEventInstant(this.events[i]);
    }

    this.onProgress?.(this.currentIndex, this.events.length);
  }

  destroy(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private scheduleFrame(): void {
    this.animFrameId = requestAnimationFrame((time) => this.frame(time));
  }

  private frame(time: number): void {
    if (this.state !== "playing") return;
    if (this.currentIndex >= this.events.length) {
      this.state = "idle";
      this.onStateChange?.("idle");
      this.onComplete?.();
      return;
    }

    const event = this.events[this.currentIndex];
    const done = this.renderEventAnimated(event, time);

    if (done) {
      this.currentIndex++;
      this.strokeAnimIndex = 0;
      this.textAnimIndex = 0;
      this.textAnimTimer = 0;
      this.imageAnimProgress = 0;
      this.onProgress?.(this.currentIndex, this.events.length);
    }

    this.lastFrameTime = time;
    this.scheduleFrame();
  }

  private renderEventAnimated(event: ReplayEvent, time: number): boolean {
    switch (event.type) {
      case "stroke":
      case "shape":
        return this.animateStroke(event);
      case "erase":
        this.applyErase(event.erasedIds);
        return true;
      case "text":
        return this.animateText(event.element.text, event.element);
      case "image":
        return this.animateImage(event.element);
      case "toolSwitch":
        return true; // No canvas rendering
    }
  }

  private animateStroke(event: StrokeReplayEvent | ShapeReplayEvent): boolean {
    const { stroke } = event;
    const pointsPerFrame = this.speed;
    const pts = stroke.points;

    if (this.strokeAnimIndex >= pts.length) {
      // Final full render to ensure visual consistency
      this.renderStrokeFull(stroke);
      this.completedStrokes.set(stroke.id, stroke);
      return true;
    }

    const end = Math.min(this.strokeAnimIndex + pointsPerFrame, pts.length);

    if (this.strokeAnimIndex === 0) {
      this.strokeAnimIndex = 1; // Start from point 1 (need 2 points to draw)
    }

    for (let i = Math.max(1, this.strokeAnimIndex); i < end; i++) {
      this.renderStrokeSegment(stroke, pts[i - 1], pts[i]);
    }

    this.strokeAnimIndex = end;
    return false;
  }

  private animateText(text: string, element: { bounds: { x: number; y: number; width: number; height: number }; style: { color: string; fontSize: number; fontFamily: string } }): boolean {
    if (this.speed >= 2) {
      this.renderTextFull(text, element);
      return true;
    }

    if (this.textAnimIndex >= text.length) {
      return true;
    }

    this.textAnimTimer += 16; // ~60fps
    if (this.textAnimTimer < CHAR_DELAY_MS) return false;

    this.textAnimTimer = 0;
    this.textAnimIndex++;
    const partial = text.slice(0, this.textAnimIndex);

    // Clear and redraw partial text
    this.ctx.save();
    this.ctx.fillStyle = element.style.color;
    this.ctx.font = `${element.style.fontSize}px ${element.style.fontFamily}`;
    this.ctx.textBaseline = "top";
    // Clear text area
    this.ctx.clearRect(
      element.bounds.x - 2,
      element.bounds.y - 2,
      element.bounds.width + 4,
      element.bounds.height + 4,
    );
    this.ctx.fillText(partial, element.bounds.x, element.bounds.y, element.bounds.width);
    this.ctx.restore();

    return this.textAnimIndex >= text.length;
  }

  private animateImage(element: { src: string; bounds: { x: number; y: number; width: number; height: number }; opacity?: number }): boolean {
    this.imageAnimProgress += 16 / IMAGE_FADE_MS;
    if (this.imageAnimProgress > 1) this.imageAnimProgress = 1;

    this.ctx.save();
    this.ctx.globalAlpha = (element.opacity ?? 1) * this.imageAnimProgress;
    // Image rendering would need the image cache — for now draw placeholder
    this.ctx.fillStyle = "#f4f4f4";
    this.ctx.strokeStyle = "#c8c8c8";
    this.ctx.lineWidth = 1;
    this.ctx.fillRect(element.bounds.x, element.bounds.y, element.bounds.width, element.bounds.height);
    this.ctx.strokeRect(element.bounds.x, element.bounds.y, element.bounds.width, element.bounds.height);
    this.ctx.restore();

    return this.imageAnimProgress >= 1;
  }

  private applyErase(erasedIds: string[]): void {
    for (const id of erasedIds) {
      this.completedStrokes.delete(id);
    }
    this.fullRedraw();
  }

  private fullRedraw(): void {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
    for (const stroke of this.completedStrokes.values()) {
      this.renderStrokeFull(stroke);
    }
  }

  private renderEventInstant(event: ReplayEvent): void {
    switch (event.type) {
      case "stroke":
      case "shape":
        this.renderStrokeFull(event.stroke);
        this.completedStrokes.set(event.stroke.id, event.stroke);
        break;
      case "erase":
        this.applyErase(event.erasedIds);
        break;
      case "text":
        this.renderTextFull(event.element.text, event.element);
        break;
      case "image":
        this.ctx.save();
        this.ctx.globalAlpha = event.element.opacity ?? 1;
        this.ctx.fillStyle = "#f4f4f4";
        this.ctx.fillRect(event.element.bounds.x, event.element.bounds.y, event.element.bounds.width, event.element.bounds.height);
        this.ctx.restore();
        break;
      case "toolSwitch":
        break;
    }
  }

  private renderStrokeFull(stroke: Stroke): void {
    const { points, color, width, tool, isShape } = stroke;
    if (points.length < 2) return;

    this.ctx.save();
    if (tool === "eraser") {
      this.ctx.globalCompositeOperation = "destination-out";
      this.ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      this.ctx.globalAlpha = stroke.opacity ?? 1;
      this.ctx.globalCompositeOperation = "source-over";
      this.ctx.strokeStyle = color;
    }
    this.ctx.lineJoin = "round";
    this.ctx.lineCap = "round";

    const firstPressure = points[0].pressure;
    const allSame = points.every((p) => p.pressure === firstPressure);

    if (isShape) {
      this.ctx.lineWidth = getPressureWidth(width, firstPressure);
      this.ctx.beginPath();
      this.ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        this.ctx.lineTo(points[i].x, points[i].y);
      }
      this.ctx.stroke();
    } else if (allSame) {
      this.ctx.lineWidth = getPressureWidth(width, firstPressure);
      this.ctx.beginPath();
      this.ctx.moveTo(points[0].x, points[0].y);
      for (const segment of getSmoothedSegments(points)) {
        this.ctx.quadraticCurveTo(segment.control.x, segment.control.y, segment.end.x, segment.end.y);
      }
      this.ctx.stroke();
    } else {
      const segments = getSmoothedSegments(points);
      let currentX = points[0].x;
      let currentY = points[0].y;
      for (const segment of segments) {
        this.ctx.lineWidth = getPressureWidth(width, segment.control.pressure);
        this.ctx.beginPath();
        this.ctx.moveTo(currentX, currentY);
        this.ctx.quadraticCurveTo(segment.control.x, segment.control.y, segment.end.x, segment.end.y);
        this.ctx.stroke();
        currentX = segment.end.x;
        currentY = segment.end.y;
      }
    }
    this.ctx.restore();
  }

  private renderStrokeSegment(stroke: Stroke, prev: StrokePoint, curr: StrokePoint): void {
    this.ctx.save();
    if (stroke.tool === "eraser") {
      this.ctx.globalCompositeOperation = "destination-out";
      this.ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      this.ctx.globalAlpha = stroke.opacity ?? 1;
      this.ctx.globalCompositeOperation = "source-over";
      this.ctx.strokeStyle = stroke.color;
    }
    this.ctx.lineWidth = getPressureWidth(stroke.width, curr.pressure);
    this.ctx.lineJoin = "round";
    this.ctx.lineCap = "round";
    this.ctx.beginPath();
    this.ctx.moveTo(prev.x, prev.y);
    this.ctx.lineTo(curr.x, curr.y);
    this.ctx.stroke();
    this.ctx.restore();
  }

  private renderTextFull(text: string, element: { bounds: { x: number; y: number; width: number }; style: { color: string; fontSize: number; fontFamily: string } }): void {
    this.ctx.save();
    this.ctx.fillStyle = element.style.color;
    this.ctx.font = `${element.style.fontSize}px ${element.style.fontFamily}`;
    this.ctx.textBaseline = "top";
    this.ctx.fillText(text, element.bounds.x, element.bounds.y, element.bounds.width);
    this.ctx.restore();
  }

  private clearCanvas(): void {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/recorder/player.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/recorder/player.ts src/recorder/player.test.ts
git commit -m "feat(recorder): 实现 ReplayPlayer 回放引擎"
```

---

### Task 6: Add i18n keys

**Files:**
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`

- [ ] **Step 1: Add replay-related i18n keys to zh_CN.json**

Add these keys at the end of the JSON object (before the closing `}`):

```json
  "replay": "回放",
  "replayPlay": "播放",
  "replayPause": "暂停",
  "replayPrevious": "上一步",
  "replayNext": "下一步",
  "replayExit": "退出回放",
  "replaySpeed": "倍速",
  "replayStepOf": "步骤",
  "replayToolSwitch": "工具切换",
  "replayImageOp": "图片操作"
```

- [ ] **Step 2: Add replay-related i18n keys to en_US.json**

Add these keys at the end of the JSON object (before the closing `}`):

```json
  "replay": "Replay",
  "replayPlay": "Play",
  "replayPause": "Pause",
  "replayPrevious": "Previous",
  "replayNext": "Next",
  "replayExit": "Exit Replay",
  "replaySpeed": "Speed",
  "replayStepOf": "Step",
  "replayToolSwitch": "Tool Switch",
  "replayImageOp": "Image Operation"
```

- [ ] **Step 3: Verify both JSON files are valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/i18n/zh_CN.json'))" && node -e "JSON.parse(require('fs').readFileSync('src/i18n/en_US.json'))"`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/i18n/zh_CN.json src/i18n/en_US.json
git commit -m "feat(i18n): 添加回放功能相关翻译"
```

---

### Task 7: Wire up recording in SketchCanvas.vue

**Files:**
- Modify: `src/editor/SketchCanvas.vue:64-158` (script setup imports and props)
- Modify: `src/editor/SketchCanvas.vue:598-677` (onPointerUp)
- Modify: `src/editor/SketchCanvas.vue:1120-1135` (insertImage)

- [ ] **Step 1: Add recorder prop and import to SketchCanvas.vue**

In the `<script setup>` section, add import after existing imports:

```typescript
import type { ReplayRecorder } from "@/recorder/recorder";
```

Add to props:

```typescript
const props = defineProps<{
  initialData: SketchData | null;
  tool: EditorTool;
  toolPresets: ToolPresetCollection;
  inputSettings: SketchInputSettings;
  templateId: string;
  lassoMode: "freehand" | "box";
  recorder?: ReplayRecorder;
}>();
```

- [ ] **Step 2: Add recording calls in onPointerUp — stroke completion**

In `onPointerUp`, after the `enginePointerUp` block (around line 669-677), add recorder call:

```typescript
  const completed = enginePointerUp(state);
  if (completed) {
    if (props.tool === "eraser" && props.toolPresets.eraser.mode === "stroke") {
      fullRedrawStrokeCanvas(getCanvas(), state);
    }
    updateUndoRedoState();
    emit("stroke");
    // Record replay event
    if (props.recorder) {
      const lastStroke = state.strokes[state.strokes.length - 1];
      if (lastStroke) {
        props.recorder.record({
          type: props.tool === "eraser" ? "erase" : "stroke",
          id: `re-${Date.now()}`,
          timestamp: Date.now(),
          ...(props.tool === "eraser"
            ? { erasedIds: [] } // Erase events with stroke mode are recorded via the erase branch
            : { stroke: lastStroke }),
        });
      }
    }
  }
```

Wait — the eraser in stroke mode works differently. Let me re-read the engine code. The `enginePointerUp` returns `true` for both normal strokes and eraser hits. For eraser stroke mode, it filters out hit strokes. We need to capture the erased IDs.

Let me revise. The `handlePointerUp` in canvasEngine already handles this internally. We need to capture the erased IDs differently. Let me look at the engine code again.

Looking at `canvasEngine.ts:271-288`:
- For eraser stroke mode: `findStrokeEraseHits` returns `hitIds`, strokes are filtered, returns `true`
- For normal stroke: pushes history, adds stroke, returns `true`

The erased IDs are not exposed. We need to either:
1. Modify `enginePointerUp` to return the erased IDs, or
2. Compare state before and after

Option 2 is less invasive. But actually, let me look more carefully. The `handlePointerUp` function erases strokes from `state.strokes` before returning. So we can't easily get the erased IDs after the fact.

Better approach: modify `handlePointerUp` to return additional info. But that changes the engine API. Instead, let's capture the stroke count before and after for eraser, and record the erased event separately.

Actually, the simplest approach: for the eraser, we record the eraser stroke itself (which contains the eraser path). The erased IDs can be determined during replay by re-running the erase logic. But that's complex.

Simplest correct approach: snapshot strokes before `enginePointerUp`, compare after, record the difference.

- [ ] **Step 2 (revised): Add recording for strokes and eraser**

Replace the onPointerUp recording logic:

```typescript
  // Before enginePointerUp, capture pre-state for eraser detection
  const preStrokeIds = props.recorder && props.tool === "eraser"
    ? new Set(state.strokes.map((s) => s.id))
    : null;

  const completed = enginePointerUp(state);
  if (completed) {
    if (props.tool === "eraser" && props.toolPresets.eraser.mode === "stroke") {
      fullRedrawStrokeCanvas(getCanvas(), state);
    }
    updateUndoRedoState();
    emit("stroke");

    // Record replay event
    if (props.recorder) {
      if (props.tool === "eraser" && preStrokeIds) {
        const erasedIds = [...preStrokeIds].filter((id) => !state.strokes.some((s) => s.id === id));
        if (erasedIds.length > 0) {
          props.recorder.record({
            type: "erase",
            id: `re-${Date.now()}`,
            timestamp: Date.now(),
            erasedIds,
          });
        }
      } else if (props.tool !== "eraser") {
        const lastStroke = state.strokes[state.strokes.length - 1];
        if (lastStroke) {
          props.recorder.record({
            type: "stroke",
            id: `re-${Date.now()}`,
            timestamp: Date.now(),
            stroke: lastStroke,
          });
        }
      }
    }
  }
```

- [ ] **Step 3: Add recording for shape creation**

In `onPointerUp`, after shape creation (around line 654-667), add recorder call:

```typescript
  if (interaction.shapeStart && isShapeEditorTool(props.tool)) {
    const preset = props.toolPresets.pen;
    const end = eventPoint(e);
    if (Math.hypot(end.x - interaction.shapeStart.x, end.y - interaction.shapeStart.y) > 4) {
      const stroke = createShapeStrokeForTool(`shape-${Date.now()}`, props.tool, interaction.shapeStart, end, preset);
      pushHistorySnapshot(state);
      state.strokes.push(stroke);
      // Record replay event
      if (props.recorder) {
        props.recorder.record({
          type: "shape",
          id: `re-${Date.now()}`,
          timestamp: Date.now(),
          stroke,
        });
      }
    }
    interaction.shapeStart = null;
    fullRedrawStrokeCanvas(getCanvas(), state);
    updateUndoRedoState();
    emit("stroke");
    return;
  }
```

- [ ] **Step 4: Add recording for image insertion**

In `insertImage` function (around line 1120-1135), add recorder call:

```typescript
async function insertImage(src: string) {
  await preloadImage(src);
  const position = createInsertElementPosition({
    canvasWidth: state.canvasWidth,
    pageMode: state.pageMode,
    activePageId: state.activePageId,
    pages: state.pages,
    elementWidth: 320,
    topOffset: 140,
  });
  const element = createImageElement(`image-${Date.now()}`, { x: position.x, y: position.y, src });
  pushHistorySnapshot(state);
  state.elements = [...state.elements, element];
  fullRedrawStrokeCanvas(getCanvas(), state);
  updateUndoRedoState();
  // Record replay event
  if (props.recorder) {
    props.recorder.record({
      type: "image",
      id: `re-${Date.now()}`,
      timestamp: Date.now(),
      element,
    });
  }
}
```

- [ ] **Step 5: Add recording for text creation in useTextEditing**

Text recording needs to happen in `useTextEditing.ts` since that's where `finishTextEditing` lives. Modify `useTextEditing` to accept a recorder:

In `src/composables/useTextEditing.ts`, add to context:

```typescript
export function useTextEditing(ctx: {
  state: () => EngineState;
  getCanvas: () => HTMLCanvasElement;
  toolPresets: Ref<ToolPresetCollection>;
  updateUndoRedoState: () => void;
  emit: (e: "stroke") => void;
  recorder?: { record: (event: any) => void };
}) {
```

In `finishTextEditing`, after creating or updating the element, add recording:

```typescript
  function finishTextEditing() {
    if (!textEditor.value.show) return;
    const { elementId, val, x, y } = textEditor.value;
    textEditor.value.show = false;
    const state = ctx.state();

    if (!val.trim()) {
      if (elementId) {
        pushHistorySnapshot(state);
        state.elements = state.elements.filter((item) => item.id !== elementId);
        state.isDirty = true;
        fullRedrawStrokeCanvas(ctx.getCanvas(), state);
        ctx.updateUndoRedoState();
        ctx.emit("stroke");
      }
      return;
    }

    pushHistorySnapshot(state);

    let recordedElement: SketchElement | null = null;

    if (elementId) {
      state.elements = state.elements.map((item) => {
        if (item.id === elementId) {
          const updated = updateTextElement(item as any, { text: val });
          recordedElement = updated;
          return updated;
        }
        return item;
      });
    } else {
      const textStyle = ctx.toolPresets.value.text ?? { color: "#000000", width: 20 };
      const fontSize = textStyle.width;
      const color = textStyle.color;
      const calculatedWidth = Math.max(150, val.length * fontSize * 0.65);
      const calculatedHeight = fontSize + 8;
      const element = createTextElement(`text-${Date.now()}`, {
        x,
        y,
        text: val,
        width: calculatedWidth,
        height: calculatedHeight,
        style: { fontSize, color, fontFamily: "Inter, system-ui, sans-serif" },
      });
      state.elements = [...state.elements, element];
      recordedElement = element;
    }

    state.isDirty = true;
    fullRedrawStrokeCanvas(ctx.getCanvas(), state);
    ctx.updateUndoRedoState();
    ctx.emit("stroke");

    // Record replay event
    if (ctx.recorder && recordedElement) {
      ctx.recorder.record({
        type: "text",
        id: `re-${Date.now()}`,
        timestamp: Date.now(),
        element: recordedElement,
      });
    }
  }
```

- [ ] **Step 6: Pass recorder to useTextEditing in SketchCanvas.vue**

Update the `useTextEditing` call in SketchCanvas.vue:

```typescript
const textEditing = useTextEditing({
  state: () => state,
  getCanvas: () => strokeCanvasRef.value!,
  toolPresets: computed(() => props.toolPresets),
  updateUndoRedoState: () => updateUndoRedoState(),
  emit: (e) => emit(e),
  recorder: props.recorder,
});
```

- [ ] **Step 7: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/editor/SketchCanvas.vue src/composables/useTextEditing.ts
git commit -m "feat(canvas): 在操作完成点接入 ReplayRecorder 录制"
```

---

### Task 8: Create ReplayControls.vue component

**Files:**
- Create: `src/editor/ReplayControls.vue`

- [ ] **Step 1: Implement the ReplayControls component**

```vue
<template>
  <div class="replay-controls">
    <button
      class="replay-btn"
      :title="t('replayPrevious')"
      :disabled="!canStepBack"
      @click="$emit('previous')"
    >
      <IconParkIcon name="ArrowLeft" />
    </button>
    <button
      class="replay-btn replay-btn--play"
      :title="isPlaying ? t('replayPause') : t('replayPlay')"
      @click="$emit('togglePlay')"
    >
      <IconParkIcon :name="isPlaying ? 'Pause' : 'Play'" />
    </button>
    <button
      class="replay-btn"
      :title="t('replayNext')"
      :disabled="!canStepForward"
      @click="$emit('next')"
    >
      <IconParkIcon name="ArrowRight" />
    </button>
    <div class="replay-progress-wrap">
      <input
        type="range"
        class="replay-progress"
        :min="0"
        :max="total"
        :value="current"
        @input="$emit('seek', Number(($event.target as HTMLInputElement).value))"
      >
      <span class="replay-progress-label">{{ current }} / {{ total }}</span>
    </div>
    <select
      class="replay-speed"
      :value="speed"
      @change="$emit('speedChange', Number(($event.target as HTMLSelectElement).value))"
    >
      <option :value="1">1x</option>
      <option :value="2">2x</option>
      <option :value="4">4x</option>
    </select>
    <button
      class="replay-btn replay-btn--exit"
      :title="t('replayExit')"
      @click="$emit('exit')"
    >
      ✕
    </button>
  </div>
</template>

<script setup lang="ts">
import IconParkIcon from "./IconParkIcon.vue";
import type { PlaybackSpeed } from "@/recorder/player";

defineProps<{
  isPlaying: boolean;
  current: number;
  total: number;
  speed: PlaybackSpeed;
  canStepBack: boolean;
  canStepForward: boolean;
  t: (key: string) => string;
}>();

defineEmits<{
  (e: "togglePlay"): void;
  (e: "previous"): void;
  (e: "next"): void;
  (e: "seek", index: number): void;
  (e: "speedChange", speed: PlaybackSpeed): void;
  (e: "exit"): void;
}>();
</script>

<style scoped>
.replay-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: var(--sketch-toolbar-surface);
  backdrop-filter: blur(14px) saturate(160%);
  -webkit-backdrop-filter: blur(14px) saturate(160%);
  border: 1px solid var(--sketch-toolbar-border);
  border-radius: 12px;
  box-shadow: var(--sketch-toolbar-shadow);
  user-select: none;
}

.replay-btn {
  appearance: none;
  background: var(--sketch-toolbar-control-bg);
  border: 1px solid var(--sketch-toolbar-control-border);
  color: var(--sketch-toolbar-text);
  border-radius: 8px;
  padding: 4px 10px;
  cursor: pointer;
  font-size: 13px;
  min-height: 30px;
  min-width: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.replay-btn:hover {
  background: var(--sketch-toolbar-hover-bg);
  border-color: var(--sketch-toolbar-hover-border);
  color: var(--sketch-toolbar-strong-text);
}
.replay-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.replay-btn--play {
  min-width: 40px;
  font-size: 15px;
}
.replay-btn--exit {
  margin-left: 4px;
  color: var(--sketch-toolbar-muted-text);
}
.replay-btn--exit:hover {
  color: #e5484d;
}

.replay-progress-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 120px;
}

.replay-progress {
  flex: 1;
  height: 4px;
  appearance: none;
  background: var(--sketch-toolbar-control-border);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}
.replay-progress::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--b3-theme-primary);
  cursor: pointer;
}
.replay-progress::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--b3-theme-primary);
  cursor: pointer;
  border: none;
}

.replay-progress-label {
  font-size: 12px;
  color: var(--sketch-toolbar-muted-text);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  min-width: 48px;
  text-align: center;
}

.replay-speed {
  appearance: none;
  background: var(--sketch-toolbar-control-bg);
  border: 1px solid var(--sketch-toolbar-control-border);
  color: var(--sketch-toolbar-text);
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 13px;
  min-height: 30px;
  cursor: pointer;
  outline: none;
}
.replay-speed:hover {
  background: var(--sketch-toolbar-hover-bg);
}
.replay-speed option {
  background: #1c1c1e;
  color: #fff;
}
</style>
```

- [ ] **Step 2: Add Play and Pause icons to iconParkIcons.ts**

In `src/editor/iconParkIcons.ts`, add these icons to the `ICON_PARK_ICONS` object:

```typescript
  Play: "<svg width=\"1em\" height=\"1em\" viewBox=\"0 0 48 48\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M14 6L40 24L14 42V6Z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4\" stroke-linejoin=\"round\"/></svg>",
  Pause: "<svg width=\"1em\" height=\"1em\" viewBox=\"0 0 48 48\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"8\" y=\"6\" width=\"12\" height=\"36\" rx=\"2\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4\"/><rect x=\"28\" y=\"6\" width=\"12\" height=\"36\" rx=\"2\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4\"/></svg>",
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/editor/ReplayControls.vue src/editor/iconParkIcons.ts
git commit -m "feat(ui): 实现 ReplayControls 回放控制栏组件"
```

---

### Task 9: Add replay button to EditorTopBar

**Files:**
- Modify: `src/editor/EditorTopBar.vue:1-128` (template)
- Modify: `src/editor/EditorTopBar.vue:130-165` (script)

- [ ] **Step 1: Add replay button to EditorTopBar template**

Insert the replay button before the spacer in the top bar template. In `src/editor/EditorTopBar.vue`, add after the clear button (line 38):

```html
    <button
      class="sketch-btn sketch-btn--action"
      :title="t('replay')"
      @click="$emit('replay')"
    >
      <IconParkIcon name="Play" />
    </button>
```

- [ ] **Step 2: Add replay emit to EditorTopBar**

In the `defineEmits` block, add:

```typescript
  (e: "replay"): void;
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/editor/EditorTopBar.vue
git commit -m "feat(topbar): 顶栏添加回放按钮"
```

---

### Task 10: Wire up replay mode in SketchEditor.vue

**Files:**
- Modify: `src/editor/SketchEditor.vue:1-135` (template)
- Modify: `src/editor/SketchEditor.vue:137-521` (script)

- [ ] **Step 1: Add replay state and imports to SketchEditor.vue**

Add imports:

```typescript
import { ReplayRecorder } from "@/recorder/recorder";
import { ReplayPlayer } from "@/recorder/player";
import type { PlaybackSpeed } from "@/recorder/player";
import { reconstructFromData } from "@/recorder/reconstruct";
import ReplayControls from "./ReplayControls.vue";
```

Add state refs after existing refs:

```typescript
// ─── Replay ───
const isReplayMode = ref(false);
const replayRecorder = new ReplayRecorder();
const replayPlayer = ref<InstanceType<typeof ReplayPlayer> | null>(null);
const replayCanvasRef = ref<HTMLCanvasElement>();
const replayState = ref<"idle" | "playing" | "paused">("idle");
const replayCurrent = ref(0);
const replayTotal = ref(0);
const replaySpeed = ref<PlaybackSpeed>(1);
```

- [ ] **Step 2: Add replay functions to SketchEditor.vue**

```typescript
// ─── Replay functions ───
function enterReplayMode() {
  const data = canvasRef.value?.getData();
  if (!data) return;

  // Get events — use recorded events if available, otherwise reconstruct
  let events = data.replayEvents && data.replayEvents.length > 0
    ? data.replayEvents
    : reconstructFromData(data);

  if (events.length === 0) return;

  isReplayMode.value = true;
  replayTotal.value = events.length;
  replayCurrent.value = 0;
  replayState.value = "idle";
  replaySpeed.value = 1;

  // Create replay canvas after DOM update
  nextTick(() => {
    if (!replayCanvasRef.value) return;
    const canvas = replayCanvasRef.value;
    const state = canvasRef.value?.getState();
    if (state) {
      canvas.width = state.canvasWidth * (window.devicePixelRatio || 1);
      canvas.height = state.canvasHeight * (window.devicePixelRatio || 1);
      canvas.style.width = `${state.canvasWidth}px`;
      canvas.style.height = `${state.canvasHeight}px`;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    }

    const player = new ReplayPlayer(events, canvas);
    player.onStateChange = (s) => { replayState.value = s; };
    player.onProgress = (current, total) => {
      replayCurrent.value = current;
      replayTotal.value = total;
    };
    player.onComplete = () => {
      replayState.value = "idle";
    };
    replayPlayer.value = player;
  });
}

function exitReplayMode() {
  replayPlayer.value?.destroy();
  replayPlayer.value = null;
  isReplayMode.value = false;
  replayState.value = "idle";
  replayCurrent.value = 0;
}

function toggleReplayPlay() {
  const player = replayPlayer.value;
  if (!player) return;
  if (replayState.value === "playing") {
    player.pause();
  } else {
    player.play();
  }
}

function replayPrevious() {
  const player = replayPlayer.value;
  if (!player) return;
  player.pause();
  const prev = Math.max(0, player.getCurrentIndex() - 1);
  player.goToEvent(prev);
  replayCurrent.value = prev;
}

function replayNext() {
  const player = replayPlayer.value;
  if (!player) return;
  player.pause();
  const next = Math.min(player.getTotalEvents(), player.getCurrentIndex() + 1);
  player.goToEvent(next);
  replayCurrent.value = next;
}

function replaySeek(index: number) {
  const player = replayPlayer.value;
  if (!player) return;
  player.pause();
  player.goToEvent(index);
  replayCurrent.value = index;
}

function replaySpeedChange(speed: PlaybackSpeed) {
  replaySpeed.value = speed;
  replayPlayer.value?.setSpeed(speed);
}

function onReplayKeyDown(event: KeyboardEvent) {
  if (!isReplayMode.value) return;
  if (event.key === " ") {
    event.preventDefault();
    toggleReplayPlay();
  } else if (event.key === "Escape") {
    event.preventDefault();
    exitReplayMode();
  }
}
```

- [ ] **Step 3: Add replay keyboard listener**

In the `onMounted` block, add:

```typescript
window.addEventListener("keydown", onReplayKeyDown);
```

In `onUnmounted`, add:

```typescript
window.removeEventListener("keydown", onReplayKeyDown);
```

- [ ] **Step 4: Update template for replay mode**

Modify the template to show replay canvas and controls when in replay mode. In the `<template>`, update the body section:

```html
    <div
      ref="bodyRef"
      class="sketch-editor__body"
      :class="{ 'sketch-editor__body--zen': isZenMode }"
    >
      <SketchCanvas
        v-show="!isReplayMode"
        ref="canvasRef"
        :initialData="loadedData"
        :tool="activeTool"
        :toolPresets="{ ...toolPresets, text: textPreset }"
        :inputSettings="inputSettings"
        :templateId="currentTemplate"
        :lassoMode="lassoMode"
        :recorder="replayRecorder"
        @update:canUndo="canUndo = $event"
        @update:canRedo="canRedo = $event"
        @heightChanged="onHeightChanged"
        @pagesChanged="onPagesChanged"
        @stroke="onStroke"
      />
      <div
        v-if="isReplayMode"
        class="sketch-replay-canvas-wrap"
      >
        <canvas
          ref="replayCanvasRef"
          class="sketch-replay-canvas"
        />
      </div>
    </div>
    <ReplayControls
      v-if="isReplayMode"
      :isPlaying="replayState === 'playing'"
      :current="replayCurrent"
      :total="replayTotal"
      :speed="replaySpeed"
      :canStepBack="replayCurrent > 0"
      :canStepForward="replayCurrent < replayTotal"
      :t="t"
      class="sketch-replay-bar"
      @togglePlay="toggleReplayPlay"
      @previous="replayPrevious"
      @next="replayNext"
      @seek="replaySeek"
      @speedChange="replaySpeedChange"
      @exit="exitReplayMode"
    />
```

- [ ] **Step 5: Wire up replay event in EditorTopBar**

In the `EditorTopBar` component usage, add the `@replay` handler:

```html
      @replay="enterReplayMode"
```

- [ ] **Step 6: Add replay CSS**

Add styles for the replay canvas and control bar:

```css
/* ── Replay mode ── */
.sketch-replay-canvas-wrap {
  display: flex;
  justify-content: center;
  width: 100%;
  overflow: auto;
}
.sketch-replay-canvas {
  display: block;
  border-radius: 12px;
  border: 1px solid var(--b3-theme-border, rgba(0, 0, 0, 0.08));
}
.sketch-replay-bar {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1100;
}
```

- [ ] **Step 7: Add `nextTick` import**

Make sure `nextTick` is imported from vue:

```typescript
import { ref, computed, onMounted, onUnmounted, watchEffect, nextTick } from "vue";
```

- [ ] **Step 8: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 9: Commit**

```bash
git add src/editor/SketchEditor.vue
git commit -m "feat(editor): 接入回放模式，协调录制器和播放器"
```

---

### Task 11: Serialize replayEvents in save/load

**Files:**
- Modify: `src/engine/canvasEngine.ts:341-359` (serializeState)
- Modify: `src/engine/canvasEngine.ts:86-105` (restoreEngineState)

- [ ] **Step 1: Update serializeState to include replayEvents**

The `serializeState` function needs to accept replayEvents. Since the recorder lives outside the engine, we'll pass replayEvents through a separate mechanism. The simplest approach: have `SketchCanvas.vue` attach replayEvents to the returned `SketchData` after `serializeState`.

Actually, looking at the code, `getData()` calls `serializeState(state)` directly. The recorder is external. The cleanest approach: `getData()` in SketchCanvas merges recorder events into the serialized data.

In `src/editor/SketchCanvas.vue`, update `getData()`:

```typescript
function getData(): SketchData {
  const data = serializeState(state);
  if (props.recorder) {
    data.replayEvents = props.recorder.getEvents();
  }
  return data;
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/editor/SketchCanvas.vue
git commit -m "feat(storage): 序列化时包含 replayEvents"
```

---

### Task 12: Final integration test

**Files:**
- None (manual verification)

- [ ] **Step 1: Run all tests**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 2: Run lint**

Run: `npx eslint src/recorder/ src/editor/ReplayControls.vue`
Expected: No errors (or only pre-existing warnings)

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: Successful build

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: 修复回放功能集成问题"
```

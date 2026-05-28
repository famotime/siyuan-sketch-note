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

/** Create a mock canvas with a spy 2D context (no DOM required). */
function createMockCanvas(): HTMLCanvasElement {
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    setTransform: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 1,
    lineJoin: "round",
    lineCap: "round",
    font: "",
    textBaseline: "alphabetic",
  } as unknown as CanvasRenderingContext2D;

  return {
    width: 800,
    height: 1200,
    getContext: vi.fn().mockReturnValue(ctx),
  } as unknown as HTMLCanvasElement;
}

function createImageElement(id: string, bounds: { x: number; y: number; width: number; height: number }, rotation = 0, opacity = 1) {
  return {
    id,
    type: "image" as const,
    src: "data:image/png;base64,abc",
    alt: "",
    opacity,
    bounds,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation },
    zIndex: 0,
  };
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

describe("replayPlayer", () => {
  it("starts in idle state", () => {
    const canvas = createMockCanvas();
    const player = new ReplayPlayer(mockEvents, canvas);
    expect(player.getState()).toBe("idle");
    expect(player.getProgress()).toBe(0);
  });

  it("transitions to playing on play()", () => {
    const canvas = createMockCanvas();
    const player = new ReplayPlayer(mockEvents, canvas);
    const stateChanges: string[] = [];
    player.onStateChange = (s) => stateChanges.push(s);
    player.play();
    expect(player.getState()).toBe("playing");
    expect(stateChanges).toContain("playing");
  });

  it("transitions to paused on pause()", () => {
    const canvas = createMockCanvas();
    const player = new ReplayPlayer(mockEvents, canvas);
    player.play();
    player.pause();
    expect(player.getState()).toBe("paused");
  });

  it("resets to idle on reset()", () => {
    const canvas = createMockCanvas();
    const player = new ReplayPlayer(mockEvents, canvas);
    player.play();
    player.reset();
    expect(player.getState()).toBe("idle");
    expect(player.getProgress()).toBe(0);
  });

  it("reports completion when all events played", () => {
    const canvas = createMockCanvas();
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
    const canvas = createMockCanvas();
    const player = new ReplayPlayer(mockEvents, canvas);
    player.setSpeed(4);
    player.play();
    expect(player.getState()).toBe("playing");
  });

  it("emits tool switch source for toolbar click replay", () => {
    const events: ReplayEvent[] = [
      {
        type: "toolSwitch",
        id: "tool-event",
        timestamp: 1000,
        tool: "highlighter",
        preset: { tool: "highlighter", color: "#ff0", width: 18, opacity: 0.45, mode: "marker" },
        source: "floatingToolbar",
      },
    ];
    const canvas = createMockCanvas();
    const player = new ReplayPlayer(events, canvas);
    const switches: Array<{ tool: string; source?: string }> = [];
    player.onToolSwitch = (tool, source) => switches.push({ tool, source });

    player.play();
    tickFrame(16);

    expect(switches).toEqual([{ tool: "highlighter", source: "floatingToolbar" }]);
  });

  it("emits image insert source for import click replay", () => {
    const events: ReplayEvent[] = [
      {
        type: "image",
        id: "image-insert",
        timestamp: 1000,
        element: createImageElement("image-1", { x: 10, y: 20, width: 100, height: 80 }),
        source: "topBar",
        loadingMs: 120,
      },
    ];
    const canvas = createMockCanvas();
    const player = new ReplayPlayer(events, canvas);
    const inserts: Array<{ source?: string; loadingMs?: number }> = [];
    player.onImageInsert = (source, loadingMs) => inserts.push({ source, loadingMs });

    player.play();
    tickFrame(16);

    expect(inserts).toEqual([{ source: "topBar", loadingMs: 120 }]);
  });

  it("goToEvent jumps to specific event index", () => {
    const canvas = createMockCanvas();
    const player = new ReplayPlayer(mockEvents, canvas);
    player.goToEvent(1);
    expect(player.getProgress()).toBeGreaterThan(0);
  });

  it("redraws the replay background whenever playback canvas is cleared", () => {
    const canvas = createMockCanvas();
    const redrawBackground = vi.fn();
    const player = new ReplayPlayer(mockEvents, canvas, { redrawBackground });

    player.reset();
    expect(redrawBackground).toHaveBeenCalledTimes(1);

    player.goToEvent(1);
    expect(redrawBackground).toHaveBeenCalledTimes(2);
  });

  it("does not draw stored eraser strokes as visible black replay paths", () => {
    const eraserEvents: ReplayEvent[] = [
      {
        type: "stroke",
        id: "eraser-event",
        timestamp: 1000,
        stroke: {
          id: "eraser-stroke",
          points: [
            { x: 0, y: 0, pressure: 0.5, timestamp: 1000 },
            { x: 20, y: 20, pressure: 0.5, timestamp: 1010 },
          ],
          color: "#000000",
          width: 20,
          tool: "eraser",
        },
      },
    ];
    const canvas = createMockCanvas();
    const ctx = canvas.getContext("2d")!;
    const player = new ReplayPlayer(eraserEvents, canvas);

    player.play();
    tickFrame(16);
    tickFrame(32);

    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it("animates text without clearing a black rectangle behind the text", () => {
    const textEvents: ReplayEvent[] = [
      {
        type: "text",
        id: "text-event",
        timestamp: 1000,
        element: {
          id: "text-1",
          type: "text",
          text: "hello",
          bounds: { x: 10, y: 20, width: 160, height: 30 },
          style: { color: "#123456", fontSize: 18, fontFamily: "sans-serif" },
          transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
          zIndex: 0,
        },
      },
    ];
    const canvas = createMockCanvas();
    const ctx = canvas.getContext("2d")!;
    const player = new ReplayPlayer(textEvents, canvas);

    player.play();
    tickFrame(16);
    tickFrame(32);

    expect(ctx.clearRect).not.toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it("plays image transforms from recorded samples before committing the final element", () => {
    const initial = createImageElement("image-1", { x: 10, y: 20, width: 100, height: 80 });
    const middle = createImageElement("image-1", { x: 40, y: 50, width: 130, height: 95 }, 0.15, 0.8);
    const final = createImageElement("image-1", { x: 80, y: 90, width: 160, height: 120 }, 0.3, 0.6);
    const events: ReplayEvent[] = [
      {
        type: "image",
        id: "image-insert",
        timestamp: 1000,
        element: initial,
      },
      {
        type: "imageTransform",
        id: "image-transform",
        timestamp: 1100,
        elementId: "image-1",
        op: "resize",
        initialElement: initial,
        finalElement: final,
        samples: [
          { offsetMs: 0, bounds: initial.bounds, rotation: 0, opacity: 1 },
          { offsetMs: 16, bounds: middle.bounds, rotation: 0.15, opacity: 0.8 },
          { offsetMs: 32, bounds: final.bounds, rotation: 0.3, opacity: 0.6 },
        ],
      },
    ];
    const canvas = createMockCanvas();
    const ctx = canvas.getContext("2d")!;
    const player = new ReplayPlayer(events, canvas);

    player.goToEvent(1);
    player.play();
    for (let i = 1; i <= 18; i++) {
      tickFrame(i * 16);
    }

    expect(ctx.fillRect).toHaveBeenCalledWith(-initial.bounds.width / 2, -initial.bounds.height / 2, initial.bounds.width, initial.bounds.height);
    expect(ctx.fillRect).toHaveBeenCalledWith(-middle.bounds.width / 2, -middle.bounds.height / 2, middle.bounds.width, middle.bounds.height);
  });

  it("stretches short image transform samples so operation steps remain visible", () => {
    const initial = createImageElement("image-1", { x: 10, y: 20, width: 100, height: 80 });
    const final = createImageElement("image-1", { x: 80, y: 90, width: 160, height: 120 }, 0.3, 0.6);
    const events: ReplayEvent[] = [
      { type: "image", id: "image-insert", timestamp: 1000, element: initial },
      {
        type: "imageTransform",
        id: "image-transform",
        timestamp: 1100,
        elementId: "image-1",
        op: "resize",
        initialElement: initial,
        finalElement: final,
        samples: [
          { offsetMs: 0, bounds: initial.bounds, rotation: 0, opacity: 1 },
          { offsetMs: 32, bounds: final.bounds, rotation: 0.3, opacity: 0.6 },
        ],
      },
    ];
    const canvas = createMockCanvas();
    const ctx = canvas.getContext("2d")!;
    const player = new ReplayPlayer(events, canvas);

    player.goToEvent(1);
    vi.mocked(ctx.fillRect).mockClear();
    player.play();
    tickFrame(16);
    tickFrame(32);

    expect(ctx.fillRect).toHaveBeenCalledWith(-initial.bounds.width / 2, -initial.bounds.height / 2, initial.bounds.width, initial.bounds.height);
    expect(ctx.fillRect).not.toHaveBeenCalledWith(-final.bounds.width / 2, -final.bounds.height / 2, final.bounds.width, final.bounds.height);
  });
});

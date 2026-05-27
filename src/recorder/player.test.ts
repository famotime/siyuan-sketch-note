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
    setTransform: vi.fn(),
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

  it("goToEvent jumps to specific event index", () => {
    const canvas = createMockCanvas();
    const player = new ReplayPlayer(mockEvents, canvas);
    player.goToEvent(1);
    expect(player.getProgress()).toBeGreaterThan(0);
  });
});

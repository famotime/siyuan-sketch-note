import { describe, it, expect } from "vitest";
import { ReplayRecorder } from "./recorder";
import type { StrokeReplayEvent, ToolSwitchReplayEvent } from "./types";

describe("replayRecorder", () => {
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

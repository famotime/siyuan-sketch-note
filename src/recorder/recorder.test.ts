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

  it("records all events because filtering is applied during playback", () => {
    const recorder = new ReplayRecorder();
    const event: ToolSwitchReplayEvent = {
      type: "toolSwitch",
      id: "e1",
      timestamp: 1000,
      tool: "pen",
      preset: { tool: "pen", color: "#000", width: 3, opacity: 1, mode: "ink" },
    };
    recorder.record(event);
    expect(recorder.getEvents()).toHaveLength(1);
  });

  it("does not record events while suspended", () => {
    const recorder = new ReplayRecorder();
    recorder.setSuspended(true);
    expect(recorder.isSuspended()).toBe(true);

    recorder.record({
      type: "stroke",
      id: "e1",
      timestamp: 1000,
      stroke: { id: "s1", points: [], color: "#000", width: 3, tool: "pen" },
    });

    expect(recorder.getEvents()).toHaveLength(0);

    recorder.setSuspended(false);
    expect(recorder.isSuspended()).toBe(false);
    recorder.record({
      type: "stroke",
      id: "e2",
      timestamp: 1001,
      stroke: { id: "s2", points: [], color: "#000", width: 3, tool: "pen" },
    });

    expect(recorder.getEvents()).toHaveLength(1);
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
    expect(recorder.getEvents()).toHaveLength(1); // image enabled by default
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

  it("records image events without per-type recording filters", () => {
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

  it("starts with restored events from saved sketch data", () => {
    const restoredEvent: ToolSwitchReplayEvent = {
      type: "toolSwitch",
      id: "saved-tool",
      timestamp: 1000,
      tool: "highlighter",
      preset: { tool: "highlighter", color: "#ff0", width: 18, opacity: 0.45, mode: "marker" },
      source: "mainToolbar",
    };

    const recorder = new ReplayRecorder([restoredEvent]);

    expect(recorder.getEvents()).toEqual([restoredEvent]);
  });

  it("supports undo, redo, and clearHistory operations", () => {
    const recorder = new ReplayRecorder();
    
    // Action 1: Record stroke 1
    recorder.pushUndoSnapshot();
    recorder.record({
      type: "stroke",
      id: "e1",
      timestamp: 1000,
      stroke: { id: "s1", points: [], color: "#000", width: 3, tool: "pen" },
    });
    
    // Action 2: Record stroke 2
    recorder.pushUndoSnapshot();
    recorder.record({
      type: "stroke",
      id: "e2",
      timestamp: 2000,
      stroke: { id: "s2", points: [], color: "#000", width: 3, tool: "pen" },
    });
    
    expect(recorder.getEvents()).toHaveLength(2);
    
    // Perform Undo (reverts Stroke 2)
    expect(recorder.undo()).toBe(true);
    expect(recorder.getEvents()).toHaveLength(1);
    expect(recorder.getEvents()[0].id).toBe("e1");
    
    // Perform Undo (reverts Stroke 1)
    expect(recorder.undo()).toBe(true);
    expect(recorder.getEvents()).toHaveLength(0);
    
    // No more undos possible
    expect(recorder.undo()).toBe(false);
    
    // Perform Redo (restores Stroke 1)
    expect(recorder.redo()).toBe(true);
    expect(recorder.getEvents()).toHaveLength(1);
    expect(recorder.getEvents()[0].id).toBe("e1");
    
    // Perform Redo (restores Stroke 2)
    expect(recorder.redo()).toBe(true);
    expect(recorder.getEvents()).toHaveLength(2);
    expect(recorder.getEvents()[1].id).toBe("e2");
    
    // No more redos possible
    expect(recorder.redo()).toBe(false);
    
    // Clear history
    recorder.clearHistory();
    expect(recorder.undo()).toBe(false);
  });
});

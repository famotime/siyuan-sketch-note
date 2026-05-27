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

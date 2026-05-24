import { describe, expect, it } from "vitest";
import { createImageElement } from "@/elements/image";
import { moveElement } from "@/elements/transform";
import {
  createEngineState,
  handlePointerUp,
  pushHistorySnapshot,
  redo,
  undo,
} from "./canvasEngine";

describe("canvas engine history", () => {
  it("undoes and redoes element geometry changes", () => {
    const state = createEngineState("blank");
    const image = createImageElement("image-1", {
      x: 20,
      y: 30,
      src: "data:image/png;base64,AAA",
    });
    state.elements = [image];

    pushHistorySnapshot(state);
    state.elements = [moveElement(image, 40, 50)];

    expect(undo(state)).toBe(true);
    expect(state.elements[0].bounds).toMatchObject({ x: 20, y: 30 });

    expect(redo(state)).toBe(true);
    expect(state.elements[0].bounds).toMatchObject({ x: 60, y: 80 });
  });

  it("removes whole strokes when eraser preset uses stroke mode", () => {
    const state = createEngineState("blank");
    state.strokes = [
      {
        id: "stroke-1",
        tool: "pen",
        color: "#111111",
        width: 4,
        opacity: 1,
        points: [
          { x: 10, y: 10, pressure: 0.5, timestamp: 1 },
          { x: 100, y: 10, pressure: 0.5, timestamp: 2 },
        ],
      },
      {
        id: "stroke-2",
        tool: "pen",
        color: "#222222",
        width: 4,
        opacity: 1,
        points: [
          { x: 10, y: 100, pressure: 0.5, timestamp: 3 },
          { x: 100, y: 100, pressure: 0.5, timestamp: 4 },
        ],
      },
    ];
    state.tool = "eraser";
    state.toolPresets.eraser.mode = "stroke";
    state.currentStroke = {
      id: "eraser-1",
      tool: "eraser",
      color: "#000000",
      width: 20,
      opacity: 1,
      points: [
        { x: 40, y: 5, pressure: 0.5, timestamp: 5 },
        { x: 40, y: 15, pressure: 0.5, timestamp: 6 },
      ],
    };

    expect(handlePointerUp(state)).toBe(true);

    expect(state.strokes.map((stroke) => stroke.id)).toEqual(["stroke-2"]);
    expect(state.undoStack).toHaveLength(1);
    expect(state.currentStroke).toBeNull();
    expect(state.isDirty).toBe(true);
  });
});

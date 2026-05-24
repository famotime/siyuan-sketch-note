import { describe, expect, it } from "vitest";
import { createImageElement } from "@/elements/image";
import { moveElement } from "@/elements/transform";
import {
  createEngineState,
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
});

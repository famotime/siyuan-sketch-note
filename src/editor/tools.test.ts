import { describe, expect, it } from "vitest";
import {
  getDrawingToolForEditorTool,
  isShapeEditorTool,
  isStrokeEditorTool,
} from "./tools";

describe("editor tools", () => {
  it("identifies stroke tools separately from shape and ruler tools", () => {
    expect(isStrokeEditorTool("pen")).toBe(true);
    expect(isStrokeEditorTool("highlighter")).toBe(true);
    expect(isStrokeEditorTool("eraser")).toBe(true);
    expect(isStrokeEditorTool("rectangle")).toBe(false);
    expect(isStrokeEditorTool("ruler")).toBe(false);
  });

  it("identifies supported shape tools", () => {
    expect(isShapeEditorTool("line")).toBe(true);
    expect(isShapeEditorTool("rectangle")).toBe(true);
    expect(isShapeEditorTool("ellipse")).toBe(true);
    expect(isShapeEditorTool("pen")).toBe(false);
  });

  it("maps non-stroke editor tools to pen for the drawing engine", () => {
    expect(getDrawingToolForEditorTool("rectangle")).toBe("pen");
    expect(getDrawingToolForEditorTool("ruler")).toBe("pen");
    expect(getDrawingToolForEditorTool("eraser")).toBe("eraser");
  });
});

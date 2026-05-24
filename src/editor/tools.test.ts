import { describe, expect, it } from "vitest";
import {
  getDrawingToolForEditorTool,
  isInsertElementEditorTool,
  isShapeEditorTool,
  isStrokeEditorTool,
} from "./tools";

describe("editor tools", () => {
  it("identifies stroke tools separately from shape tools", () => {
    expect(isStrokeEditorTool("pen")).toBe(true);
    expect(isStrokeEditorTool("highlighter")).toBe(true);
    expect(isStrokeEditorTool("eraser")).toBe(true);
    expect(isStrokeEditorTool("rectangle")).toBe(false);
    expect(isStrokeEditorTool("lasso")).toBe(false);
  });

  it("identifies supported shape tools", () => {
    expect(isShapeEditorTool("line")).toBe(true);
    expect(isShapeEditorTool("arrow")).toBe(true);
    expect(isShapeEditorTool("rectangle")).toBe(true);
    expect(isShapeEditorTool("ellipse")).toBe(true);
    expect(isShapeEditorTool("triangle")).toBe(true);
    expect(isShapeEditorTool("pen")).toBe(false);
  });

  it("identifies element insertion tools", () => {
    expect(isInsertElementEditorTool("text")).toBe(true);
    expect(isInsertElementEditorTool("image")).toBe(true);
    expect(isInsertElementEditorTool("pen")).toBe(false);
  });

  it("maps non-stroke editor tools to pen for the drawing engine", () => {
    expect(getDrawingToolForEditorTool("rectangle")).toBe("pen");
    expect(getDrawingToolForEditorTool("triangle")).toBe("pen");
    expect(getDrawingToolForEditorTool("lasso")).toBe("pen");
    expect(getDrawingToolForEditorTool("image")).toBe("pen");
    expect(getDrawingToolForEditorTool("eraser")).toBe("eraser");
  });
});

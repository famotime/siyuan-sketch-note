import { describe, expect, it } from "vitest";
import {
  createEditorToolButtons,
  getToolOptionsVisibility,
} from "./toolbarModel";

describe("editor toolbar model", () => {
  it("groups high-frequency tools into icon-first buttons", () => {
    const buttons = createEditorToolButtons();

    expect(buttons.map((button) => button.tool)).toEqual([
      "pen",
      "highlighter",
      "eraser",
      "lasso",
      "line",
      "text",
      "image",
    ]);
    expect(buttons.every((button) => button.icon.length > 0)).toBe(true);
    expect(buttons.find((button) => button.tool === "pen")).toMatchObject({
      icon: "✏",
      labelKey: "pen",
    });
  });

  it("shows only relevant option controls for active tool families", () => {
    expect(getToolOptionsVisibility("pen")).toEqual({
      eraserMode: false,
      lassoMode: false,
      opacity: true,
      strokeControls: true,
    });
    expect(getToolOptionsVisibility("eraser")).toEqual({
      eraserMode: true,
      lassoMode: false,
      opacity: false,
      strokeControls: true,
    });
    expect(getToolOptionsVisibility("lasso")).toEqual({
      eraserMode: false,
      lassoMode: true,
      opacity: true,
      strokeControls: true,
    });
  });
});

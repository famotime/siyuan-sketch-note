import { describe, expect, it } from "vitest";
import { resolveEditorShortcut } from "./shortcuts";

function keyEvent(init: Partial<KeyboardEvent>): KeyboardEvent {
  return init as KeyboardEvent;
}

describe("editor shortcuts", () => {
  it("maps save and history shortcuts across ctrl and meta keys", () => {
    expect(resolveEditorShortcut(keyEvent({ key: "s", ctrlKey: true }))).toEqual({ type: "save" });
    expect(resolveEditorShortcut(keyEvent({ key: "S", metaKey: true }))).toEqual({ type: "save" });
    expect(resolveEditorShortcut(keyEvent({ key: "z", ctrlKey: true }))).toEqual({ type: "undo" });
    expect(resolveEditorShortcut(keyEvent({ key: "z", ctrlKey: true, shiftKey: true }))).toEqual({ type: "redo" });
    expect(resolveEditorShortcut(keyEvent({ key: "y", ctrlKey: true }))).toEqual({ type: "redo" });
  });

  it("maps selection edit shortcuts", () => {
    expect(resolveEditorShortcut(keyEvent({ key: "Delete" }))).toEqual({ type: "deleteSelection" });
    expect(resolveEditorShortcut(keyEvent({ key: "Backspace" }))).toEqual({ type: "deleteSelection" });
    expect(resolveEditorShortcut(keyEvent({ key: "d", ctrlKey: true }))).toEqual({ type: "duplicateSelection" });
    expect(resolveEditorShortcut(keyEvent({ key: "D", metaKey: true }))).toEqual({ type: "duplicateSelection" });
  });

  it("maps number keys to high-frequency editor tools", () => {
    expect(resolveEditorShortcut(keyEvent({ key: "1" }))).toEqual({ type: "tool", tool: "pen" });
    expect(resolveEditorShortcut(keyEvent({ key: "2" }))).toEqual({ type: "tool", tool: "highlighter" });
    expect(resolveEditorShortcut(keyEvent({ key: "3" }))).toEqual({ type: "tool", tool: "eraser" });
    expect(resolveEditorShortcut(keyEvent({ key: "4" }))).toEqual({ type: "tool", tool: "lasso" });
    expect(resolveEditorShortcut(keyEvent({ key: "5" }))).toEqual({ type: "tool", tool: "ruler" });
    expect(resolveEditorShortcut(keyEvent({ key: "6" }))).toEqual({ type: "tool", tool: "arrow" });
    expect(resolveEditorShortcut(keyEvent({ key: "7" }))).toEqual({ type: "tool", tool: "triangle" });
    expect(resolveEditorShortcut(keyEvent({ key: "8" }))).toEqual({ type: "tool", tool: "line" });
    expect(resolveEditorShortcut(keyEvent({ key: "9" }))).toEqual({ type: "tool", tool: "rectangle" });
    expect(resolveEditorShortcut(keyEvent({ key: "0" }))).toEqual({ type: "tool", tool: "ellipse" });
  });

  it("maps letter keys to insert tools", () => {
    expect(resolveEditorShortcut(keyEvent({ key: "t" }))).toEqual({ type: "tool", tool: "text" });
    expect(resolveEditorShortcut(keyEvent({ key: "i" }))).toEqual({ type: "tool", tool: "image" });
  });

  it("ignores shortcuts while typing in text fields", () => {
    const input = { tagName: "INPUT", isContentEditable: false } as EventTarget;
    expect(resolveEditorShortcut(keyEvent({ key: "1", target: input }))).toBeNull();
    expect(resolveEditorShortcut(keyEvent({ key: "s", ctrlKey: true, target: input }))).toBeNull();
    expect(resolveEditorShortcut(keyEvent({ key: "Delete", target: input }))).toBeNull();
  });
});

import type { EditorTool } from "./tools";

export type EditorShortcut =
  | { type: "deleteSelection" }
  | { type: "duplicateSelection" }
  | { type: "save" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "tool"; tool: EditorTool };

const numberToolMap: Record<string, EditorTool> = {
  "1": "pen",
  "2": "highlighter",
  "3": "eraser",
  "4": "lasso",
  "5": "arrow",
  "6": "triangle",
  "7": "line",
  "8": "rectangle",
  "9": "ellipse",
};

const letterToolMap: Record<string, EditorTool> = {
  i: "image",
  t: "text",
};

export function resolveEditorShortcut(event: KeyboardEvent): EditorShortcut | null {
  if (isTypingTarget(event.target)) return null;

  const key = event.key.toLowerCase();
  const hasCommandModifier = event.ctrlKey || event.metaKey;

  if (hasCommandModifier && key === "s") {
    return { type: "save" };
  }
  if (hasCommandModifier && key === "d") {
    return { type: "duplicateSelection" };
  }
  if (hasCommandModifier && key === "z") {
    return event.shiftKey ? { type: "redo" } : { type: "undo" };
  }
  if (hasCommandModifier && key === "y") {
    return { type: "redo" };
  }
  if (!hasCommandModifier && !event.altKey && !event.shiftKey && numberToolMap[event.key]) {
    return { type: "tool", tool: numberToolMap[event.key] };
  }
  if (!hasCommandModifier && !event.altKey && !event.shiftKey && letterToolMap[key]) {
    return { type: "tool", tool: letterToolMap[key] };
  }
  if (!hasCommandModifier && !event.altKey && !event.shiftKey && (key === "delete" || key === "backspace")) {
    return { type: "deleteSelection" };
  }

  return null;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const candidate = target as { isContentEditable?: boolean; tagName?: string };
  if (candidate.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(candidate.tagName ?? "");
}

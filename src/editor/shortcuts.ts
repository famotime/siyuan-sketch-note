import type { EditorTool } from "./tools";

export type EditorShortcut =
  | { type: "save" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "tool"; tool: EditorTool };

const numberToolMap: Record<string, EditorTool> = {
  "1": "pen",
  "2": "highlighter",
  "3": "eraser",
  "4": "lasso",
  "5": "ruler",
  "6": "arrow",
};

export function resolveEditorShortcut(event: KeyboardEvent): EditorShortcut | null {
  if (isTypingTarget(event.target)) return null;

  const key = event.key.toLowerCase();
  const hasCommandModifier = event.ctrlKey || event.metaKey;

  if (hasCommandModifier && key === "s") {
    return { type: "save" };
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

  return null;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const candidate = target as { isContentEditable?: boolean; tagName?: string };
  if (candidate.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(candidate.tagName ?? "");
}

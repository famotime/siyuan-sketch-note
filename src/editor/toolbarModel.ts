import type { EditorTool } from "./tools";

export interface EditorToolButton {
  icon: string;
  labelKey: string;
  tool: EditorTool;
}

export interface ToolOptionsVisibility {
  eraserMode: boolean;
  lassoMode: boolean;
  opacity: boolean;
  strokeControls: boolean;
}

export function createEditorToolButtons(): EditorToolButton[] {
  return [
    { icon: "✏", labelKey: "pen", tool: "pen" },
    { icon: "▰", labelKey: "highlighter", tool: "highlighter" },
    { icon: "⌫", labelKey: "eraser", tool: "eraser" },
    { icon: "◇", labelKey: "lasso", tool: "lasso" },
    { icon: "／", labelKey: "line", tool: "line" },
    { icon: "→", labelKey: "arrow", tool: "arrow" },
    { icon: "□", labelKey: "rectangle", tool: "rectangle" },
    { icon: "○", labelKey: "ellipse", tool: "ellipse" },
    { icon: "△", labelKey: "triangle", tool: "triangle" },
    { icon: "▤", labelKey: "ruler", tool: "ruler" },
    { icon: "T", labelKey: "text", tool: "text" },
    { icon: "▧", labelKey: "image", tool: "image" },
  ];
}

export function getToolOptionsVisibility(tool: EditorTool): ToolOptionsVisibility {
  return {
    eraserMode: tool === "eraser",
    lassoMode: tool === "lasso",
    opacity: tool !== "eraser",
    strokeControls: true,
  };
}

import type { EditorTool } from "./tools";
import type { IconParkName } from "./iconParkIcons";
import { isShapeEditorTool } from "./tools";

export interface EditorToolButton {
  icon: IconParkName;
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
    { icon: "Write", labelKey: "pen", tool: "pen" },
    { icon: "FormatBrush", labelKey: "highlighter", tool: "highlighter" },
    { icon: "DeleteKey", labelKey: "eraser", tool: "eraser" },
    { icon: "Selected", labelKey: "lasso", tool: "lasso" },
    { icon: "Minus", labelKey: "shape", tool: "line" },
    { icon: "Text", labelKey: "text", tool: "text" },
    { icon: "AddPic", labelKey: "image", tool: "image" },
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

export function getToolButtonActiveState(activeTool: EditorTool, buttonTool: EditorTool): boolean {
  if (isShapeEditorTool(buttonTool)) {
    return isShapeEditorTool(activeTool);
  }
  return activeTool === buttonTool;
}

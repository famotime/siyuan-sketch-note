import type { SketchTool } from "@/types/sketch";

export type ShapeEditorTool = "line" | "rectangle" | "ellipse";
export type EditorTool = SketchTool | ShapeEditorTool | "ruler";

const strokeTools: EditorTool[] = ["pen", "highlighter", "eraser"];
const shapeTools: EditorTool[] = ["line", "rectangle", "ellipse"];

export function isStrokeEditorTool(tool: EditorTool): tool is SketchTool {
  return strokeTools.includes(tool);
}

export function isShapeEditorTool(tool: EditorTool): tool is ShapeEditorTool {
  return shapeTools.includes(tool);
}

export function getDrawingToolForEditorTool(tool: EditorTool): SketchTool {
  return isStrokeEditorTool(tool) ? tool : "pen";
}

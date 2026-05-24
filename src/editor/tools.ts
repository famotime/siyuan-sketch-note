import type { SketchTool } from "@/types/sketch";

export type ShapeEditorTool = "line" | "rectangle" | "ellipse";
export type InsertElementEditorTool = "text" | "image";
export type EditorTool = SketchTool | ShapeEditorTool | "ruler" | InsertElementEditorTool;

const strokeTools: EditorTool[] = ["pen", "highlighter", "eraser"];
const shapeTools: EditorTool[] = ["line", "rectangle", "ellipse"];
const insertElementTools: EditorTool[] = ["text", "image"];

export function isStrokeEditorTool(tool: EditorTool): tool is SketchTool {
  return strokeTools.includes(tool);
}

export function isShapeEditorTool(tool: EditorTool): tool is ShapeEditorTool {
  return shapeTools.includes(tool);
}

export function isInsertElementEditorTool(tool: EditorTool): tool is InsertElementEditorTool {
  return insertElementTools.includes(tool);
}

export function getDrawingToolForEditorTool(tool: EditorTool): SketchTool {
  return isStrokeEditorTool(tool) ? tool : "pen";
}

import type { SketchPage, SketchPageMode } from "@/types/sketch";

export interface InsertElementPositionInput {
  canvasWidth: number;
  pageMode?: SketchPageMode;
  activePageId?: string;
  pages?: SketchPage[];
  elementWidth: number;
  topOffset: number;
}

export interface InsertElementPosition {
  x: number;
  y: number;
}

export function createInsertElementPosition(input: InsertElementPositionInput): InsertElementPosition {
  const page = input.pageMode === "paged"
    ? input.pages?.find((item) => item.id === input.activePageId) ?? input.pages?.[0]
    : undefined;
  const width = page?.width ?? input.canvasWidth;
  const left = page?.x ?? 0;
  const top = page?.y ?? 0;

  return {
    x: left + width / 2 - input.elementWidth / 2,
    y: top + input.topOffset,
  };
}

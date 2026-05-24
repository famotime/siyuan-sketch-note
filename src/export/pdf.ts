import type { SketchData } from "@/types/sketch";

export const DEFAULT_PDF_PAGE_HEIGHT = 1000;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export interface PdfExportPlanInput {
  blockId: string;
  canvasWidth: number;
  canvasHeight: number;
  pageHeight: number;
}

export interface PdfExportPage {
  index: number;
  sourceX: number;
  sourceY: number;
  width: number;
  height: number;
}

export interface PdfExportPlan {
  blockId: string;
  pageHeight: number;
  pages: PdfExportPage[];
}

export function createExportPdfFileName(blockId: string, date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = pad(date.getUTCMonth() + 1);
  const dd = pad(date.getUTCDate());
  const hh = pad(date.getUTCHours());
  const mi = pad(date.getUTCMinutes());
  const ss = pad(date.getUTCSeconds());
  return `sketch-note-${blockId}-${yyyy}${mm}${dd}-${hh}${mi}${ss}.pdf`;
}

export function createPdfExportPlan(input: PdfExportPlanInput): PdfExportPlan {
  if (input.pageHeight <= 0) {
    throw new Error("PDF export pageHeight must be greater than 0");
  }
  if (input.canvasWidth <= 0) {
    throw new Error("PDF export canvasWidth must be greater than 0");
  }
  if (input.canvasHeight <= 0) {
    throw new Error("PDF export canvasHeight must be greater than 0");
  }

  const pages: PdfExportPage[] = [];
  for (let sourceY = 0, index = 0; sourceY < input.canvasHeight; sourceY += input.pageHeight, index++) {
    pages.push({
      index,
      sourceX: 0,
      sourceY,
      width: input.canvasWidth,
      height: Math.min(input.pageHeight, input.canvasHeight - sourceY),
    });
  }

  return {
    blockId: input.blockId,
    pageHeight: input.pageHeight,
    pages,
  };
}

export function createPdfExportPlanFromSketch(
  blockId: string,
  data: SketchData,
  pageHeight = DEFAULT_PDF_PAGE_HEIGHT,
): PdfExportPlan {
  return createPdfExportPlan({
    blockId,
    canvasWidth: data.canvasWidth,
    canvasHeight: data.canvasHeight,
    pageHeight,
  });
}

export async function exportPdf(_plan: PdfExportPlan): Promise<Blob> {
  throw new Error("PDF rendering backend is not configured");
}

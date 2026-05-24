import type { SketchData } from "@/types/sketch";
import { getSketchPages } from "@/pages/model";

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

export interface PdfExportOptions {
  pageImages: string[];
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
  if (data.pageMode === "paged" && data.pages?.length) {
    return {
      blockId,
      pageHeight: data.pages[0].height,
      pages: getSketchPages(data).map((page) => ({
        index: page.index,
        sourceX: page.x,
        sourceY: page.y,
        width: page.width,
        height: page.height,
      })),
    };
  }

  return createPdfExportPlan({
    blockId,
    canvasWidth: data.canvasWidth,
    canvasHeight: data.canvasHeight,
    pageHeight,
  });
}

export async function exportPdf(plan: PdfExportPlan, options: PdfExportOptions): Promise<Blob> {
  if (options.pageImages.length !== plan.pages.length) {
    throw new Error("PDF export requires one rendered image per planned PDF page");
  }

  const objects: string[] = [];
  const catalogId = addObject(objects, "<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId = addPlaceholder(objects);
  const pageIds: number[] = [];

  for (let i = 0; i < plan.pages.length; i++) {
    const page = plan.pages[i];
    const image = parseImageDataUrl(options.pageImages[i]);
    const imageId = addObject(
      objects,
      [
        `<< /Type /XObject /Subtype /Image /Width ${Math.max(1, Math.round(page.width))}`,
        `/Height ${Math.max(1, Math.round(page.height))} /ColorSpace /DeviceRGB`,
        `/BitsPerComponent 8 /Filter ${image.filter} /Length ${image.binary.length} >>`,
        "stream",
        image.binary,
        "endstream",
      ].join("\n"),
    );
    const content = [
      "q",
      `${formatNumber(page.width)} 0 0 ${formatNumber(page.height)} 0 0 cm`,
      `/Im${i} Do`,
      "Q",
    ].join("\n");
    const contentId = addObject(objects, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const pageId = addObject(
      objects,
      [
        `<< /Type /Page /Parent ${pagesId} 0 R`,
        `/MediaBox [0 0 ${formatNumber(page.width)} ${formatNumber(page.height)}]`,
        `/Resources << /XObject << /Im${i} ${imageId} 0 R >> >>`,
        `/Contents ${contentId} 0 R >>`,
      ].join(" "),
    );
    pageIds.push(pageId);
  }

  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  const pdf = buildPdf(objects, catalogId);
  return new Blob([binaryStringToUint8Array(pdf)], { type: "application/pdf" });
}

function addObject(objects: string[], body: string): number {
  objects.push(body);
  return objects.length;
}

function addPlaceholder(objects: string[]): number {
  objects.push("");
  return objects.length;
}

function parseImageDataUrl(dataUrl: string): { binary: string; filter: string } {
  const match = /^data:(image\/jpeg);base64,(.+)$/i.exec(dataUrl);
  if (!match) {
    throw new Error("PDF export only supports JPEG data URLs");
  }

  return {
    binary: atob(match[2]),
    filter: "/DCTDecode",
  };
}

function buildPdf(objects: string[], rootId: number): string {
  let output = "%PDF-1.4\n%âãÏÓ\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(output.length);
    output += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = output.length;
  output += `xref\n0 ${objects.length + 1}\n`;
  output += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    output += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root ${rootId} 0 R >>\n`;
  output += `startxref\n${xrefOffset}\n%%EOF`;
  return output;
}

function binaryStringToUint8Array(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i++) {
    bytes[i] = value.charCodeAt(i) & 0xFF;
  }
  return bytes;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

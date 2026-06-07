import type { SketchData } from "@/types/sketch";
import { createPageNavigator } from "@/pages/model";
import { pad } from "@/utils/date";
import { embedInPng } from "./embedding";

export interface PngExportPlan {
  blockId: string;
  pageNumber: number;
  sourceX: number;
  sourceY: number;
  width: number;
  height: number;
}

export function createExportPngFileName(blockId: string, date = new Date(), pageNumber?: number): string {
  const yyyy = date.getUTCFullYear();
  const mm = pad(date.getUTCMonth() + 1);
  const dd = pad(date.getUTCDate());
  const hh = pad(date.getUTCHours());
  const mi = pad(date.getUTCMinutes());
  const ss = pad(date.getUTCSeconds());
  const pageSuffix = pageNumber ? `-p${pageNumber}` : "";
  return `sketch-note-${blockId}${pageSuffix}-${yyyy}${mm}${dd}-${hh}${mi}${ss}.png`;
}

export function createCurrentPagePngExportPlan(blockId: string, data: SketchData): PngExportPlan {
  const navigator = createPageNavigator(data);
  const page = navigator.current ?? navigator.pages[0];
  if (!page) {
    throw new Error("PNG export requires at least one sketch page");
  }

  return {
    blockId,
    pageNumber: page.index + 1,
    sourceX: page.x,
    sourceY: page.y,
    width: page.width,
    height: page.height,
  };
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, payload] = dataUrl.split(",");
  const mimeString = meta.split(":")[1].split(";")[0];
  const byteString = atob(payload);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** 将渲染好的 PNG blob 嵌入矢量 SketchData，返回新的 PNG blob */
export async function embedSketchDataInPngBlob(
  pngBlob: Blob,
  sketchData: SketchData,
): Promise<Blob> {
  return embedInPng(pngBlob, sketchData);
}

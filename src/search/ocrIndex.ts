import type { Bounds } from "@/elements/model";
import type { SketchData, SketchPage } from "@/types/sketch";
import { getSketchPages } from "@/pages/model";

export interface OcrLine {
  text: string;
  confidence: number;
  bounds: Bounds;
  localBounds?: Bounds;
  pageId?: string;
  pageNumber?: number;
}

export interface OcrIndex {
  blockId: string;
  lines: OcrLine[];
  text: string;
  updatedAt: number;
}

export interface OcrSearchResult {
  blockId: string;
  text: string;
  bounds: Bounds;
  localBounds?: Bounds;
  confidence: number;
  pageId?: string;
  pageNumber?: number;
}

export function createOcrIndex(
  blockId: string,
  lines: OcrLine[],
  updatedAt = Date.now(),
): OcrIndex {
  const normalizedLines = lines.map((line) => ({
    ...line,
    text: line.text.trim(),
  })).filter((line) => line.text.length > 0);

  return {
    blockId,
    lines: normalizedLines,
    text: normalizeText(normalizedLines.map((line) => line.text).join(" ")),
    updatedAt,
  };
}

export function createPageAwareOcrIndex(
  blockId: string,
  lines: OcrLine[],
  data: SketchData,
  updatedAt = Date.now(),
): OcrIndex {
  const pages = getSketchPages(data);
  return createOcrIndex(
    blockId,
    lines.map((line) => ({
      ...line,
      ...findPageForBounds(line.bounds, pages),
    })),
    updatedAt,
  );
}

export function searchOcrIndex(index: OcrIndex, query: string): OcrSearchResult[] {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return [];

  return index.lines
    .filter((line) => normalizeText(line.text).includes(normalizedQuery))
    .map((line) => ({
      blockId: index.blockId,
      text: line.text,
      bounds: line.bounds,
      localBounds: line.localBounds,
      confidence: line.confidence,
      pageId: line.pageId,
      pageNumber: line.pageNumber,
    }));
}

export function searchOcrIndexes(indexes: OcrIndex[], query: string): OcrSearchResult[] {
  return indexes.flatMap((index) => searchOcrIndex(index, query));
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function findPageForBounds(bounds: Bounds, pages: SketchPage[]): Pick<OcrLine, "localBounds" | "pageId" | "pageNumber"> {
  const centerY = bounds.y + bounds.height / 2;
  const page = pages.find((item) => centerY >= item.y && centerY <= item.y + item.height);
  if (!page) return {};

  return {
    localBounds: {
      ...bounds,
      x: bounds.x - page.x,
      y: bounds.y - page.y,
    },
    pageId: page.id,
    pageNumber: page.index + 1,
  };
}

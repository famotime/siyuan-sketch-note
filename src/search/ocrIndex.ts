import type { Bounds } from "@/elements/model";

export interface OcrLine {
  text: string;
  confidence: number;
  bounds: Bounds;
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
  confidence: number;
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

export function searchOcrIndex(index: OcrIndex, query: string): OcrSearchResult[] {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return [];

  return index.lines
    .filter((line) => normalizeText(line.text).includes(normalizedQuery))
    .map((line) => ({
      blockId: index.blockId,
      text: line.text,
      bounds: line.bounds,
      confidence: line.confidence,
    }));
}

export function searchOcrIndexes(indexes: OcrIndex[], query: string): OcrSearchResult[] {
  return indexes.flatMap((index) => searchOcrIndex(index, query));
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

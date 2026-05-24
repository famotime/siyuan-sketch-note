import { migrateStrokesToElements, withStrokeBounds } from "@/elements/model";
import { getSketchPages } from "@/pages/model";
import { normalizeRecentColors } from "@/tools/palette";
import type { SketchData } from "@/types/sketch";
import {
  CANVAS_INITIAL_HEIGHT,
  CANVAS_LOGICAL_WIDTH,
  DEFAULT_SKETCH_DATA,
} from "@/types/sketch";

export interface SketchDataRecovery {
  data: SketchData;
  raw: unknown;
  reason: string;
  recovered: boolean;
}

export function migrateSketchData(raw: unknown): SketchData {
  assertSketchDataShape(raw);
  const data = raw as SketchData;
  const strokes = data.strokes.map(withStrokeBounds);
  const canvasWidth = data.canvasWidth || CANVAS_LOGICAL_WIDTH;
  const canvasHeight = data.canvasHeight || CANVAS_INITIAL_HEIGHT;
  const pageMode = data.pageMode;
  const pages = pageMode === "paged"
    ? getSketchPages({
        activePageId: data.activePageId,
        canvasHeight,
        canvasWidth,
        pageMode,
        pages: data.pages,
      })
    : data.pages;

  return {
    ...data,
    activePageId: pageMode === "paged" ? data.activePageId ?? pages?.[0]?.id : data.activePageId,
    canvasWidth,
    canvasHeight,
    elements: data.elements ?? migrateStrokesToElements(strokes),
    pages,
    recentColors: normalizeRecentColors(data.recentColors),
    strokes,
    template: data.template || DEFAULT_SKETCH_DATA.template,
    version: 1,
  };
}

export function recoverSketchData(raw: unknown): SketchDataRecovery {
  try {
    return {
      data: migrateSketchData(raw),
      raw,
      reason: "",
      recovered: false,
    };
  } catch (error) {
    return {
      data: {
        ...DEFAULT_SKETCH_DATA,
        elements: [],
        recovery: {
          recovered: true,
          reason: error instanceof Error ? error.message : "Unknown sketch data migration error",
        },
        strokes: [],
      },
      raw,
      reason: error instanceof Error ? error.message : "Unknown sketch data migration error",
      recovered: true,
    };
  }
}

function assertSketchDataShape(raw: unknown): asserts raw is SketchData {
  if (!raw || typeof raw !== "object") {
    throw new Error("Sketch data is not an object");
  }

  const candidate = raw as Partial<SketchData>;
  if (candidate.version !== 1) {
    throw new Error(`Unsupported sketch data version: ${String(candidate.version)}`);
  }

  if (!Array.isArray(candidate.strokes)) {
    throw new Error("Sketch data strokes field is not an array");
  }
}

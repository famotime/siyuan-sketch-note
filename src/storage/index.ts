import type { SketchData } from "@/types/sketch";
import { DEFAULT_SKETCH_DATA } from "@/types/sketch";
import { migrateStrokesToElements } from "@/elements/model";

export { thumbnailCanvas } from "./thumbnail";

const STORAGE_PREFIX = "sketch:";

export function storageKey(blockId: string): string {
  return `${STORAGE_PREFIX}${blockId}`;
}

/**
 * Load sketch data for a given block ID.
 * Returns null if no data exists.
 */
export async function loadSketchData(
  loadData: (key: string) => Promise<any>,
  blockId: string
): Promise<SketchData | null> {
  const key = storageKey(blockId);
  const raw = await loadData(key);
  if (!raw) return null;

  // Validate version
  if (raw.version !== 1) {
    console.warn(`[Sketch Note] Unknown data version: ${raw.version}`);
    return null;
  }

  // Validate essential fields (data corruption guard)
  if (!Array.isArray(raw.strokes)) {
    console.warn(`[Sketch Note] Corrupted data for block ${blockId}: strokes is not an array`);
    return null;
  }

  const data = raw as SketchData;
  return {
    ...data,
    elements: data.elements ?? migrateStrokesToElements(data.strokes),
  };
}

/**
 * Save sketch data for a given block ID.
 */
export async function saveSketchData(
  saveData: (key: string, data: any) => Promise<void>,
  blockId: string,
  data: SketchData
): Promise<void> {
  const key = storageKey(blockId);
  await saveData(key, data);
}

/**
 * Create a new empty sketch data object.
 */
export function createEmptySketchData(templateId: string): SketchData {
  return {
    ...DEFAULT_SKETCH_DATA,
    template: templateId,
    elements: [],
    strokes: [],
  };
}

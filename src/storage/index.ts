import type { SketchData } from "@/types/sketch";
import { DEFAULT_SKETCH_DATA } from "@/types/sketch";
import { recoverSketchData } from "./migrations";

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

  const recovery = recoverSketchData(raw);
  if (recovery.recovered) {
    console.warn(`[Sketch Note] Recovered corrupted data for block ${blockId}: ${recovery.reason}`);
  }
  return recovery.data;
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

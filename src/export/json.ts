import type { SketchData } from "@/types/sketch";
import { migrateSketchData } from "@/storage/migrations";
import { normalizeToolPresets } from "@/tools/presets";
import { pad } from "@/utils/date";

export function createExportJsonFileName(blockId: string, date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = pad(date.getUTCMonth() + 1);
  const dd = pad(date.getUTCDate());
  const hh = pad(date.getUTCHours());
  const mi = pad(date.getUTCMinutes());
  const ss = pad(date.getUTCSeconds());
  return `sketch-note-${blockId}-${yyyy}${mm}${dd}-${hh}${mi}${ss}.json`;
}

export function exportSketchJson(data: SketchData): Blob {
  return new Blob([`${JSON.stringify(data, null, 2)}\n`], {
    type: "application/json",
  });
}

export function importSketchJson(text: string): SketchData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Invalid sketch JSON");
  }

  try {
    const data = migrateSketchData(raw);
    return {
      ...data,
      toolPresets: normalizeToolPresets(data.toolPresets),
    };
  } catch {
    throw new Error("Unsupported sketch JSON");
  }
}

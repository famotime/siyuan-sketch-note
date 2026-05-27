import type { SketchData } from "@/types/sketch";
import { DEFAULT_SKETCH_DATA } from "@/types/sketch";
import type { SketchInputSettings } from "@/editor/inputMode";
import { normalizeInputSettings } from "@/editor/inputMode";
import type { CustomBackgroundTemplate } from "@/template/customBackground";
import { createLogger } from "@/utils/logger";
import { recoverSketchData } from "./migrations";

export { thumbnailCanvas } from "./thumbnail";

const STORAGE_PREFIX = "sketch-";
const STORAGE_SUFFIX = ".json";
const LEGACY_STORAGE_PREFIX = "sketch:";
const EDITOR_PREFERENCES_KEY = "sketch-editor-preferences.json";

export interface SketchEditorPreferences {
  template: string;
  inputSettings: SketchInputSettings;
  customBackgrounds: CustomBackgroundTemplate[];
}

export function storageKey(blockId: string): string {
  return `${STORAGE_PREFIX}${blockId}${STORAGE_SUFFIX}`;
}

export function editorPreferencesKey(): string {
  return EDITOR_PREFERENCES_KEY;
}

function legacyStorageKey(blockId: string): string {
  return `${LEGACY_STORAGE_PREFIX}${blockId}`;
}

/**
 * Load sketch data for a given block ID.
 * Returns null if no data exists.
 */
export async function loadSketchData(
  loadData: (key: string) => Promise<any>,
  blockId: string,
): Promise<SketchData | null> {
  const key = storageKey(blockId);
  let raw = await loadData(key);
  if (!raw) {
    raw = await loadData(legacyStorageKey(blockId));
  }
  if (!raw) return null;

  const recovery = recoverSketchData(raw);
  if (recovery.recovered) {
    createLogger().warn(`Recovered corrupted data for block ${blockId}: ${recovery.reason}`);
  }
  return recovery.data;
}

/**
 * Save sketch data for a given block ID.
 */
export async function saveSketchData(
  saveData: (key: string, data: any) => Promise<void>,
  blockId: string,
  data: SketchData,
): Promise<void> {
  const key = storageKey(blockId);
  await saveData(key, data);
}

export function normalizeEditorPreferences(input?: Partial<SketchEditorPreferences> | null): SketchEditorPreferences {
  return {
    template: typeof input?.template === "string" ? input.template : DEFAULT_SKETCH_DATA.template,
    inputSettings: normalizeInputSettings(input?.inputSettings),
    customBackgrounds: Array.isArray(input?.customBackgrounds) ? input.customBackgrounds : [],
  };
}

export async function loadEditorPreferences(
  loadData: (key: string) => Promise<any>,
): Promise<SketchEditorPreferences> {
  return normalizeEditorPreferences(await loadData(editorPreferencesKey()));
}

export async function saveEditorPreferences(
  saveData: (key: string, data: any) => Promise<void>,
  preferences: Partial<SketchEditorPreferences>,
): Promise<void> {
  await saveData(editorPreferencesKey(), normalizeEditorPreferences(preferences));
}

/**
 * Create a new empty sketch data object.
 */
export function createEmptySketchData(template: string | Partial<SketchEditorPreferences> = DEFAULT_SKETCH_DATA.template): SketchData {
  const preferences = typeof template === "string" ? normalizeEditorPreferences({ template }) : normalizeEditorPreferences(template);
  return {
    ...DEFAULT_SKETCH_DATA,
    template: preferences.template,
    inputSettings: preferences.inputSettings,
    customBackgrounds: preferences.customBackgrounds,
    elements: [],
    strokes: [],
  };
}

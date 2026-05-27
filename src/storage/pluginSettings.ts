const PLUGIN_SETTINGS_KEY = "plugin-settings.json";

export interface SketchPluginSettings {
  enableDebugLog: boolean;
}

export function pluginSettingsKey(): string {
  return PLUGIN_SETTINGS_KEY;
}

export function normalizePluginSettings(input?: Partial<SketchPluginSettings> | null): SketchPluginSettings {
  return {
    enableDebugLog: input?.enableDebugLog === true,
  };
}

export async function loadPluginSettings(
  loadData: (key: string) => Promise<any>,
): Promise<SketchPluginSettings> {
  return normalizePluginSettings(await loadData(pluginSettingsKey()));
}

export async function savePluginSettings(
  saveData: (key: string, data: any) => Promise<void>,
  settings: Partial<SketchPluginSettings>,
): Promise<void> {
  await saveData(pluginSettingsKey(), normalizePluginSettings(settings));
}

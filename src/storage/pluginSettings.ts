import type { ReplayRecorderConfig } from "@/recorder/types";
import { DEFAULT_RECORDER_CONFIG } from "@/recorder/types";

const PLUGIN_SETTINGS_KEY = "plugin-settings.json";

export interface SketchPluginSettings {
  enableDebugLog: boolean;
  hideReplayControls: boolean;
  replayPlaybackEnabled: boolean;
  replayRecordingEnabled: boolean;
  replayRecordConfig: ReplayRecorderConfig;
}

export function pluginSettingsKey(): string {
  return PLUGIN_SETTINGS_KEY;
}

export function normalizePluginSettings(input?: Partial<SketchPluginSettings> | null): SketchPluginSettings {
  const replayRecordConfig = { ...DEFAULT_RECORDER_CONFIG, ...input?.replayRecordConfig };
  if (input?.replayRecordConfig?.image === false) {
    replayRecordConfig.imageTransform = false;
    replayRecordConfig.imageDelete = false;
  }
  return {
    enableDebugLog: input?.enableDebugLog === true,
    hideReplayControls: input?.hideReplayControls === true,
    replayPlaybackEnabled: input?.replayPlaybackEnabled !== false,
    replayRecordingEnabled: input?.replayRecordingEnabled === true,
    replayRecordConfig,
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

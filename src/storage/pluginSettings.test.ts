import { describe, expect, it } from "vitest";
import { DEFAULT_RECORDER_CONFIG } from "@/recorder/types";
import {
  loadPluginSettings,
  normalizePluginSettings,
  pluginSettingsKey,
  savePluginSettings,
} from "./pluginSettings";

describe("plugin settings", () => {
  it("defaults debug logging to disabled", () => {
    expect(normalizePluginSettings()).toEqual({
      enableDebugLog: false,
      hideReplayControls: false,
      replayPlaybackEnabled: true,
      replayRecordingEnabled: false,
      replayRecordConfig: { ...DEFAULT_RECORDER_CONFIG },
    });
  });

  it("loads and saves normalized plugin settings", async () => {
    const store = new Map<string, any>();

    await savePluginSettings(
      async (key, data) => {
        store.set(key, data);
      },
      { enableDebugLog: true },
    );

    expect(store.get(pluginSettingsKey())).toEqual({
      enableDebugLog: true,
      hideReplayControls: false,
      replayPlaybackEnabled: true,
      replayRecordingEnabled: false,
      replayRecordConfig: { ...DEFAULT_RECORDER_CONFIG },
    });

    const loaded = await loadPluginSettings(async (key) => store.get(key));

    expect(loaded.enableDebugLog).toBe(true);
  });

  it("normalizes replay recording and grouped image replay settings", () => {
    const settings = normalizePluginSettings({
      replayRecordingEnabled: true,
      replayRecordConfig: {
        ...DEFAULT_RECORDER_CONFIG,
        image: false,
      },
    });

    expect(settings.replayRecordingEnabled).toBe(true);
    expect(settings.replayRecordConfig.image).toBe(false);
    expect(settings.replayRecordConfig.imageTransform).toBe(false);
    expect(settings.replayRecordConfig.imageDelete).toBe(false);
  });

  it("lets replay playback stay enabled independently from recording", () => {
    const settings = normalizePluginSettings({
      replayPlaybackEnabled: false,
      replayRecordingEnabled: true,
    });

    expect(settings.replayPlaybackEnabled).toBe(false);
    expect(settings.replayRecordingEnabled).toBe(true);
  });
});

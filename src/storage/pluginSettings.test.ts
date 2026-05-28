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
      replayRecordConfig: { ...DEFAULT_RECORDER_CONFIG },
    });

    const loaded = await loadPluginSettings(async (key) => store.get(key));

    expect(loaded.enableDebugLog).toBe(true);
  });
});

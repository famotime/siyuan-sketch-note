// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { bumpSyncMarker, SYNC_MARKER_STORAGE_KEY } from "./syncMarker";
import { updateImageColorInversionStyle } from "@/theme/inversion";

describe("syncMarker", () => {
  it("saves timestamped sync marker to plugin storage", async () => {
    const saveStorage = vi.fn().mockResolvedValue(undefined);
    await bumpSyncMarker(saveStorage);

    expect(saveStorage).toHaveBeenCalledTimes(1);
    expect(saveStorage).toHaveBeenCalledWith(
      SYNC_MARKER_STORAGE_KEY,
      expect.objectContaining({ timestamp: expect.any(Number) }),
    );
  });
});

describe("theme inversion", () => {
  it("injects and cleans up style element according to inversion mode", () => {
    updateImageColorInversionStyle("on-dark");
    let style = document.getElementById("snippetCSS-sketchNoteColorInversion");
    expect(style).not.toBeNull();
    expect(style?.textContent).toContain("hue-rotate(180deg)");

    updateImageColorInversionStyle("disabled");
    style = document.getElementById("snippetCSS-sketchNoteColorInversion");
    expect(style).toBeNull();
  });
});

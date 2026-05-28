import { describe, expect, it } from "vitest";
import {
  buildSketchImageMarkdown,
  extractSketchIdFromImage,
  sketchAssetFileName,
} from "./sketchReference";

function createImage(attrs: Record<string, string>): HTMLImageElement {
  return {
    dataset: attrs["data-src"] ? { src: attrs["data-src"] } : {},
    getAttribute: (name: string) => attrs[name] ?? null,
  } as HTMLImageElement;
}

describe("sketch reference helpers", () => {
  it("builds markdown with stable sketch id in alt text", () => {
    expect(buildSketchImageMarkdown("sketch-1")).toBe("![sketch:sketch-1](assets/sketch-note-sketch-1.png)");
  });

  it("extracts stable sketch id from image alt text before asset file name", () => {
    const img = createImage({
      "alt": "sketch:stable-id",
      "data-src": "assets/sketch-note-renamed-id.png",
    });

    expect(extractSketchIdFromImage(img)).toBe("stable-id");
  });

  it("falls back to legacy sketch id from asset file name", () => {
    const img = createImage({
      "data-src": "assets/sketch-note-legacy-id.png",
    });

    expect(extractSketchIdFromImage(img)).toBe("legacy-id");
  });

  it("ignores cache query strings when reading asset file names", () => {
    const img = createImage({
      src: "assets/sketch-note-cached-id.png?t=123",
    });

    expect(extractSketchIdFromImage(img)).toBe("cached-id");
  });

  it("keeps the existing asset naming format", () => {
    expect(sketchAssetFileName("sketch-1")).toBe("sketch-note-sketch-1.png");
  });
});

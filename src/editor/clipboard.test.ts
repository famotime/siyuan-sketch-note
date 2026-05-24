import { describe, expect, it } from "vitest";
import { getFirstImageFileFromClipboard } from "./clipboard";

describe("clipboard helpers", () => {
  it("returns the first image file from clipboard items", () => {
    const image = new File(["png"], "note.png", { type: "image/png" });
    const text = new File(["txt"], "note.txt", { type: "text/plain" });

    const file = getFirstImageFileFromClipboard([
      { type: "text/plain", getAsFile: () => text },
      { type: "image/png", getAsFile: () => image },
    ]);

    expect(file).toBe(image);
  });

  it("returns null when clipboard has no image", () => {
    const file = getFirstImageFileFromClipboard([
      { type: "text/plain", getAsFile: () => new File(["txt"], "note.txt", { type: "text/plain" }) },
    ]);

    expect(file).toBeNull();
  });
});

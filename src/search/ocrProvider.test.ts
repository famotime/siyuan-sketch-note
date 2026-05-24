import { describe, expect, it } from "vitest";
import { createNoopOcrProvider } from "./ocrProvider";

describe("ocrProvider", () => {
  it("noop provider returns empty results", async () => {
    const provider = createNoopOcrProvider();
    const blob = new Blob(["fake"], { type: "image/png" });
    const results = await provider({
      imageBlob: blob,
      canvasWidth: 800,
      canvasHeight: 1200,
    });
    expect(results).toEqual([]);
  });

  it("noop provider returns a promise", () => {
    const provider = createNoopOcrProvider();
    const blob = new Blob(["fake"], { type: "image/png" });
    const result = provider({ imageBlob: blob, canvasWidth: 800, canvasHeight: 1200 });
    expect(result).toBeInstanceOf(Promise);
  });
});

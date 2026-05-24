import { describe, expect, it } from "vitest";
import {
  createExportPngFileName,
  dataUrlToBlob,
} from "./png";

describe("png export helpers", () => {
  it("creates a stable export file name from block id and timestamp", () => {
    expect(createExportPngFileName("20260524123456-abc", new Date("2026-05-24T07:08:09Z"))).toBe(
      "sketch-note-20260524123456-abc-20260524-070809.png",
    );
  });

  it("converts a png data url to a blob", async () => {
    const blob = dataUrlToBlob("data:image/png;base64,QUJD");

    expect(blob.type).toBe("image/png");
    expect(blob.size).toBe(3);
    expect(await blob.text()).toBe("ABC");
  });
});

import { describe, expect, it } from "vitest";
import {
  createCurrentPagePngExportPlan,
  createExportPngFileName,
  dataUrlToBlob,
} from "./png";

describe("png export helpers", () => {
  it("creates a stable export file name from block id and timestamp", () => {
    expect(createExportPngFileName("20260524123456-abc", new Date("2026-05-24T07:08:09Z"))).toBe(
      "sketch-note-20260524123456-abc-20260524-070809.png",
    );
  });

  it("adds page number to the export file name when provided", () => {
    expect(createExportPngFileName("block-1", new Date("2026-05-24T07:08:09Z"), 3)).toBe(
      "sketch-note-block-1-p3-20260524-070809.png",
    );
  });

  it("creates a current-page png export plan from active page", () => {
    const plan = createCurrentPagePngExportPlan("block-1", {
      version: 1,
      template: "blank",
      canvasWidth: 800,
      canvasHeight: 2000,
      pageMode: "paged",
      activePageId: "page-2",
      pages: [
        { id: "page-1", index: 0, x: 0, y: 0, width: 800, height: 1000 },
        { id: "page-2", index: 1, x: 0, y: 1000, width: 800, height: 1000 },
      ],
      strokes: [],
    });

    expect(plan).toEqual({
      blockId: "block-1",
      pageNumber: 2,
      sourceX: 0,
      sourceY: 1000,
      width: 800,
      height: 1000,
    });
  });

  it("falls back to the first derived page when no active page exists", () => {
    const plan = createCurrentPagePngExportPlan("block-1", {
      version: 1,
      template: "blank",
      canvasWidth: 800,
      canvasHeight: 1200,
      strokes: [],
    });

    expect(plan).toMatchObject({
      pageNumber: 1,
      sourceY: 0,
      width: 800,
      height: 1000,
    });
  });

  it("converts a png data url to a blob", async () => {
    const blob = dataUrlToBlob("data:image/png;base64,QUJD");

    expect(blob.type).toBe("image/png");
    expect(blob.size).toBe(3);
    expect(await blob.text()).toBe("ABC");
  });
});

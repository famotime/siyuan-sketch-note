import { describe, expect, it } from "vitest";
import {
  createExportPdfFileName,
  createPdfExportPlanFromSketch,
  createPdfExportPlan,
  exportPdf,
} from "./pdf";

describe("pdf export helpers", () => {
  it("creates a stable pdf export file name from block id and timestamp", () => {
    expect(createExportPdfFileName("20260524123456-abc", new Date("2026-05-24T07:08:09Z"))).toBe(
      "sketch-note-20260524123456-abc-20260524-070809.pdf",
    );
  });

  it("splits an infinite canvas into fixed-height PDF pages", () => {
    const plan = createPdfExportPlan({
      blockId: "block-1",
      canvasWidth: 800,
      canvasHeight: 2500,
      pageHeight: 1000,
    });

    expect(plan.pages).toEqual([
      { index: 0, sourceX: 0, sourceY: 0, width: 800, height: 1000 },
      { index: 1, sourceX: 0, sourceY: 1000, width: 800, height: 1000 },
      { index: 2, sourceX: 0, sourceY: 2000, width: 800, height: 500 },
    ]);
  });

  it("rejects invalid page heights", () => {
    expect(() => createPdfExportPlan({
      blockId: "block-1",
      canvasWidth: 800,
      canvasHeight: 1200,
      pageHeight: 0,
    })).toThrow("pageHeight");
  });

  it("creates a PDF plan from sketch canvas dimensions", () => {
    const plan = createPdfExportPlanFromSketch("block-1", {
      version: 1,
      template: "blank",
      canvasWidth: 800,
      canvasHeight: 1200,
      strokes: [],
    });

    expect(plan.pages).toHaveLength(2);
    expect(plan.pages[0].height).toBe(1000);
    expect(plan.pages[1].height).toBe(200);
  });

  it("exposes an explicit not-implemented PDF renderer boundary", async () => {
    await expect(exportPdf(createPdfExportPlan({
      blockId: "block-1",
      canvasWidth: 800,
      canvasHeight: 1200,
      pageHeight: 1000,
    }))).rejects.toThrow("PDF rendering backend is not configured");
  });
});

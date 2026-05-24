import { describe, expect, it } from "vitest";
import {
  createExportPdfFileName,
  createPdfExportPlanFromSketch,
  createPdfExportPlan,
  exportPdf,
} from "./pdf";

const JPEG_1X1 = "/9j/4AAQSkZJRgABAQAAAQABAAD/2w==";

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

  it("uses explicit sketch pages when exporting paged documents", () => {
    const plan = createPdfExportPlanFromSketch("block-1", {
      version: 1,
      template: "blank",
      canvasWidth: 800,
      canvasHeight: 1800,
      pageMode: "paged",
      activePageId: "page-2",
      pages: [
        { id: "page-1", index: 0, x: 0, y: 0, width: 800, height: 900 },
        { id: "page-2", index: 1, x: 0, y: 900, width: 800, height: 900 },
      ],
      strokes: [],
    });

    expect(plan.pageHeight).toBe(900);
    expect(plan.pages).toEqual([
      { index: 0, sourceX: 0, sourceY: 0, width: 800, height: 900 },
      { index: 1, sourceX: 0, sourceY: 900, width: 800, height: 900 },
    ]);
  });

  it("keeps background export enabled by default", () => {
    const plan = createPdfExportPlan({
      blockId: "block-1",
      canvasWidth: 800,
      canvasHeight: 1000,
      pageHeight: 1000,
    });

    expect(plan.includeBackground).toBe(true);
  });

  it("can disable template background when planning PDF export", () => {
    const plan = createPdfExportPlan({
      blockId: "block-1",
      canvasWidth: 800,
      canvasHeight: 1000,
      pageHeight: 1000,
      includeBackground: false,
    });

    expect(plan.includeBackground).toBe(false);
  });

  it("exports planned pages into a PDF blob", async () => {
    const plan = createPdfExportPlan({
      blockId: "block-1",
      canvasWidth: 800,
      canvasHeight: 1200,
      pageHeight: 1000,
    });

    const blob = await exportPdf(plan, {
      pageImages: [
        `data:image/jpeg;base64,${JPEG_1X1}`,
        `data:image/jpeg;base64,${JPEG_1X1}`,
      ],
    });

    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(100);
    expect((await blob.text()).slice(0, 5)).toBe("%PDF-");
  });

  it("requires one rendered image per planned PDF page", async () => {
    await expect(exportPdf(createPdfExportPlan({
      blockId: "block-1",
      canvasWidth: 800,
      canvasHeight: 1200,
      pageHeight: 1000,
    }), {
      pageImages: [`data:image/jpeg;base64,${JPEG_1X1}`],
    })).rejects.toThrow("one rendered image per planned PDF page");
  });

  it("rejects unsupported page image formats", async () => {
    await expect(exportPdf(createPdfExportPlan({
      blockId: "block-1",
      canvasWidth: 800,
      canvasHeight: 1000,
      pageHeight: 1000,
    }), {
      pageImages: ["data:image/png;base64,QUJD"],
    })).rejects.toThrow("JPEG data URLs");
  });
});

import { describe, expect, it } from "vitest";
import {
  createOcrIndex,
  createPageAwareOcrIndex,
  searchOcrIndexes,
  searchOcrIndex,
} from "./ocrIndex";

describe("ocr index", () => {
  it("creates a normalized text index from OCR lines", () => {
    const index = createOcrIndex("block-1", [
      {
        text: "Meeting Action",
        confidence: 0.92,
        bounds: { x: 10, y: 20, width: 160, height: 32 },
      },
      {
        text: "预算 Review",
        confidence: 0.86,
        bounds: { x: 20, y: 70, width: 180, height: 32 },
      },
    ]);

    expect(index.blockId).toBe("block-1");
    expect(index.text).toBe("meeting action 预算 review");
    expect(index.lines).toHaveLength(2);
    expect(index.updatedAt).toBeGreaterThan(0);
  });

  it("searches OCR text case-insensitively and returns matching line bounds", () => {
    const index = createOcrIndex("block-1", [
      {
        text: "Weekly Plan",
        confidence: 0.9,
        bounds: { x: 10, y: 20, width: 120, height: 30 },
      },
    ], 1000);

    const results = searchOcrIndex(index, "plan");

    expect(results).toEqual([{
      blockId: "block-1",
      text: "Weekly Plan",
      bounds: { x: 10, y: 20, width: 120, height: 30 },
      confidence: 0.9,
    }]);
  });

  it("returns no matches for blank queries", () => {
    const index = createOcrIndex("block-1", [
      {
        text: "Weekly Plan",
        confidence: 0.9,
        bounds: { x: 10, y: 20, width: 120, height: 30 },
      },
    ]);

    expect(searchOcrIndex(index, "   ")).toEqual([]);
  });

  it("searches multiple OCR indexes and ignores indexes without matches", () => {
    const indexes = [
      createOcrIndex("block-1", [{
        text: "Project Plan",
        confidence: 0.95,
        bounds: { x: 10, y: 20, width: 100, height: 24 },
      }]),
      createOcrIndex("block-2", [{
        text: "Shopping List",
        confidence: 0.9,
        bounds: { x: 30, y: 40, width: 100, height: 24 },
      }]),
    ];

    expect(searchOcrIndexes(indexes, "plan")).toEqual([{
      blockId: "block-1",
      text: "Project Plan",
      bounds: { x: 10, y: 20, width: 100, height: 24 },
      confidence: 0.95,
    }]);
  });

  it("assigns OCR lines to sketch pages by bounds", () => {
    const index = createPageAwareOcrIndex("block-1", [
      {
        text: "First page task",
        confidence: 0.92,
        bounds: { x: 10, y: 120, width: 160, height: 32 },
      },
      {
        text: "Second page note",
        confidence: 0.88,
        bounds: { x: 20, y: 1120, width: 180, height: 32 },
      },
    ], {
      version: 1,
      template: "blank",
      canvasWidth: 800,
      canvasHeight: 2000,
      pageMode: "paged",
      pages: [
        { id: "page-1", index: 0, x: 0, y: 0, width: 800, height: 1000 },
        { id: "page-2", index: 1, x: 0, y: 1000, width: 800, height: 1000 },
      ],
      strokes: [],
    }, 1000);

    expect(index.lines.map((line) => ({
      text: line.text,
      pageId: line.pageId,
      pageNumber: line.pageNumber,
    }))).toEqual([
      { text: "First page task", pageId: "page-1", pageNumber: 1 },
      { text: "Second page note", pageId: "page-2", pageNumber: 2 },
    ]);
  });

  it("returns page metadata in OCR search results", () => {
    const index = createPageAwareOcrIndex("block-1", [
      {
        text: "Second page note",
        confidence: 0.88,
        bounds: { x: 20, y: 1120, width: 180, height: 32 },
      },
    ], {
      version: 1,
      template: "blank",
      canvasWidth: 800,
      canvasHeight: 2000,
      pageMode: "paged",
      pages: [
        { id: "page-1", index: 0, x: 0, y: 0, width: 800, height: 1000 },
        { id: "page-2", index: 1, x: 0, y: 1000, width: 800, height: 1000 },
      ],
      strokes: [],
    }, 1000);

    expect(searchOcrIndex(index, "note")).toEqual([{
      blockId: "block-1",
      text: "Second page note",
      bounds: { x: 20, y: 1120, width: 180, height: 32 },
      confidence: 0.88,
      pageId: "page-2",
      pageNumber: 2,
    }]);
  });
});

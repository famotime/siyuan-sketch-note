import { describe, expect, it } from "vitest";
import {
  createOcrIndex,
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
});

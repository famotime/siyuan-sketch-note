import { describe, expect, it } from "vitest";
import type { Stroke } from "@/types/sketch";
import {
  addSketchPage,
  createPageNavigator,
  createPagedSketchData,
  getSketchPages,
  removeSketchPage,
} from "./model";

const stroke = (id: string, y: number): Stroke => ({
  id,
  tool: "pen",
  color: "#111111",
  width: 4,
  opacity: 1,
  points: [
    { x: 10, y, pressure: 0.5, timestamp: 1 },
    { x: 120, y: y + 40, pressure: 0.5, timestamp: 2 },
  ],
});

describe("page model", () => {
  it("derives fixed pages from an infinite canvas without mutating strokes", () => {
    const pages = getSketchPages({
      version: 1,
      template: "blank",
      canvasWidth: 800,
      canvasHeight: 2300,
      strokes: [stroke("top", 120), stroke("bottom", 1900)],
    }, 1000);

    expect(pages).toEqual([
      { id: "page-1", index: 0, x: 0, y: 0, width: 800, height: 1000 },
      { id: "page-2", index: 1, x: 0, y: 1000, width: 800, height: 1000 },
      { id: "page-3", index: 2, x: 0, y: 2000, width: 800, height: 300 },
    ]);
  });

  it("creates a paged sketch document with an active first page", () => {
    const data = createPagedSketchData({
      template: "grid",
      canvasWidth: 800,
      pageHeight: 960,
    });

    expect(data.pageMode).toBe("paged");
    expect(data.activePageId).toBe("page-1");
    expect(data.canvasHeight).toBe(960);
    expect(data.pages).toEqual([
      { id: "page-1", index: 0, x: 0, y: 0, width: 800, height: 960 },
    ]);
  });

  it("adds pages below the current document and moves the active page", () => {
    const data = addSketchPage(createPagedSketchData({
      template: "blank",
      canvasWidth: 800,
      pageHeight: 1000,
    }));

    expect(data.activePageId).toBe("page-2");
    expect(data.canvasHeight).toBe(2000);
    expect(data.pages?.map((page) => ({ id: page.id, y: page.y }))).toEqual([
      { id: "page-1", y: 0 },
      { id: "page-2", y: 1000 },
    ]);
  });

  it("removes an empty page and reindexes the remaining page positions", () => {
    const twoPages = addSketchPage(createPagedSketchData({
      template: "blank",
      canvasWidth: 800,
      pageHeight: 1000,
    }));
    const next = removeSketchPage(twoPages, "page-1");

    expect(next.pages).toEqual([
      { id: "page-2", index: 0, x: 0, y: 0, width: 800, height: 1000 },
    ]);
    expect(next.activePageId).toBe("page-2");
    expect(next.canvasHeight).toBe(1000);
  });

  it("keeps the last page when removal would leave no editable page", () => {
    const data = createPagedSketchData({
      template: "blank",
      canvasWidth: 800,
      pageHeight: 1000,
    });

    expect(removeSketchPage(data, "page-1")).toBe(data);
  });

  it("blocks removing a page that still contains strokes", () => {
    const data = createPagedSketchData({
      template: "blank",
      canvasWidth: 800,
      pageHeight: 1000,
    });
    data.strokes = [stroke("kept", 120)];

    expect(() => removeSketchPage(data, "page-1")).toThrow("contains content");
  });

  it("navigates pages by id and clamps index movement", () => {
    const data = addSketchPage(addSketchPage(createPagedSketchData({
      template: "blank",
      canvasWidth: 800,
      pageHeight: 1000,
    })));

    expect(createPageNavigator(data).current?.id).toBe("page-3");
    expect(createPageNavigator(data).goToIndex(0).activePageId).toBe("page-1");
    expect(createPageNavigator(data).goToIndex(99).activePageId).toBe("page-3");
    expect(createPageNavigator(data).goToPrevious().activePageId).toBe("page-2");
    expect(createPageNavigator(data).goToNext().activePageId).toBe("page-3");
  });
});

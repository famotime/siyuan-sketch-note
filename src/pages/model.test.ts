import { describe, expect, it } from "vitest";
import { createTextElement } from "@/elements/text";
import type { Stroke } from "@/types/sketch";
import {
  addSketchPage,
  createPageNavigator,
  createPageOverviewItems,
  createPagedSketchData,
  duplicateSketchPage,
  getSketchPages,
  insertSketchPageAfter,
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

  it("creates page overview items with current and content state", () => {
    const data = addSketchPage(addSketchPage(createPagedSketchData({
      template: "blank",
      canvasWidth: 800,
      pageHeight: 1000,
    })));
    data.activePageId = "page-2";
    data.strokes = [
      stroke("first-page", 120),
      stroke("third-page", 2120),
    ];

    expect(createPageOverviewItems(data)).toEqual([
      {
        id: "page-1",
        pageNumber: 1,
        isActive: false,
        hasContent: true,
        y: 0,
        height: 1000,
      },
      {
        id: "page-2",
        pageNumber: 2,
        isActive: true,
        hasContent: false,
        y: 1000,
        height: 1000,
      },
      {
        id: "page-3",
        pageNumber: 3,
        isActive: false,
        hasContent: true,
        y: 2000,
        height: 1000,
      },
    ]);
  });

  it("marks pages with text or image elements as containing content", () => {
    const data = addSketchPage(createPagedSketchData({
      template: "blank",
      canvasWidth: 800,
      pageHeight: 1000,
    }));
    data.elements = [
      createTextElement("text-1", { x: 80, y: 1120, text: "note" }),
    ];

    expect(createPageOverviewItems(data).map((page) => page.hasContent)).toEqual([false, true]);
    expect(() => removeSketchPage(data, "page-2")).toThrow("contains content");
  });

  it("inserts a blank page after the active page and shifts following page content", () => {
    const data = addSketchPage(addSketchPage(createPagedSketchData({
      template: "blank",
      canvasWidth: 800,
      pageHeight: 1000,
    })));
    data.activePageId = "page-1";
    data.strokes = [stroke("third-page", 2120)];

    const next = insertSketchPageAfter(data, "page-1");

    expect(next.activePageId).toBe("page-4");
    expect(next.canvasHeight).toBe(4000);
    expect(next.pages?.map((page) => ({ id: page.id, index: page.index, y: page.y }))).toEqual([
      { id: "page-1", index: 0, y: 0 },
      { id: "page-4", index: 1, y: 1000 },
      { id: "page-2", index: 2, y: 2000 },
      { id: "page-3", index: 3, y: 3000 },
    ]);
    expect(next.strokes[0].points.map((point) => point.y)).toEqual([3120, 3160]);
  });

  it("shifts following elements when inserting a page", () => {
    const data = addSketchPage(addSketchPage(createPagedSketchData({
      template: "blank",
      canvasWidth: 800,
      pageHeight: 1000,
    })));
    data.elements = [
      createTextElement("text-1", { x: 80, y: 2120, text: "third page" }),
    ];

    const next = insertSketchPageAfter(data, "page-1");

    expect(next.elements?.[0].bounds.y).toBe(3120);
  });

  it("duplicates a page with its strokes shifted into the inserted copy", () => {
    const data = addSketchPage(createPagedSketchData({
      template: "blank",
      canvasWidth: 800,
      pageHeight: 1000,
    }));
    data.activePageId = "page-1";
    data.strokes = [
      stroke("first-page", 120),
      stroke("second-page", 1120),
    ];

    const next = duplicateSketchPage(data, "page-1", (id) => `copy-${id}`);

    expect(next.activePageId).toBe("page-3");
    expect(next.pages?.map((page) => ({ id: page.id, y: page.y }))).toEqual([
      { id: "page-1", y: 0 },
      { id: "page-3", y: 1000 },
      { id: "page-2", y: 2000 },
    ]);
    expect(next.strokes.map((item) => ({
      id: item.id,
      y: item.points[0].y,
    }))).toEqual([
      { id: "first-page", y: 120 },
      { id: "second-page", y: 2120 },
      { id: "copy-first-page", y: 1120 },
    ]);
  });

  it("duplicates text and image elements from the target page into the inserted copy", () => {
    const data = addSketchPage(createPagedSketchData({
      template: "blank",
      canvasWidth: 800,
      pageHeight: 1000,
    }));
    data.elements = [
      createTextElement("text-1", { x: 80, y: 120, text: "first page" }),
      createTextElement("text-2", { x: 80, y: 1120, text: "second page" }),
    ];

    const next = duplicateSketchPage(data, "page-1", (id) => `copy-${id}`);

    expect(next.elements?.map((element) => ({
      id: element.id,
      y: element.bounds.y,
      text: element.type === "text" ? element.text : undefined,
    }))).toEqual([
      { id: "text-1", y: 120, text: "first page" },
      { id: "text-2", y: 2120, text: "second page" },
      { id: "copy-text-1", y: 1120, text: "first page" },
    ]);
  });

  it("removes an empty middle page and shifts following content upward", () => {
    const data = addSketchPage(addSketchPage(createPagedSketchData({
      template: "blank",
      canvasWidth: 800,
      pageHeight: 1000,
    })));
    data.strokes = [stroke("third-page", 2120)];

    const next = removeSketchPage(data, "page-2");

    expect(next.canvasHeight).toBe(2000);
    expect(next.pages?.map((page) => ({ id: page.id, y: page.y }))).toEqual([
      { id: "page-1", y: 0 },
      { id: "page-3", y: 1000 },
    ]);
    expect(next.strokes[0].points.map((point) => point.y)).toEqual([1120, 1160]);
  });

  it("shifts following elements upward when removing an empty page", () => {
    const data = addSketchPage(addSketchPage(createPagedSketchData({
      template: "blank",
      canvasWidth: 800,
      pageHeight: 1000,
    })));
    data.elements = [
      createTextElement("text-1", { x: 80, y: 2120, text: "third page" }),
    ];

    const next = removeSketchPage(data, "page-2");

    expect(next.elements?.[0].bounds.y).toBe(1120);
  });
});

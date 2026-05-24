import { describe, expect, it } from "vitest";
import { createInsertElementPosition } from "./insertPosition";

describe("insert element position", () => {
  it("places inserted elements near the top of the active page in paged documents", () => {
    const position = createInsertElementPosition({
      canvasWidth: 800,
      pageMode: "paged",
      activePageId: "page-2",
      pages: [
        { id: "page-1", index: 0, x: 0, y: 0, width: 800, height: 1000 },
        { id: "page-2", index: 1, x: 0, y: 1000, width: 800, height: 1000 },
      ],
      elementWidth: 220,
      topOffset: 120,
    });

    expect(position).toEqual({ x: 290, y: 1120 });
  });

  it("falls back to the first page when the active page id is missing", () => {
    const position = createInsertElementPosition({
      canvasWidth: 800,
      pageMode: "paged",
      activePageId: "missing",
      pages: [
        { id: "page-1", index: 0, x: 0, y: 0, width: 800, height: 1000 },
      ],
      elementWidth: 320,
      topOffset: 140,
    });

    expect(position).toEqual({ x: 240, y: 140 });
  });

  it("keeps legacy infinite-canvas insertion near the canvas top", () => {
    const position = createInsertElementPosition({
      canvasWidth: 800,
      pageMode: "infinite",
      activePageId: undefined,
      pages: [],
      elementWidth: 220,
      topOffset: 120,
    });

    expect(position).toEqual({ x: 290, y: 120 });
  });
});

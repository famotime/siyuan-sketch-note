import { describe, expect, it } from "vitest";
import {
  buildSvgCursorUrl,
  getColorDotCursor,
  getBrushSizeCursor,
  getEraserCursor,
  resolveCanvasCursor,
} from "./cursor";

describe("cursor", () => {
  it("builds valid SVG data url with hotspot", () => {
    const url = buildSvgCursorUrl("<svg></svg>", 5, 5);
    expect(url).toContain('url("data:image/svg+xml,%3Csvg%3E%3C%2Fsvg%3E") 5 5, auto');
  });

  it("directly generates cursor SVG urls", () => {
    expect(getColorDotCursor("#ff0000")).toContain("%23ff0000");
    expect(getBrushSizeCursor(6, "#00ff00", 1)).toContain("%2300ff00");
    expect(decodeURIComponent(getEraserCursor(16, 1))).toContain("rgba(223, 76, 60");
  });

  it("resolves default crosshair for pen when style is crosshair", () => {
    const cursor = resolveCanvasCursor({
      tool: "pen",
      penCursorStyle: "crosshair",
    });
    expect(cursor).toBe("crosshair");
  });

  it("resolves crosshair for shapes and other tools regardless of penCursorStyle", () => {
    expect(resolveCanvasCursor({ tool: "rectangle", penCursorStyle: "colorDot" })).toBe("crosshair");
    expect(resolveCanvasCursor({ tool: "circle", penCursorStyle: "brushSize" })).toBe("crosshair");
    expect(resolveCanvasCursor({ tool: "lasso", penCursorStyle: "brushSize" })).toBe("crosshair");
  });

  it("resolves colorDot cursor with current pen color", () => {
    const cursor = resolveCanvasCursor({
      tool: "pen",
      penCursorStyle: "colorDot",
      toolPresets: {
        pen: { tool: "pen", color: "#e03131", width: 4, opacity: 1, mode: "ink" } as any,
      },
    });
    expect(cursor).toContain("url(");
    // #e03131 should be encoded as %23e03131
    expect(cursor).toContain("%23e03131");
  });

  it("resolves colorDot cursor with current highlighter color", () => {
    const cursor = resolveCanvasCursor({
      tool: "highlighter",
      penCursorStyle: "colorDot",
      toolPresets: {
        highlighter: { tool: "highlighter", color: "#fcc419", width: 14, opacity: 0.5, mode: "marker" } as any,
      },
    });
    expect(cursor).toContain("url(");
    expect(cursor).toContain("%23fcc419");
  });

  it("resolves brushSize cursor scaling with viewport zoom and clamped safely", () => {
    // Normal 1x zoom
    const cursor1x = resolveCanvasCursor({
      tool: "pen",
      penCursorStyle: "brushSize",
      viewportScale: 1,
      toolPresets: {
        pen: { tool: "pen", color: "#000000", width: 10, opacity: 1, mode: "ink" } as any,
      },
    });
    expect(cursor1x).toContain("url(");

    // 2x zoom: rawDiameter = 10 * 2 = 20
    const cursor2x = resolveCanvasCursor({
      tool: "pen",
      penCursorStyle: "brushSize",
      viewportScale: 2,
      toolPresets: {
        pen: { tool: "pen", color: "#000000", width: 10, opacity: 1, mode: "ink" } as any,
      },
    });
    expect(cursor2x).toContain("url(");
    // The diameter in SVG viewBox should be 20 + 2*3 = 26
    expect(decodeURIComponent(cursor2x)).toContain('width="26"');

    // Clamped min to 4px (viewBox size 4 + 6 = 10)
    const cursorTiny = resolveCanvasCursor({
      tool: "pen",
      penCursorStyle: "brushSize",
      viewportScale: 0.1,
      toolPresets: {
        pen: { tool: "pen", color: "#000000", width: 1, opacity: 1, mode: "ink" } as any,
      },
    });
    expect(decodeURIComponent(cursorTiny)).toContain('width="10"');

    // Clamped max to 128px (viewBox size 128 + 6 = 134)
    const cursorHuge = resolveCanvasCursor({
      tool: "pen",
      penCursorStyle: "brushSize",
      viewportScale: 10,
      toolPresets: {
        pen: { tool: "pen", color: "#000000", width: 30, opacity: 1, mode: "ink" } as any,
      },
    });
    expect(decodeURIComponent(cursorHuge)).toContain('width="134"');
  });

  it("resolves eraser cursor scaling with viewport zoom and clamped safely", () => {
    const eraserCursor1x = resolveCanvasCursor({
      tool: "eraser",
      viewportScale: 1,
      toolPresets: {
        eraser: { tool: "eraser", color: "#000000", width: 20, opacity: 1, mode: "pixel" } as any,
      },
    });
    expect(eraserCursor1x).toContain("url(");
    // 20 + 4 = 24
    expect(decodeURIComponent(eraserCursor1x)).toContain('width="24"');

    const eraserCursor2x = resolveCanvasCursor({
      tool: "eraser",
      viewportScale: 2,
      toolPresets: {
        eraser: { tool: "eraser", color: "#000000", width: 20, opacity: 1, mode: "pixel" } as any,
      },
    });
    // 40 + 4 = 44
    expect(decodeURIComponent(eraserCursor2x)).toContain('width="44"');
  });
});

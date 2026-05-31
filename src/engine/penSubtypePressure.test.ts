import { describe, it, expect } from "vitest";
import { getPenSubtypePressureWidth, getHighlighterSubtypeLineCap } from "./strokeSmoothing";

describe("getPenSubtypePressureWidth", () => {
  it("pencil: low sensitivity, range 0.7x-1.2x", () => {
    expect(getPenSubtypePressureWidth(10, 0, "pencil")).toBeCloseTo(7);
    expect(getPenSubtypePressureWidth(10, 0.5, "pencil")).toBeCloseTo(9.5);
    expect(getPenSubtypePressureWidth(10, 1, "pencil")).toBeCloseTo(12);
  });

  it("ballpoint: near-constant, range 0.9x-1.1x", () => {
    expect(getPenSubtypePressureWidth(10, 0, "ballpoint")).toBeCloseTo(9);
    expect(getPenSubtypePressureWidth(10, 0.5, "ballpoint")).toBeCloseTo(10);
    expect(getPenSubtypePressureWidth(10, 1, "ballpoint")).toBeCloseTo(11);
  });

  it("fountain: high sensitivity, range 0.5x-2.0x", () => {
    const low = getPenSubtypePressureWidth(10, 0, "fountain");
    const high = getPenSubtypePressureWidth(10, 1, "fountain");
    expect(low).toBeLessThan(6);
    expect(high).toBeGreaterThan(18);
  });

  it("brush: very high sensitivity, range 0.3x-2.5x", () => {
    const low = getPenSubtypePressureWidth(10, 0, "brush");
    const high = getPenSubtypePressureWidth(10, 1, "brush");
    expect(low).toBeLessThan(5);
    expect(high).toBeGreaterThan(20);
  });

  it("defaults to ballpoint for undefined subtype", () => {
    const result = getPenSubtypePressureWidth(10, 0.5, undefined);
    expect(result).toBeCloseTo(getPenSubtypePressureWidth(10, 0.5, "ballpoint"));
  });
});

describe("getHighlighterSubtypeLineCap", () => {
  it("round subtype returns 'round'", () => {
    expect(getHighlighterSubtypeLineCap("round")).toBe("round");
  });

  it("square subtype returns 'butt'", () => {
    expect(getHighlighterSubtypeLineCap("square")).toBe("butt");
  });

  it("watercolor subtype returns 'round'", () => {
    expect(getHighlighterSubtypeLineCap("watercolor")).toBe("round");
  });

  it("defaults to 'round' for undefined subtype", () => {
    expect(getHighlighterSubtypeLineCap(undefined)).toBe("round");
  });
});

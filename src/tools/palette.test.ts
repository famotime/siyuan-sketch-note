import { describe, expect, it } from "vitest";
import {
  addRecentColor,
  normalizeRecentColors,
  appendRecentColor,
  appendToolColor,
  normalizeToolColorPalettes,
  setFavoriteColorAt,
  deleteFavoriteColorAt,
  normalizeFavoriteColors,
} from "./palette";

describe("tool color palette", () => {
  it("normalizes recent colors with stable defaults", () => {
    expect(normalizeRecentColors(["#ABCDEF", "bad", "#abcdef", "#123456"]).slice(0, 6)).toEqual([
      "#abcdef",
      "#123456",
      "#000000",
      "#e74c3c",
      "#3498db",
      "#2ecc71",
    ]);
  });

  it("moves a selected color to the front and limits palette size", () => {
    const next = addRecentColor(
      ["#111111", "#222222", "#333333", "#444444", "#555555", "#666666", "#777777", "#888888", "#999999", "#aaaaaa"],
      "#ABCDEF",
    );

    expect(next).toHaveLength(10);
    expect(next[0]).toBe("#abcdef");
    expect(next.includes("#aaaaaa")).toBe(false); // 最旧的一个被挤掉了
  });

  it("appends a custom color to the end and limits palette size", () => {
    const next = appendRecentColor(
      ["#111111", "#222222", "#333333", "#444444", "#555555", "#666666", "#777777", "#888888", "#999999", "#aaaaaa"],
      "#ABCDEF",
    );

    expect(next).toHaveLength(10);
    expect(next[9]).toBe("#abcdef");
    expect(next.includes("#111111")).toBe(false); // 最前面的那个被挤掉了，推动现有颜色往前滚
  });

  it("keeps pen and highlighter palettes independent when appending colors", () => {
    const palettes = normalizeToolColorPalettes({
      pen: ["#111111"],
      highlighter: ["#fff176"],
    });

    const next = appendToolColor(palettes, "highlighter", "#ABCDEF");

    expect(next.pen).toEqual(palettes.pen);
    expect(next.highlighter).toContain("#abcdef");
    expect(next.pen).not.toContain("#abcdef");
  });

  it("sets a favorite color at the requested slot and keeps other slots in order", () => {
    const next = setFavoriteColorAt(["#111111", "#222222"], 3, "#ABCDEF");

    expect(next).toEqual(["#111111", "#222222", null, "#abcdef", null, null, null]);
  });

  it("deletes a favorite color at the requested slot without shifting other slots", () => {
    const next = deleteFavoriteColorAt(["#111111", "#222222", "#111111"], 0);

    expect(next).toEqual([null, "#222222", "#111111", null, null, null, null]);
  });

  it("normalizes favorite color slots as a fixed row with empty positions", () => {
    expect(normalizeFavoriteColors(["#ABCDEF", "bad", null, "#123456"])).toEqual([
      "#abcdef",
      null,
      null,
      "#123456",
      null,
      null,
      null,
    ]);
  });
});

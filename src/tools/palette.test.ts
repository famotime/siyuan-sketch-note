import { describe, expect, it } from "vitest";
import {
  addRecentColor,
  normalizeRecentColors,
  appendRecentColor,
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
});

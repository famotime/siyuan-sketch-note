import { describe, expect, it } from "vitest";
import {
  addRecentColor,
  normalizeRecentColors,
} from "./palette";

describe("tool color palette", () => {
  it("normalizes recent colors with stable defaults", () => {
    expect(normalizeRecentColors(["#ABCDEF", "bad", "#abcdef", "#123456"])).toEqual([
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
      ["#000000", "#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#8e44ad"],
      "#ABCDEF",
    );

    expect(next).toEqual([
      "#abcdef",
      "#000000",
      "#e74c3c",
      "#3498db",
      "#2ecc71",
      "#f39c12",
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { createCanvasPointConverter } from "./viewport";

describe("viewport coordinate conversion", () => {
  it("maps screen coordinates back to logical canvas coordinates after pan and zoom", () => {
    const toCanvasPoint = createCanvasPointConverter(() => ({
      left: 140,
      top: 80,
      scale: 2,
    }));

    expect(toCanvasPoint({ clientX: 180, clientY: 130 })).toEqual({
      x: 20,
      y: 25,
    });
  });
});

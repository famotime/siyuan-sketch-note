import { describe, expect, it } from "vitest";
import type { Stroke } from "@/types/sketch";
import {
  calculateStrokeBounds,
  migrateStrokesToElements,
} from "./model";

const stroke: Stroke = {
  id: "stroke-1",
  tool: "pen",
  color: "#000000",
  width: 10,
  opacity: 1,
  points: [
    { x: 10, y: 20, pressure: 0.5, timestamp: 1 },
    { x: 40, y: 50, pressure: 0.5, timestamp: 2 },
  ],
};

describe("element model", () => {
  it("calculates stroke bounds including half stroke width", () => {
    expect(calculateStrokeBounds(stroke)).toEqual({
      x: 5,
      y: 15,
      width: 40,
      height: 40,
    });
  });

  it("migrates legacy strokes into stroke elements without mutating strokes", () => {
    const elements = migrateStrokesToElements([stroke]);

    expect(elements).toEqual([{
      id: "stroke-1",
      type: "stroke",
      stroke: {
        ...stroke,
        bounds: {
          x: 5,
          y: 15,
          width: 40,
          height: 40,
        },
      },
      bounds: {
        x: 5,
        y: 15,
        width: 40,
        height: 40,
      },
      transform: {
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
      },
      zIndex: 0,
    }]);
  });
});

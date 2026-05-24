import { describe, expect, it } from "vitest";
import type { SketchElement } from "./model";
import {
  findElementsInBoxSelection,
  findElementsInLasso,
} from "./lasso";

const elements: SketchElement[] = [
  {
    id: "inside",
    type: "stroke",
    stroke: {
      id: "inside",
      tool: "pen",
      color: "#000000",
      width: 2,
      points: [
        { x: 10, y: 10, pressure: 0.5, timestamp: 1 },
        { x: 20, y: 20, pressure: 0.5, timestamp: 2 },
      ],
    },
    bounds: { x: 9, y: 9, width: 12, height: 12 },
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    zIndex: 0,
  },
  {
    id: "outside",
    type: "stroke",
    stroke: {
      id: "outside",
      tool: "pen",
      color: "#000000",
      width: 2,
      points: [
        { x: 80, y: 80, pressure: 0.5, timestamp: 1 },
        { x: 90, y: 90, pressure: 0.5, timestamp: 2 },
      ],
    },
    bounds: { x: 79, y: 79, width: 12, height: 12 },
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    zIndex: 1,
  },
];

describe("lasso selection", () => {
  it("selects elements whose center point is inside the lasso polygon", () => {
    const selected = findElementsInLasso(elements, [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 40 },
      { x: 0, y: 40 },
    ]);

    expect(selected.map((element) => element.id)).toEqual(["inside"]);
  });

  it("returns no elements for an incomplete lasso", () => {
    expect(findElementsInLasso(elements, [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
    ])).toEqual([]);
  });

  it("selects elements whose center point is inside a rectangular box", () => {
    const selected = findElementsInBoxSelection(elements, {
      x: 40,
      y: 40,
      width: -40,
      height: -40,
    });

    expect(selected.map((element) => element.id)).toEqual(["inside"]);
  });
});

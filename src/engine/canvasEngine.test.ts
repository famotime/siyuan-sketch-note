import { describe, expect, it } from "vitest";
import { createImageElement } from "@/elements/image";
import { createTextElement } from "@/elements/text";
import { moveElement } from "@/elements/transform";
import {
  createEngineState,
  fullRedrawStrokeCanvas,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  cancelCurrentStroke,
  pushHistorySnapshot,
  redo,
  undo,
} from "./canvasEngine";

describe("canvas engine history", () => {
  it("undoes and redoes element geometry changes", () => {
    const state = createEngineState("blank");
    const image = createImageElement("image-1", {
      x: 20,
      y: 30,
      src: "data:image/png;base64,AAA",
    });
    state.elements = [image];

    pushHistorySnapshot(state);
    state.elements = [moveElement(image, 40, 50)];

    expect(undo(state)).toBe(true);
    expect(state.elements[0].bounds).toMatchObject({ x: 20, y: 30 });

    expect(redo(state)).toBe(true);
    expect(state.elements[0].bounds).toMatchObject({ x: 60, y: 80 });
  });

  it("removes whole strokes when eraser preset uses stroke mode", () => {
    const state = createEngineState("blank");
    state.strokes = [
      {
        id: "stroke-1",
        tool: "pen",
        color: "#111111",
        width: 4,
        opacity: 1,
        points: [
          { x: 10, y: 10, pressure: 0.5, timestamp: 1 },
          { x: 100, y: 10, pressure: 0.5, timestamp: 2 },
        ],
      },
      {
        id: "stroke-2",
        tool: "pen",
        color: "#222222",
        width: 4,
        opacity: 1,
        points: [
          { x: 10, y: 100, pressure: 0.5, timestamp: 3 },
          { x: 100, y: 100, pressure: 0.5, timestamp: 4 },
        ],
      },
    ];
    state.tool = "eraser";
    state.toolPresets.eraser.mode = "stroke";
    state.currentStroke = {
      id: "eraser-1",
      tool: "eraser",
      color: "#000000",
      width: 20,
      opacity: 1,
      points: [
        { x: 40, y: 5, pressure: 0.5, timestamp: 5 },
        { x: 40, y: 15, pressure: 0.5, timestamp: 6 },
      ],
    };

    expect(handlePointerUp(state)).toBe(true);

    expect(state.strokes.map((stroke) => stroke.id)).toEqual(["stroke-2"]);
    expect(state.undoStack).toHaveLength(1);
    expect(state.currentStroke).toBeNull();
    expect(state.isDirty).toBe(true);
  });

  it("does not pixel-erase the live canvas while stroke eraser is drawing", () => {
    const state = createEngineState("blank");
    state.tool = "eraser";
    state.toolPresets.eraser.mode = "stroke";

    const operations: string[] = [];
    const canvas = {
      getBoundingClientRect: () => ({ left: 0, top: 0 }),
      getContext: () => ({
        save() { operations.push("save"); },
        restore() { operations.push("restore"); },
        beginPath() { operations.push("beginPath"); },
        moveTo() { operations.push("moveTo"); },
        lineTo() { operations.push("lineTo"); },
        stroke() { operations.push("stroke"); },
        get lineWidth() { return 1; },
        set lineWidth(_value: number) {},
        get lineJoin() { return ""; },
        set lineJoin(_value: string) {},
        get lineCap() { return ""; },
        set lineCap(_value: string) {},
        get globalAlpha() { return 1; },
        set globalAlpha(_value: number) {},
        get globalCompositeOperation() { return ""; },
        set globalCompositeOperation(value: string) { operations.push(`composite:${value}`); },
        get strokeStyle() { return ""; },
        set strokeStyle(_value: string) {},
      }),
    } as unknown as HTMLCanvasElement;

    handlePointerDown(state, {
      clientX: 10,
      clientY: 10,
      pressure: 0.5,
      timeStamp: 1,
    } as PointerEvent, canvas);
    handlePointerMove(state, {
      clientX: 40,
      clientY: 10,
      pressure: 0.5,
      timeStamp: 2,
    } as PointerEvent, canvas);

    expect(operations).not.toContain("composite:destination-out");
    expect(operations).not.toContain("stroke");
    expect(state.currentStroke?.points).toHaveLength(2);
  });

  it("stores precomputed bounds on completed freehand strokes", () => {
    const state = createEngineState("blank");
    const canvas = {
      getBoundingClientRect: () => ({ left: 0, top: 0 }),
      getContext: () => ({
        save() {},
        restore() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        stroke() {},
        get lineWidth() { return 1; },
        set lineWidth(_value: number) {},
        get lineJoin() { return ""; },
        set lineJoin(_value: string) {},
        get lineCap() { return ""; },
        set lineCap(_value: string) {},
        get globalAlpha() { return 1; },
        set globalAlpha(_value: number) {},
        get globalCompositeOperation() { return ""; },
        set globalCompositeOperation(_value: string) {},
        get strokeStyle() { return ""; },
        set strokeStyle(_value: string) {},
      }),
    } as unknown as HTMLCanvasElement;

    handlePointerDown(state, {
      clientX: 10,
      clientY: 20,
      pressure: 0.5,
      timeStamp: 1,
    } as PointerEvent, canvas);
    handlePointerMove(state, {
      clientX: 40,
      clientY: 50,
      pressure: 0.5,
      timeStamp: 2,
    } as PointerEvent, canvas);
    handlePointerUp(state);

    expect(state.strokes[0].bounds).toEqual({
      x: 8.5,
      y: 18.5,
      width: 33,
      height: 33,
    });
  });

  it("can hide selected elements while redrawing the live canvas", () => {
    const state = createEngineState("blank");
    state.elements = [
      createTextElement("text-1", { x: 10, y: 20, text: "hidden" }),
      createTextElement("text-2", { x: 10, y: 60, text: "visible" }),
    ];
    const operations: Array<{ type: string; args: unknown[] }> = [];
    const canvas = {
      width: 800,
      height: 1200,
      getContext: () => ({
        save() {},
        restore() {},
        setTransform() {},
        clearRect() {},
        fillText: (...args: unknown[]) => operations.push({ type: "fillText", args }),
        get fillStyle() { return ""; },
        set fillStyle(_value: string) {},
        get font() { return ""; },
        set font(_value: string) {},
        get textBaseline() { return ""; },
        set textBaseline(_value: string) {},
      }),
    } as unknown as HTMLCanvasElement;

    fullRedrawStrokeCanvas(canvas, state, {
      hiddenElementIds: new Set(["text-1"]),
    });

    expect(operations).toEqual([
      { type: "fillText", args: ["visible", 10, 60, 220] },
    ]);
  });
});

describe("canvas engine current stroke cancellation", () => {
  it("clears an in-progress stroke without committing it to history", () => {
    const state = createEngineState("blank");
    state.currentStroke = {
      id: "draft-stroke",
      tool: "pen",
      color: "#111111",
      width: 4,
      opacity: 1,
      points: [
        { x: 10, y: 20, pressure: 0.5, timestamp: 1 },
        { x: 30, y: 40, pressure: 0.5, timestamp: 2 },
      ],
    };

    expect(cancelCurrentStroke(state)).toBe(true);

    expect(state.currentStroke).toBeNull();
    expect(state.strokes).toEqual([]);
    expect(state.undoStack).toEqual([]);
    expect(state.isDirty).toBe(false);
  });
});

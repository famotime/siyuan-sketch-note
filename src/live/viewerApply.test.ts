import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/engine/canvasEngine", () => ({
  restoreEngineState: vi.fn((data) => ({
    strokes: [...data.strokes],
    elements: data.elements ?? [],
    canvasWidth: data.canvasWidth,
    canvasHeight: data.canvasHeight,
    templateId: data.template,
  })),
  setupStrokeCanvas: vi.fn(),
  fullRedrawStrokeCanvas: vi.fn(),
}));

vi.mock("@/engine/strokeRenderer", () => ({
  renderStroke: vi.fn(),
}));

import { createViewerRenderer, applySnapshot, applyEvent } from "./viewerApply";
import { renderStroke } from "@/engine/strokeRenderer";
import type { SketchData } from "@/types/sketch";
import type { StrokeReplayEvent, EraseReplayEvent, ShapeReplayEvent } from "@/recorder/types";

function makeMockCanvas(): HTMLCanvasElement {
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: vi.fn(),
    setTransform: vi.fn(),
  } as any;
  const canvas = {
    width: 800,
    height: 1200,
    style: { width: "", height: "" },
    getContext: () => ctx,
  } as any;
  return canvas as HTMLCanvasElement;
}

function makeSketchData(strokes: any[] = []): SketchData {
  return {
    version: 1,
    template: "blank",
    canvasWidth: 800,
    canvasHeight: 1200,
    strokes,
    elements: [],
  };
}

describe("createViewerRenderer", () => {
  it("创建渲染器实例", () => {
    const canvas = makeMockCanvas();
    const renderer = createViewerRenderer(canvas);
    expect(renderer).toBeDefined();
    expect(renderer.canvas).toBe(canvas);
  });
});

describe("applySnapshot", () => {
  it("从 SketchData 恢复 strokes", () => {
    const canvas = makeMockCanvas();
    const renderer = createViewerRenderer(canvas);
    const data = makeSketchData([
      { id: "s1", points: [{ x: 0, y: 0, pressure: 0.5, timestamp: 1 }], color: "#000", width: 2, tool: "pen" },
    ]);
    applySnapshot(renderer, data);
    expect(renderer.state.strokes).toHaveLength(1);
    expect(renderer.state.strokes[0].id).toBe("s1");
  });
});

describe("applyEvent", () => {
  it("stroke 事件添加笔画到 state 并渲染", () => {
    const canvas = makeMockCanvas();
    const renderer = createViewerRenderer(canvas);
    const event: StrokeReplayEvent = {
      type: "stroke",
      id: "re-1",
      timestamp: 1000,
      stroke: { id: "s1", points: [{ x: 10, y: 20, pressure: 0.5, timestamp: 1 }, { x: 30, y: 40, pressure: 0.5, timestamp: 2 }], color: "#000", width: 2, tool: "pen" },
    };
    applyEvent(renderer, event);
    expect(renderer.state.strokes).toHaveLength(1);
    expect(renderStroke).toHaveBeenCalled();
  });

  it("erase 事件移除对应笔画并重绘", () => {
    const canvas = makeMockCanvas();
    const renderer = createViewerRenderer(canvas);
    renderer.state.strokes = [
      { id: "s1", points: [{ x: 0, y: 0, pressure: 0.5, timestamp: 1 }], color: "#000", width: 2, tool: "pen" },
      { id: "s2", points: [{ x: 10, y: 10, pressure: 0.5, timestamp: 1 }], color: "#f00", width: 3, tool: "pen" },
    ];
    const event: EraseReplayEvent = {
      type: "erase",
      id: "re-2",
      timestamp: 2000,
      erasedIds: ["s1"],
    };
    applyEvent(renderer, event);
    expect(renderer.state.strokes).toHaveLength(1);
    expect(renderer.state.strokes[0].id).toBe("s2");
  });

  it("shape 事件添加图形笔画", () => {
    const canvas = makeMockCanvas();
    const renderer = createViewerRenderer(canvas);
    const event: ShapeReplayEvent = {
      type: "shape",
      id: "re-3",
      timestamp: 3000,
      stroke: { id: "shape-1", points: [{ x: 0, y: 0, pressure: 0.5, timestamp: 1 }, { x: 100, y: 100, pressure: 0.5, timestamp: 2 }], color: "#000", width: 2, tool: "pen", isShape: true },
    };
    applyEvent(renderer, event);
    expect(renderer.state.strokes).toHaveLength(1);
    expect(renderer.state.strokes[0].isShape).toBe(true);
  });
});

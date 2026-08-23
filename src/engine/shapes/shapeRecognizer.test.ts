import { describe, it, expect } from "vitest";
import { recognizeDrawnShape, douglasPeucker } from "./shapeRecognizer";
import type { StrokePoint } from "@/types/sketch";

function makePoint(x: number, y: number): StrokePoint {
  return { x, y, pressure: 0.5, timestamp: Date.now() };
}

describe("shapeRecognizer", () => {
  it("recognizes straight line with high confidence", () => {
    const linePoints: StrokePoint[] = [];
    for (let i = 0; i <= 20; i++) {
      linePoints.push(makePoint(i * 10, i * 10 + (Math.sin(i) * 0.5))); // 微小手抖
    }

    const recognized = recognizeDrawnShape(linePoints);
    expect(recognized).not.toBeNull();
    expect(recognized?.type).toBe("line");
    expect(recognized?.confidence).toBeGreaterThan(0.9);
  });

  it("recognizes rough circle as ellipse", () => {
    const circlePoints: StrokePoint[] = [];
    const cx = 100, cy = 100, r = 50;
    const count = 36;
    for (let i = 0; i <= count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const noise = (Math.sin(i * 3) * 2); // 模拟手抖
      circlePoints.push(makePoint(cx + (r + noise) * Math.cos(angle), cy + (r + noise) * Math.sin(angle)));
    }

    const recognized = recognizeDrawnShape(circlePoints);
    expect(recognized).not.toBeNull();
    expect(recognized?.type).toBe("ellipse");
    expect(recognized?.points.length).toBeGreaterThan(10);
  });

  it("simplifies curve corners using douglasPeucker", () => {
    const points: StrokePoint[] = [
      makePoint(0, 0),
      makePoint(25, 1),
      makePoint(50, 0),
      makePoint(50, 50),
      makePoint(0, 50),
      makePoint(0, 0),
    ];

    const simplified = douglasPeucker(points, 5);
    expect(simplified.length).toBeLessThanOrEqual(points.length);
  });
});

import { describe, it, expect, vi } from "vitest";
import { StationaryDetector } from "./stationaryDetector";
import type { StrokePoint } from "@/types/sketch";

function makePoint(x: number, y: number, timeOffset: number): StrokePoint {
  return { x, y, pressure: 0.5, timestamp: 1000 + timeOffset };
}

describe("StationaryDetector", () => {
  it("triggers callback when pointer stays stationary beyond hold time", () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const detector = new StationaryDetector({ holdTimeMs: 300, maxMoveTolerance: 10, maxSpeed: 0.05 }, callback);

    detector.update(makePoint(100, 100, 0));
    detector.update(makePoint(102, 101, 100));
    detector.update(makePoint(101, 102, 200));

    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(350);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(detector.getTriggered()).toBe(true);

    vi.useRealTimers();
  });

  it("resets timer when pointer moves significantly", () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const detector = new StationaryDetector({ holdTimeMs: 300, maxMoveTolerance: 10, maxSpeed: 0.05 }, callback);

    detector.update(makePoint(100, 100, 0));
    vi.advanceTimersByTime(200);

    // 大跨度移动
    detector.update(makePoint(150, 150, 250));
    vi.advanceTimersByTime(200); // 距离上次大移动只有 200ms，未达 300ms

    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(150); // 现在达到 350ms
    expect(callback).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});

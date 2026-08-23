import { describe, it, expect } from "vitest";
import { extractPointerPoints } from "./inputEvents";

describe("extractPointerPoints", () => {
  const coordConverter = (clientX: number, clientY: number) => ({
    x: clientX * 2,
    y: clientY * 2,
  });

  it("should extract single point when getCoalescedEvents is unavailable", () => {
    const fakeEvent = {
      clientX: 10,
      clientY: 20,
      pressure: 0.8,
      tiltX: 5,
      tiltY: 10,
      timeStamp: 1000,
    } as unknown as PointerEvent;

    const res = extractPointerPoints(fakeEvent, coordConverter, true);
    expect(res.realPoints).toHaveLength(1);
    expect(res.realPoints[0]).toEqual({
      x: 20,
      y: 40,
      pressure: 0.8,
      tiltX: 5,
      tiltY: 10,
      timeStamp: 1000,
      isPredicted: false,
    });
    expect(res.predictedPoints).toHaveLength(0);
  });

  it("should extract multiple points from getCoalescedEvents when available", () => {
    const coalesced1 = { clientX: 10, clientY: 20, pressure: 0.3, timeStamp: 1001 } as PointerEvent;
    const coalesced2 = { clientX: 12, clientY: 22, pressure: 0.4, timeStamp: 1002 } as PointerEvent;
    const coalesced3 = { clientX: 15, clientY: 25, pressure: 0.5, timeStamp: 1003 } as PointerEvent;

    const fakeEvent = {
      clientX: 15,
      clientY: 25,
      pressure: 0.5,
      timeStamp: 1003,
      getCoalescedEvents: () => [coalesced1, coalesced2, coalesced3],
    } as unknown as PointerEvent;

    const res = extractPointerPoints(fakeEvent, coordConverter, true);
    expect(res.realPoints).toHaveLength(3);
    expect(res.realPoints[0].x).toBe(20);
    expect(res.realPoints[1].x).toBe(24);
    expect(res.realPoints[2].x).toBe(30);
    expect(res.realPoints[1].pressure).toBe(0.4);
  });

  it("should extract predicted points when getPredictedEvents is available", () => {
    const pred1 = { clientX: 18, clientY: 28, pressure: 0.6, timeStamp: 1005 } as PointerEvent;
    const pred2 = { clientX: 20, clientY: 30, pressure: 0.6, timeStamp: 1007 } as PointerEvent;

    const fakeEvent = {
      clientX: 15,
      clientY: 25,
      pressure: 0.5,
      timeStamp: 1003,
      getPredictedEvents: () => [pred1, pred2],
    } as unknown as PointerEvent;

    const res = extractPointerPoints(fakeEvent, coordConverter, true);
    expect(res.realPoints).toHaveLength(1);
    expect(res.predictedPoints).toHaveLength(2);
    expect(res.predictedPoints[0].x).toBe(36);
    expect(res.predictedPoints[0].isPredicted).toBe(true);
    expect(res.predictedPoints[1].x).toBe(40);
  });

  it("should fallback pressure to 0.5 when enablePressure is false", () => {
    const fakeEvent = {
      clientX: 10,
      clientY: 20,
      pressure: 0.9,
      timeStamp: 1000,
    } as unknown as PointerEvent;

    const res = extractPointerPoints(fakeEvent, coordConverter, false);
    expect(res.realPoints[0].pressure).toBe(0.5);
  });
});

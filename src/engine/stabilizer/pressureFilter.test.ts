import { describe, it, expect } from "vitest";
import { PressureFilter } from "./pressureFilter";

describe("PressureFilter", () => {
  it("should initialize with first pressure value without lag", () => {
    const filter = new PressureFilter(0.3);
    expect(filter.filter(0.8)).toBe(0.8);
    expect(filter.getCurrent()).toBe(0.8);
  });

  it("should smooth pressure steps gradually", () => {
    const filter = new PressureFilter(0.5);
    filter.filter(0.2); // 0.2
    const step1 = filter.filter(1.0); // 0.2 + 0.5 * (1.0 - 0.2) = 0.6
    expect(step1).toBeCloseTo(0.6);
    const step2 = filter.filter(1.0); // 0.6 + 0.5 * (1.0 - 0.6) = 0.8
    expect(step2).toBeCloseTo(0.8);
  });

  it("should clamp abnormal input pressure between 0 and 1", () => {
    const filter = new PressureFilter();
    expect(filter.filter(-0.5)).toBe(0);
    filter.reset();
    expect(filter.filter(1.5)).toBe(1);
  });

  it("should reset internal state cleanly", () => {
    const filter = new PressureFilter();
    filter.filter(0.9);
    filter.reset();
    expect(filter.filter(0.1)).toBe(0.1);
  });
});

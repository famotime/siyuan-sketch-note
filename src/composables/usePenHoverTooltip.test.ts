// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isHoverablePointerEvent,
  extractTooltipInfo,
  calculateTooltipPosition,
  createPenHoverTooltipManager,
  resetSharedTooltipElementForTest,
} from "./usePenHoverTooltip";

describe("usePenHoverTooltip", () => {
  describe("isHoverablePointerEvent", () => {
    it("recognizes mouse events as hoverable", () => {
      expect(isHoverablePointerEvent({ pointerType: "mouse", buttons: 0 })).toBe(true);
      expect(isHoverablePointerEvent({ pointerType: "mouse", buttons: 1 })).toBe(true);
    });

    it("recognizes stylus/pen hover when buttons === 0 or undefined", () => {
      expect(isHoverablePointerEvent({ pointerType: "pen", buttons: 0 })).toBe(true);
      expect(isHoverablePointerEvent({ pointerType: "pen", buttons: undefined })).toBe(true);
    });

    it("rejects stylus/pen when pressed (buttons > 0, e.g. drawing or clicking)", () => {
      expect(isHoverablePointerEvent({ pointerType: "pen", buttons: 1 })).toBe(false);
      expect(isHoverablePointerEvent({ pointerType: "pen", buttons: 2 })).toBe(false);
    });

    it("rejects touch events", () => {
      expect(isHoverablePointerEvent({ pointerType: "touch", buttons: 0 })).toBe(false);
      expect(isHoverablePointerEvent({ pointerType: "touch", buttons: 1 })).toBe(false);
    });

    it("rejects undefined or invalid pointer type", () => {
      expect(isHoverablePointerEvent({})).toBe(false);
    });
  });

  describe("extractTooltipInfo", () => {
    it("extracts from data-tooltip first", () => {
      const el = document.createElement("button");
      el.setAttribute("data-tooltip", "Custom Tip");
      el.setAttribute("title", "Native Title");
      el.setAttribute("aria-label", "Aria Label");

      const info = extractTooltipInfo(el);
      expect(info).toEqual({ element: el, text: "Custom Tip" });
    });

    it("extracts from title when data-tooltip is not present", () => {
      const el = document.createElement("button");
      el.setAttribute("title", "Native Title");
      el.setAttribute("aria-label", "Aria Label");

      const info = extractTooltipInfo(el);
      expect(info).toEqual({ element: el, text: "Native Title" });
    });

    it("extracts from data-sketch-orig-title if title was temporarily backed up", () => {
      const el = document.createElement("button");
      el.setAttribute("data-sketch-orig-title", "Original Title");

      const info = extractTooltipInfo(el);
      expect(info).toEqual({ element: el, text: "Original Title" });
    });

    it("extracts from aria-label on interactive button element", () => {
      const el = document.createElement("button");
      el.setAttribute("aria-label", "Action Button");

      const info = extractTooltipInfo(el);
      expect(info).toEqual({ element: el, text: "Action Button" });
    });

    it("climbs up DOM tree to find interactive parent with tooltip", () => {
      const parent = document.createElement("button");
      parent.setAttribute("title", "Parent Action");

      const icon = document.createElement("span");
      parent.appendChild(icon);

      const info = extractTooltipInfo(icon);
      expect(info).toEqual({ element: parent, text: "Parent Action" });
    });

    it("returns null when no tooltip attributes exist", () => {
      const div = document.createElement("div");
      expect(extractTooltipInfo(div)).toBeNull();
    });
  });

  describe("calculateTooltipPosition", () => {
    it("places tooltip below target centered horizontally", () => {
      const targetRect = {
        left: 100,
        top: 50,
        right: 140,
        bottom: 90,
        width: 40,
        height: 40,
      };

      const pos = calculateTooltipPosition({
        targetRect,
        tooltipRect: { width: 60, height: 24 },
        viewportWidth: 1000,
        viewportHeight: 800,
        gap: 6,
        padding: 8,
      });

      // Target center is 100 + 20 = 120. Tooltip width 60, left = 120 - 30 = 90.
      expect(pos.left).toBe(90);
      // Below target: 90 + 6 = 96.
      expect(pos.top).toBe(96);
    });

    it("clamps left position to avoid overflowing right viewport edge", () => {
      const targetRect = {
        left: 960,
        top: 50,
        right: 1000,
        bottom: 90,
        width: 40,
        height: 40,
      };

      const pos = calculateTooltipPosition({
        targetRect,
        tooltipRect: { width: 100, height: 24 },
        viewportWidth: 1000,
        viewportHeight: 800,
        gap: 6,
        padding: 10,
      });

      // Max left is 1000 - 100 - 10 = 890.
      expect(pos.left).toBe(890);
    });

    it("clamps left position to avoid overflowing left viewport edge", () => {
      const targetRect = {
        left: 0,
        top: 50,
        right: 20,
        bottom: 90,
        width: 20,
        height: 40,
      };

      const pos = calculateTooltipPosition({
        targetRect,
        tooltipRect: { width: 80, height: 24 },
        viewportWidth: 1000,
        viewportHeight: 800,
        gap: 6,
        padding: 12,
      });

      expect(pos.left).toBe(12);
    });

    it("flips tooltip to top when overflowing bottom viewport edge", () => {
      const targetRect = {
        left: 200,
        top: 750,
        right: 240,
        bottom: 790,
        width: 40,
        height: 40,
      };

      const pos = calculateTooltipPosition({
        targetRect,
        tooltipRect: { width: 60, height: 30 },
        viewportWidth: 1000,
        viewportHeight: 800,
        gap: 6,
        padding: 8,
      });

      // Below would be 790 + 6 + 30 = 826 > 800 - 8 (792).
      // Placed above: 750 - 30 - 6 = 714.
      expect(pos.top).toBe(714);
    });
  });

  describe("usePenHoverTooltip DOM integration", () => {
    let container: HTMLDivElement;
    let button: HTMLButtonElement;

    beforeEach(() => {
      vi.useFakeTimers();
      container = document.createElement("div");
      button = document.createElement("button");
      button.setAttribute("title", "Test Tooltip");
      container.appendChild(button);
      document.body.appendChild(container);
    });

    afterEach(() => {
      vi.clearAllTimers();
      vi.useRealTimers();
      resetSharedTooltipElementForTest();
      document.body.innerHTML = "";
    });

    it("shows and hides tooltip via pen hover events", () => {
      const manager = createPenHoverTooltipManager(() => container, { delayMs: 100 });
      manager.attach();

      // Dispatch pointerover on button with pen
      const penOverEvent = new Event("pointerover", { bubbles: true }) as any;
      penOverEvent.pointerType = "pen";
      penOverEvent.buttons = 0;

      button.dispatchEvent(penOverEvent);

      // Verify title was temporarily backed up to avoid native tooltip
      expect(button.getAttribute("data-sketch-orig-title")).toBe("Test Tooltip");
      expect(button.hasAttribute("title")).toBe(false);

      // Advance timers
      vi.advanceTimersByTime(100);

      // Tooltip should be in document and visible
      const tooltipEl = document.querySelector(".sketch-pen-tooltip") as HTMLDivElement;
      expect(tooltipEl).not.toBeNull();
      expect(tooltipEl.textContent).toBe("Test Tooltip");
      expect(tooltipEl.classList.contains("sketch-pen-tooltip--visible")).toBe(true);

      // Simulate pointerdown (drawing/clicking) -> should immediately hide and restore title
      manager.hide();
      expect(tooltipEl.classList.contains("sketch-pen-tooltip--visible")).toBe(false);
      expect(button.getAttribute("title")).toBe("Test Tooltip");

      manager.detach();
    });

    it("does not show tooltip on touch events", () => {
      const manager = createPenHoverTooltipManager(() => container, { delayMs: 100 });
      manager.attach();

      const touchEvent = new Event("pointerover", { bubbles: true }) as any;
      touchEvent.pointerType = "touch";
      touchEvent.buttons = 0;

      button.dispatchEvent(touchEvent);
      vi.advanceTimersByTime(100);

      const tooltipEl = document.querySelector(".sketch-pen-tooltip") as HTMLDivElement | null;
      expect(tooltipEl).toBeNull();
      expect(button.getAttribute("title")).toBe("Test Tooltip");

      manager.detach();
    });
  });
});

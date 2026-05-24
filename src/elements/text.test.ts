import { describe, expect, it } from "vitest";
import {
  createTextElement,
  updateTextElement,
} from "./text";

describe("text elements", () => {
  it("creates a text element with predictable bounds and style", () => {
    const element = createTextElement("text-1", {
      x: 40,
      y: 50,
      text: "Meeting notes",
    });

    expect(element).toMatchObject({
      id: "text-1",
      type: "text",
      text: "Meeting notes",
      bounds: {
        x: 40,
        y: 50,
        width: 220,
        height: 80,
      },
      style: {
        color: "#000000",
        fontSize: 18,
      },
    });
  });

  it("updates text content without mutating the original element", () => {
    const element = createTextElement("text-1", {
      x: 0,
      y: 0,
      text: "Draft",
    });
    const updated = updateTextElement(element, {
      text: "Final",
      fontSize: 24,
    });

    expect(updated.text).toBe("Final");
    expect(updated.style.fontSize).toBe(24);
    expect(element.text).toBe("Draft");
    expect(element.style.fontSize).toBe(18);
  });

  it("updates text font family without mutating the original style", () => {
    const element = createTextElement("text-1", {
      x: 0,
      y: 0,
      text: "Title",
      style: {
        fontFamily: "serif",
      },
    });

    const updated = updateTextElement(element, {
      fontFamily: "monospace",
    });

    expect(updated.style.fontFamily).toBe("monospace");
    expect(element.style.fontFamily).toBe("serif");
  });
});

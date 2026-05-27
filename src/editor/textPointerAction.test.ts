import { describe, expect, it } from "vitest";
import { createTextElement } from "@/elements/text";
import { hasTextPointerDrag, resolveTextPointerAction } from "./textPointerAction";

describe("resolveTextPointerAction", () => {
  it("edits the existing text element when the pointer is inside its bounds", () => {
    const element = createTextElement("text-1", {
      x: 40,
      y: 60,
      text: "hello",
      width: 180,
      height: 36,
    });

    expect(resolveTextPointerAction([element], 80, 72)).toEqual({
      type: "edit",
      element,
    });
  });

  it("creates a new text element when the pointer does not hit existing text", () => {
    const element = createTextElement("text-1", {
      x: 40,
      y: 60,
      text: "hello",
      width: 180,
      height: 36,
    });

    expect(resolveTextPointerAction([element], 12, 24)).toEqual({
      type: "create",
      x: 12,
      y: 24,
    });
  });
});

describe("hasTextPointerDrag", () => {
  it("treats movement under the drag threshold as a click", () => {
    expect(hasTextPointerDrag({ x: 20, y: 30 }, { x: 22, y: 32 })).toBe(false);
  });

  it("treats movement at the drag threshold as a drag", () => {
    expect(hasTextPointerDrag({ x: 20, y: 30 }, { x: 24, y: 30 })).toBe(true);
  });
});

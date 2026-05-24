import { describe, expect, it } from "vitest";
import {
  createDefaultInputSettings,
  normalizeInputSettings,
  shouldDrawFromPointer,
} from "./inputMode";

function pointer(pointerType: string): PointerEvent {
  return { pointerType } as PointerEvent;
}

describe("editor input mode", () => {
  it("allows pen, touch, and mouse drawing by default", () => {
    const settings = createDefaultInputSettings();

    expect(shouldDrawFromPointer(pointer("pen"), settings)).toBe(true);
    expect(shouldDrawFromPointer(pointer("touch"), settings)).toBe(true);
    expect(shouldDrawFromPointer(pointer("mouse"), settings)).toBe(true);
  });

  it("blocks touch drawing when stylus-only mode is enabled", () => {
    const settings = normalizeInputSettings({ stylusOnly: true });

    expect(shouldDrawFromPointer(pointer("pen"), settings)).toBe(true);
    expect(shouldDrawFromPointer(pointer("mouse"), settings)).toBe(true);
    expect(shouldDrawFromPointer(pointer("touch"), settings)).toBe(false);
  });

  it("normalizes missing saved input settings", () => {
    expect(normalizeInputSettings()).toEqual({
      stylusOnly: false,
      enablePressure: true,
    });
  });
});

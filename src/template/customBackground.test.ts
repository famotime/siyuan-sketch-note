import { describe, expect, it } from "vitest";
import {
  createCustomBackgroundTemplate,
  getCustomBackgroundSource,
  isCustomBackgroundTemplateId,
} from "./customBackground";

describe("custom background templates", () => {
  it("creates stable custom background template ids", () => {
    expect(createCustomBackgroundTemplate("bg-1", "data:image/png;base64,AAA")).toEqual({
      id: "custom:bg-1",
      nameKey: "templateCustomBackground",
      src: "data:image/png;base64,AAA",
      fit: "cover",
    });
  });

  it("detects custom background template ids", () => {
    expect(isCustomBackgroundTemplateId("custom:bg-1")).toBe(true);
    expect(isCustomBackgroundTemplateId("grid")).toBe(false);
  });

  it("resolves custom background source from sketch data", () => {
    expect(getCustomBackgroundSource({
      version: 1,
      template: "custom:bg-1",
      canvasWidth: 800,
      canvasHeight: 1200,
      customBackgrounds: [
        createCustomBackgroundTemplate("bg-1", "data:image/png;base64,AAA"),
      ],
      strokes: [],
    })).toBe("data:image/png;base64,AAA");
  });

  it("returns null when active template is not a matching custom background", () => {
    expect(getCustomBackgroundSource({
      version: 1,
      template: "grid",
      canvasWidth: 800,
      canvasHeight: 1200,
      customBackgrounds: [
        createCustomBackgroundTemplate("bg-1", "data:image/png;base64,AAA"),
      ],
      strokes: [],
    })).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  createCustomBackgroundTemplate,
  getCustomBackgroundDrawRect,
  getCustomBackgroundTemplate,
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

  it("resolves the active custom background template", () => {
    const background = createCustomBackgroundTemplate("bg-1", "data:image/png;base64,AAA", "contain");

    expect(getCustomBackgroundTemplate({
      version: 1,
      template: "custom:bg-1",
      canvasWidth: 800,
      canvasHeight: 1200,
      customBackgrounds: [background],
      strokes: [],
    })).toEqual(background);
  });

  it("stretches custom backgrounds to the target page", () => {
    expect(getCustomBackgroundDrawRect({
      imageWidth: 400,
      imageHeight: 200,
      targetWidth: 800,
      targetHeight: 1200,
      fit: "stretch",
    })).toEqual({
      sx: 0,
      sy: 0,
      sw: 400,
      sh: 200,
      dx: 0,
      dy: 0,
      dw: 800,
      dh: 1200,
    });
  });

  it("contains custom backgrounds without cropping", () => {
    expect(getCustomBackgroundDrawRect({
      imageWidth: 400,
      imageHeight: 200,
      targetWidth: 800,
      targetHeight: 1200,
      fit: "contain",
    })).toEqual({
      sx: 0,
      sy: 0,
      sw: 400,
      sh: 200,
      dx: 0,
      dy: 400,
      dw: 800,
      dh: 400,
    });
  });

  it("covers the target page by cropping the image center", () => {
    const rect = getCustomBackgroundDrawRect({
      imageWidth: 400,
      imageHeight: 200,
      targetWidth: 800,
      targetHeight: 1200,
      fit: "cover",
    });

    expect(rect).toMatchObject({
      dx: 0,
      dy: 0,
      dw: 800,
      dh: 1200,
    });
    expect(rect.sx).toBeCloseTo(133.33333333333331);
    expect(rect.sy).toBe(0);
    expect(rect.sw).toBeCloseTo(133.33333333333334);
    expect(rect.sh).toBe(200);
  });
});

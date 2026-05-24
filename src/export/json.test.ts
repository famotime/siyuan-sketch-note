import { describe, expect, it } from "vitest";
import {
  createExportJsonFileName,
  exportSketchJson,
  importSketchJson,
} from "./json";

describe("json export helpers", () => {
  it("creates a stable json backup file name from block id and timestamp", () => {
    expect(createExportJsonFileName("20260524123456-abc", new Date("2026-05-24T07:08:09Z"))).toBe(
      "sketch-note-20260524123456-abc-20260524-070809.json",
    );
  });

  it("exports sketch data as formatted application/json", async () => {
    const blob = exportSketchJson({
      version: 1,
      template: "blank",
      canvasWidth: 800,
      canvasHeight: 1200,
      strokes: [],
      elements: [],
    });

    expect(blob.type).toBe("application/json");
    expect(JSON.parse(await blob.text())).toMatchObject({
      version: 1,
      template: "blank",
      canvasWidth: 800,
      canvasHeight: 1200,
      strokes: [],
      elements: [],
    });
  });

  it("imports valid sketch json text", () => {
    const data = importSketchJson(JSON.stringify({
      version: 1,
      template: "grid",
      canvasWidth: 800,
      canvasHeight: 1200,
      strokes: [],
    }));

    expect(data).toMatchObject({
      version: 1,
      template: "grid",
      canvasWidth: 800,
      canvasHeight: 1200,
      strokes: [],
    });
  });

  it("rejects invalid sketch json text", () => {
    expect(() => importSketchJson("{")).toThrow("Invalid sketch JSON");
    expect(() => importSketchJson(JSON.stringify({
      version: 2,
      template: "blank",
      canvasWidth: 800,
      canvasHeight: 1200,
      strokes: [],
    }))).toThrow("Unsupported sketch JSON");
  });
});

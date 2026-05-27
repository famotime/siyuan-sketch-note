import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("editor save and OCR wiring", () => {
  it("passes save dirty-state controls into OCR search", () => {
    const editor = readFileSync(resolve(process.cwd(), "src/editor/SketchEditor.vue"), "utf8");

    expect(editor).toMatch(/const\s+\{[^}]*markDirty[^}]*scheduleAutoSave[^}]*\}\s*=\s*useSaveManager/s);
    expect(editor).toMatch(/useOcrSearch\(\{[^}]*markDirty,\s*scheduleAutoSave/s);
  });

  it("shares the OCR index with the save manager", () => {
    const editor = readFileSync(resolve(process.cwd(), "src/editor/SketchEditor.vue"), "utf8");

    expect(editor).toMatch(/const\s+ocrIndex\s*=\s*ref<SketchData\["ocrIndex"\]>/);
    expect(editor).toMatch(/useSaveManager\(\{[^}]*ocrIndex,\s*t,/s);
    expect(editor).toMatch(/useOcrSearch\(\{[^}]*ocrIndex,/s);
    expect(editor).not.toContain("ocrIndex: ref(undefined)");
  });
});

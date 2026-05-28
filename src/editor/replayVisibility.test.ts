import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("replay canvas visibility wiring", () => {
  it("hides the live SketchCanvas through an element wrapper in replay mode", () => {
    const editor = readFileSync(resolve(process.cwd(), "src/editor/SketchEditor.vue"), "utf8");

    expect(editor).toContain('class="sketch-live-canvas-wrap"');
    expect(editor).toContain('v-show="!isReplayMode"');
    const sketchCanvasTagStart = editor.indexOf("<SketchCanvas");
    const sketchCanvasTagEnd = editor.indexOf(">", sketchCanvasTagStart);
    const sketchCanvasOpeningTag = editor.slice(sketchCanvasTagStart, sketchCanvasTagEnd);
    expect(sketchCanvasOpeningTag).not.toContain('v-show="!isReplayMode"');
  });
});

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

  it("keeps the floating toolbar visible in replay as a read-only operation indicator", () => {
    const editor = readFileSync(resolve(process.cwd(), "src/editor/SketchEditor.vue"), "utf8");
    const floatingToolbar = readFileSync(resolve(process.cwd(), "src/editor/FloatingToolbar.vue"), "utf8");

    expect(editor).toContain('v-if="!isZenMode"');
    expect(editor).not.toContain('v-if="!isZenMode && !isReplayMode"');
    expect(editor).toContain(':replayActive="isReplayMode"');
    expect(floatingToolbar).toContain("replayActive?: boolean");
    expect(floatingToolbar).toContain("sketch-float-panel--replay");
    expect(floatingToolbar).toContain("sketch-float-panel--replay-click");
    expect(floatingToolbar).toContain(":data-tool=\"shape.tool\"");
    expect(editor).toContain("recordFloatingToolbarAction");
  });
});

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

  it("keeps the floating toolbar visible in replay when tool-switch playback is enabled", () => {
    const editor = readFileSync(resolve(process.cwd(), "src/editor/SketchEditor.vue"), "utf8");
    const floatingToolbar = readFileSync(resolve(process.cwd(), "src/editor/FloatingToolbar.vue"), "utf8");

    expect(editor).toContain('v-if="showFloatingToolbar"');
    expect(editor).not.toContain('v-if="!isZenMode && !isReplayMode"');
    expect(editor).toContain(':replayActive="isReplayMode"');
    expect(editor).toContain('const showFloatingToolbar = computed');
    expect(floatingToolbar).toContain("replayActive?: boolean");
    expect(floatingToolbar).toContain("sketch-float-panel--replay");
    expect(floatingToolbar).toContain("sketch-float-panel--replay-click");
    expect(editor).toContain("recordFloatingToolbarAction");
  });

  it("hides the floating toolbar in replay when tool-switch playback is disabled", () => {
    const editor = readFileSync(resolve(process.cwd(), "src/editor/SketchEditor.vue"), "utf8");

    expect(editor).toContain("replayToolSwitchPlaybackEnabled");
    expect(editor).toContain("props.replayRecordConfig");
    expect(editor).toContain("toolSwitch");
    expect(editor).toContain("!isReplayMode.value || replayToolSwitchPlaybackEnabled.value");
  });

  it("keeps the replay canvas origin aligned on narrow screens", () => {
    const editor = readFileSync(resolve(process.cwd(), "src/editor/SketchEditor.vue"), "utf8");

    const replayWrapRule = editor.match(/\.sketch-replay-canvas-wrap\s*\{[^}]*\}/)?.[0] ?? "";
    expect(replayWrapRule).toContain("overflow: auto");
    expect(replayWrapRule).toContain("height: 100%");
    expect(replayWrapRule).not.toContain("justify-content: center");
    expect(editor).toContain('ref="replayCanvasWrapRef"');
    expect(editor).toContain("scrollReplayCanvasToActivePage");
  });

  it("keeps replay controls within the mobile viewport", () => {
    const editor = readFileSync(resolve(process.cwd(), "src/editor/SketchEditor.vue"), "utf8");
    const controls = readFileSync(resolve(process.cwd(), "src/editor/ReplayControls.vue"), "utf8");

    const replayBarRule = editor.match(/\.sketch-replay-bar\s*\{[^}]*\}/)?.[0] ?? "";
    expect(replayBarRule).toContain("max-width: calc(100vw - 24px)");
    expect(replayBarRule).toContain("box-sizing: border-box");
    expect(controls).toContain("min-width: 0");
    expect(controls).toContain("@media (max-width: 520px)");
  });
});

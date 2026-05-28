import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("plugin settings UI", () => {
  it("places recording before replay and separates their responsibilities", () => {
    const index = readFileSync(resolve(process.cwd(), "src/index.ts"), "utf8");
    const zh = readFileSync(resolve(process.cwd(), "src/i18n/zh_CN.json"), "utf8");
    const recordingIndex = index.indexOf("this.i18n?.replayRecording ??");
    const replayIndex = index.indexOf("this.i18n?.replayRecord ??");

    expect(recordingIndex).toBeGreaterThan(-1);
    expect(replayIndex).toBeGreaterThan(recordingIndex);
    expect(zh).toContain('"replayRecord": "回放"');
    expect(zh).toContain("开启后保存所有操作记录");
    expect(zh).toContain("控制是否显示回放入口");
  });

  it("uses one recording switch and one grouped image playback switch", () => {
    const index = readFileSync(resolve(process.cwd(), "src/index.ts"), "utf8");

    expect(index).toContain("replayPlaybackEnabled");
    expect(index).toContain("replayRecordingEnabled");
    expect(index).toContain("setImageReplayEnabled");
    expect(index).toContain("syncReplayChildrenDisabled");
    expect(index).toContain("replayChildSwitches");
    expect(index).toContain("sketch-note-settings--replay-group-start");
    expect(index).toContain("sketch-note-settings--replay-group-end");
    expect(index).not.toContain('"imageTransform", "imageDelete"');
  });

  it("adds compact replay setting classes for tighter option spacing", () => {
    const indexScss = readFileSync(resolve(process.cwd(), "src/index.scss"), "utf8");

    expect(indexScss).toContain(".sketch-note-settings--recording");
    expect(indexScss).toContain(".sketch-note-settings--replay");
    expect(indexScss).toContain(".sketch-note-settings--compact");
    expect(indexScss).toContain(".sketch-note-settings--replay-child");
    expect(indexScss).toContain(".sketch-note-settings--disabled");
    expect(indexScss).toContain(".sketch-note-settings--replay-group-start");
    expect(indexScss).toContain(".sketch-note-settings--replay-group-end");
    expect(indexScss).toContain("pointer-events: none");
    expect(indexScss).toMatch(/\.sketch-note-settings--compact[\s\S]*?border-top:\s*0/);
  });
});

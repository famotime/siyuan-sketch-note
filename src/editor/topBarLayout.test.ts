import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("editor top bar layout", () => {
  it("keeps the more menu popover outside the horizontally scrollable toolbar row", () => {
    const topBar = readFileSync(resolve(process.cwd(), "src/editor/EditorTopBar.vue"), "utf8");
    const editor = readFileSync(resolve(process.cwd(), "src/editor/SketchEditor.vue"), "utf8");

    expect(topBar).toContain("sketch-editor__row--topbar");
    expect(editor).toMatch(/\.sketch-editor__row--topbar\s*\{[^}]*overflow:\s*visible/s);
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("editor top bar layout", () => {
  it("keeps the more menu popover outside the horizontally scrollable toolbar row", () => {
    const topBar = readFileSync(resolve(process.cwd(), "src/editor/EditorTopBar.vue"), "utf8");
    const editor = readFileSync(resolve(process.cwd(), "src/editor/SketchEditor.vue"), "utf8");

    expect(topBar).toContain("sketch-editor__row--topbar");
    expect(editor).toMatch(/\.sketch-editor__row--topbar\s*\{[^}]*overflow:\s*visible/);
  });

  it("keeps the two header rows compact", () => {
    const topBar = readFileSync(resolve(process.cwd(), "src/editor/EditorTopBar.vue"), "utf8");
    const toolbar = readFileSync(resolve(process.cwd(), "src/editor/ToolBar.vue"), "utf8");
    const editor = readFileSync(resolve(process.cwd(), "src/editor/SketchEditor.vue"), "utf8");

    expect(editor).toMatch(/--sketch-editor-header-height:\s*92px/);
    expect(editor).toMatch(/\.sketch-editor__header\s*\{[^}]*padding:\s*6px 14px/);
    expect(editor).toMatch(/\.sketch-editor__header\s*\{[^}]*gap:\s*2px/);
    expect(editor).toMatch(/\.sketch-editor__row--tools\s*\{[^}]*margin-top:\s*4px;[^}]*padding-top:\s*4px/);
    expect(topBar).toMatch(/\.sketch-editor__row\s*\{[^}]*min-height:\s*36px/);
    expect(toolbar).toMatch(/\.sketch-btn--tool\s*\{[^}]*min-height:\s*30px/);
  });

  it("positions the zoom indicator below the compact header", () => {
    const canvas = readFileSync(resolve(process.cwd(), "src/editor/SketchCanvas.vue"), "utf8");
    const editor = readFileSync(resolve(process.cwd(), "src/editor/SketchEditor.vue"), "utf8");

    expect(editor).toMatch(/--sketch-editor-header-top:\s*12px/);
    expect(editor).toMatch(/--sketch-editor-header-height:\s*92px/);
    expect(editor).toMatch(/--sketch-editor-floating-gap:\s*16px/);
    expect(canvas).toMatch(
      /top:\s*calc\(var\(--sketch-editor-header-top,\s*12px\) \+ var\(--sketch-editor-header-height,\s*92px\) \+ var\(--sketch-editor-floating-gap,\s*16px\)\)/,
    );
  });

  it("keeps the zoom lock icon visible on the dark indicator", () => {
    const canvas = readFileSync(resolve(process.cwd(), "src/editor/SketchCanvas.vue"), "utf8");

    expect(canvas).toMatch(/\.zoom-indicator__lock\s*\{[^}]*color:\s*#fff/);
  });

  it("keeps the zoom indicator sized to its content", () => {
    const canvas = readFileSync(resolve(process.cwd(), "src/editor/SketchCanvas.vue"), "utf8");

    expect(canvas).toMatch(/\.zoom-indicator\s*\{[^}]*width:\s*max-content;[^}]*padding:\s*5px 8px/);
    expect(canvas).toMatch(/\.zoom-indicator__value\s*\{[^}]*min-width:\s*4ch/);
    expect(canvas).toMatch(/\.zoom-indicator__lock\s*\{[^}]*width:\s*24px;[^}]*height:\s*24px;[^}]*padding:\s*0/);
  });
});

it("keeps active tool highlight visible while the button is hovered", () => {
  const toolbar = readFileSync(resolve(process.cwd(), "src/editor/ToolBar.vue"), "utf8");
  const editor = readFileSync(resolve(process.cwd(), "src/editor/SketchEditor.vue"), "utf8");

  const activeHoverRule = /\.sketch-btn--tool\.sketch-btn--tool-active:hover\s*\{[^}]*background:\s*var\(--b3-theme-primary\)\s*!important/;

  expect(toolbar).toMatch(activeHoverRule);
  expect(editor).toMatch(activeHoverRule);
});

it("adapts top and floating toolbars to SiYuan light and dark themes", () => {
  const editor = readFileSync(resolve(process.cwd(), "src/editor/SketchEditor.vue"), "utf8");
  const toolbar = readFileSync(resolve(process.cwd(), "src/editor/ToolBar.vue"), "utf8");
  const floatingToolbar = readFileSync(resolve(process.cwd(), "src/editor/FloatingToolbar.vue"), "utf8");

  expect(editor).toMatch(/color-scheme:\s*light dark/);
  expect(editor).toMatch(/--sketch-toolbar-surface-dark:/);
  expect(editor).toMatch(/--sketch-toolbar-surface-light:/);
  expect(editor).toMatch(/@media\s*\(prefers-color-scheme:\s*light\)/);
  expect(editor).toMatch(/\.sketch-editor--theme-light\s*\{/);
  expect(editor).toMatch(/\.sketch-editor--theme-dark\s*\{/);

  expect(floatingToolbar).toContain("var(--sketch-toolbar-surface)");

  for (const source of [toolbar, floatingToolbar]) {
    expect(source).toContain("var(--sketch-toolbar-control-bg)");
    expect(source).toContain("var(--sketch-toolbar-text)");
    expect(source).toContain("var(--sketch-toolbar-hover-bg)");
  }
});



it("uses the SiYuan runtime appearance mode for toolbar theme classes", () => {
  const app = readFileSync(resolve(process.cwd(), "src/App.vue"), "utf8");
  const editor = readFileSync(resolve(process.cwd(), "src/editor/SketchEditor.vue"), "utf8");

  expect(app).toContain("resolveSiyuanThemeMode");
  expect(app).toContain("MutationObserver");
  expect(app).toContain(':themeMode="themeMode"');
  expect(editor).toContain("themeMode: 'light' | 'dark'");
  expect(editor).toContain("sketch-editor--theme-light");
  expect(editor).toContain("sketch-editor--theme-dark");
});

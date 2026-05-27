import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("editor top bar layout", () => {
  it("keeps undo redo and clear grouped on the left before the spacer", () => {
    const topBar = readFileSync(resolve(process.cwd(), "src/editor/EditorTopBar.vue"), "utf8");

    const undoIndex = topBar.indexOf(":title=\"t('undo')\"");
    const redoIndex = topBar.indexOf(":title=\"t('redo')\"");
    const clearIndex = topBar.indexOf(":title=\"t('clear')\"");
    const spacerIndex = topBar.indexOf("sketch-spacer");

    expect(undoIndex).toBeGreaterThan(-1);
    expect(redoIndex).toBeGreaterThan(undoIndex);
    expect(clearIndex).toBeGreaterThan(redoIndex);
    expect(clearIndex).toBeLessThan(spacerIndex);
  });

  it("adds a plus image import button immediately before zen mode", () => {
    const topBar = readFileSync(resolve(process.cwd(), "src/editor/EditorTopBar.vue"), "utf8");
    const editor = readFileSync(resolve(process.cwd(), "src/editor/SketchEditor.vue"), "utf8");

    const insertIndex = topBar.indexOf("$emit('insertImage')");
    const zenIndex = topBar.indexOf("$emit('toggleZenMode')");

    expect(insertIndex).toBeGreaterThan(-1);
    expect(insertIndex).toBeLessThan(zenIndex);
    expect(topBar).toContain("sketch-btn--add-image");
    expect(topBar).toContain("<IconParkIcon name=\"Plus\" />");
    expect(editor).toContain("@insertImage=\"triggerImageImport\"");
  });

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
  const activeTextRule = /\.sketch-btn--tool-active,[\s\S]*?\.sketch-btn--tool\.sketch-btn--tool-active:hover\s*\{[^}]*color:\s*var\(--sketch-toolbar-active-text\)\s*!important/;

  expect(toolbar).toMatch(activeHoverRule);
  expect(editor).toMatch(activeHoverRule);
  expect(toolbar).toMatch(activeTextRule);
  expect(editor).toMatch(activeTextRule);
});

it("keeps active tool icons white in light theme", () => {
  const editor = readFileSync(resolve(process.cwd(), "src/editor/SketchEditor.vue"), "utf8");

  const explicitLightIndex = editor.lastIndexOf(".sketch-editor--theme-light");
  expect(explicitLightIndex).toBeGreaterThan(-1);
  expect(editor.slice(explicitLightIndex)).toContain("--sketch-toolbar-active-text: #fff");
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
  expect(editor).toContain(".sketch-editor--theme-dark");

  expect(floatingToolbar).toContain("var(--sketch-toolbar-surface)");

  for (const source of [toolbar, floatingToolbar]) {
    expect(source).toContain("var(--sketch-toolbar-control-bg)");
    expect(source).toContain("var(--sketch-toolbar-text)");
    expect(source).toContain("var(--sketch-toolbar-hover-bg)");
  }
});

it("lets explicit dark theme override light media and document theme rules", () => {
  const editor = readFileSync(resolve(process.cwd(), "src/editor/SketchEditor.vue"), "utf8");
  const mediaLightIndex = editor.indexOf("@media (prefers-color-scheme: light)");
  const explicitDarkIndex = editor.indexOf(".sketch-editor--theme-dark");

  expect(mediaLightIndex).toBeGreaterThan(-1);
  expect(explicitDarkIndex).toBeGreaterThan(mediaLightIndex);
  expect(editor.slice(explicitDarkIndex)).toContain("--sketch-toolbar-text: rgba(255, 255, 255, 0.8)");
  expect(editor.slice(explicitDarkIndex)).toContain("--sketch-toolbar-border: rgba(255, 255, 255, 0.12)");
});

it("lets explicit light theme override stale dark document theme rules", () => {
  const editor = readFileSync(resolve(process.cwd(), "src/editor/SketchEditor.vue"), "utf8");
  const globalDarkIndex = editor.indexOf(":global(html[data-theme=\"dark\"]) .sketch-editor");
  const explicitLightIndex = editor.lastIndexOf(".sketch-editor--theme-light");

  expect(globalDarkIndex).toBeGreaterThan(-1);
  expect(explicitLightIndex).toBeGreaterThan(globalDarkIndex);
  expect(editor.slice(explicitLightIndex)).toContain("--sketch-toolbar-text: rgba(15, 23, 42, 0.78)");
  expect(editor.slice(explicitLightIndex)).toContain("--sketch-toolbar-border: rgba(15, 23, 42, 0.1)");
});



it("uses the SiYuan runtime appearance mode for toolbar theme classes", () => {
  const app = readFileSync(resolve(process.cwd(), "src/App.vue"), "utf8");
  const editor = readFileSync(resolve(process.cwd(), "src/editor/SketchEditor.vue"), "utf8");
  const composable = readFileSync(resolve(process.cwd(), "src/composables/useThemeDetection.ts"), "utf8");

  expect(app).toContain("resolveSiyuanThemeMode");
  expect(app).toContain("MutationObserver");
  expect(app).toContain("themeSyncTimer");
  expect(app).toContain("window.setInterval(syncThemeMode");
  expect(app).toContain("resolveDocumentThemeMode");
  expect(app).toContain("resolveSiyuanConfigThemeMode");
  expect(app).toContain("resolveCssVariableThemeMode");
  expect(app).toContain('getPropertyValue("--b3-theme-background")');
  expect(app).toContain("resolveComputedBackgroundThemeMode");
  expect(app).toContain("document.body).backgroundColor");
  expect(app).toContain("getColorLuminance");
  expect(app).toContain("logThemeDiagnostics");
  expect(app).toContain('createLogger("Theme")');
  expect(app).toContain(':themeMode="themeMode"');
  expect(editor).toContain("themeMode: 'light' | 'dark'");
  expect(editor).toContain("effectiveThemeMode");
  expect(editor).toContain("useThemeDetection");
  expect(composable).toContain("resolveEditorBackgroundThemeMode");
  expect(composable).toContain("propThemeMode");
  expect(editor).toContain("sketch-editor--theme-light");
  expect(editor).toContain("sketch-editor--theme-dark");
});

it("renders a visible hue spectrum and the custom eyedropper icon in the color picker", () => {
  const colorPicker = readFileSync(resolve(process.cwd(), "src/editor/ColorPickerPopup.vue"), "utf8");

  expect(colorPicker).toContain("sketch-color-popup__hue::-webkit-slider-runnable-track");
  expect(colorPicker).toContain("linear-gradient(90deg, #ff0000");
  expect(colorPicker).toContain("sketch-color-popup__eyedropper-icon");
  expect(colorPicker).toContain("M13.432 2.569");
});

it("closes floating color popups from captured pointer events outside the picker", () => {
  const floatingToolbar = readFileSync(resolve(process.cwd(), "src/editor/FloatingToolbar.vue"), "utf8");

  expect(floatingToolbar).toContain("closeFloatingPopoversOnOutsidePointerDown");
  expect(floatingToolbar).toContain('document.addEventListener("pointerdown", closeFloatingPopoversOnOutsidePointerDown, true)');
  expect(floatingToolbar).toContain('document.removeEventListener("pointerdown", closeFloatingPopoversOnOutsidePointerDown, true)');
});

it("logs applied editor theme variables for runtime diagnosis", () => {
  const composable = readFileSync(resolve(process.cwd(), "src/composables/useThemeDetection.ts"), "utf8");
  const editor = readFileSync(resolve(process.cwd(), "src/editor/SketchEditor.vue"), "utf8");

  expect(composable).toContain("watch(");
  expect(composable).toContain("logEditorThemeDiagnostics");
  expect(composable).toContain("getComputedStyle");
  expect(editor).toContain("--sketch-toolbar-surface");
  expect(editor).toContain("useThemeDetection");
});

it("declares scroll-blocking wheel and touch listeners explicitly", () => {
  const editor = readFileSync(resolve(process.cwd(), "src/editor/SketchEditor.vue"), "utf8");
  const floatingToolbar = readFileSync(resolve(process.cwd(), "src/editor/FloatingToolbar.vue"), "utf8");
  const colorPicker = readFileSync(resolve(process.cwd(), "src/editor/ColorPickerPopup.vue"), "utf8");

  expect(editor).not.toContain('@wheel="onBodyWheel"');
  expect(editor).not.toContain('@touchstart="onZenToggleDragStart"');
  expect(editor).toContain('addEventListener("wheel", onBodyWheel, { passive: false })');
  expect(editor).toContain('addEventListener("touchstart", onZenToggleDragStart, { passive: false })');

  expect(floatingToolbar).not.toContain('@touchstart="onDragStart"');
  expect(floatingToolbar).toContain('addEventListener("touchstart", onDragStart, { passive: false })');

  expect(colorPicker).not.toContain('@touchstart.prevent="onSpectrumPointerStart"');
  expect(colorPicker).toContain('addEventListener("touchstart", onSpectrumPointerStart, { passive: false })');
});

it("uses image transform handles instead of lasso group handles for a single selected image", () => {
  const canvas = readFileSync(resolve(process.cwd(), "src/editor/SketchCanvas.vue"), "utf8");

  const lassoActionIndex = canvas.indexOf("resolveElementTransformAction(");

  expect(lassoActionIndex).toBeGreaterThan(-1);
  expect(canvas).toContain("if (bounds && !getSingleSelectedImage())");
  expect(canvas).not.toContain("isPointInLassoRotationHandle");
  expect(canvas).not.toContain("LASSO_ROTATION_HANDLE");
});

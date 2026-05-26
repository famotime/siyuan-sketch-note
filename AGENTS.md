# Repository Guidelines

## Project Structure & Module Organization

This repository is a SiYuan Note plugin (闲笔) built with Vite, Vue 3, and TypeScript. It provides a vector handwriting editor using HTML5 Canvas.

Core plugin code lives in `src/`: `index.ts` exports the `SketchNotePlugin` class (SiYuan Plugin SDK lifecycle), `main.ts` handles Vue app mount/unmount and API bridge, `App.vue` manages editor visibility and theme detection. Key modules:

- `composables/` — Vue 3 composables extracted from editor components: `useThemeDetection` (shared theme resolution), `useSaveManager`, `useColorPalettes`, `useOcrSearch`, `useExportManager`, `useEditorPreferences`, `useZenMode`, `useViewport`, `useTextEditing`
- `editor/` — Vue editor components: `SketchEditor.vue` (orchestrator, ~1000 lines), `SketchCanvas.vue` (canvas surface, ~1040 lines), `EditorTopBar.vue`, `ToolBar.vue`, `FloatingToolbar.vue`, `ToolOptionsPopover.vue`, plus `shortcuts.ts`, `clipboard.ts`, `inputMode.ts`
- `elements/` — Element model system: `SketchElement` discriminated union (StrokeElement | ShapeElement | TextElement | ImageElement), `model.ts` exports `defaultTransform()`, lasso hit-testing and edit operations, transform, render ordering
- `engine/` — Canvas rendering engine: `canvasEngine.ts` (state machine, pointer events, undo/redo, `clearImageCache()`), `strokeSmoothing.ts` (point filtering, Bézier curves)
- `storage/` — Data persistence via SiYuan plugin storage API, migration/recovery, thumbnail generation, save queue
- `template/` — 9 built-in page templates + custom background support
- `export/` — PNG/PDF/JSON export (uses shared `pad()` from `utils/date.ts`)
- `pages/` — Multi-page model
- `search/` — OCR provider interface (pluggable) and text indexing
- `tools/` — Tool presets and recent colors palette
- `utils/` — Shared utilities: `date.ts` (date formatting `pad()`), `uploadPng.ts` (SiYuan asset upload)
- `types/` — Shared TypeScript types (`SketchData`, `Stroke`, `SketchTool`, etc.)
- `i18n/` — Locale JSON files (en_US, zh_CN)

Root files: `plugin.json` (metadata), `icon.png`, `preview.png` (marketplace assets), `release.js` (version bump + tag script). `developer_docs/` stores SiYuan API references, `plugin-sample-vite-vue/` is an upstream sample. Do not edit generated `dist/` or `package.zip` by hand.

## Build, Test, and Development Commands

Use `pnpm install` to install dependencies from `pnpm-lock.yaml`.

- `pnpm dev`: runs `vite build --watch` for plugin development (outputs to SiYuan workspace via `.env` config)
- `pnpm build`: creates a production build in `dist/` + `package.zip`
- `pnpm test`: runs Vitest unit tests
- `npx vitest run src/path/to/file.test.ts`: run a single test file
- `npx eslint src/`: check code conventions
- `pnpm release`: interactive version bump, git tag, and push
- `pnpm release:patch|minor|major`: auto-bump the corresponding version

Before submitting changes, run `pnpm test` and `pnpm build`.

## Coding Style & Naming Conventions

Follow `.editorconfig`: UTF-8, spaces, 2-space indentation, final newline, and trimmed trailing whitespace except Markdown and declaration files. TypeScript and Vue style is governed by `eslint.config.mjs`, based on `@antfu/eslint-config`. Prefer single quotes, multiline object properties, trailing commas in multiline structures, and Vue SFC block order of `template`, `script`, then `style`. Each Vue attribute on its own line (`vue/max-attributes-per-line: 1`). Name Vue components in PascalCase, modules in camelCase, and keep locale keys aligned across `src/i18n/en_US.json` and `src/i18n/zh_CN.json`.

## Testing Guidelines

Vitest is the test framework. Test files are colocated with source using the `.test.ts` suffix (not `.spec.ts`). Run `pnpm test` for the full suite or `npx vitest run src/path/to/file.test.ts` for a single file.

For UI/editor changes that cannot be unit-tested, verify manually in SiYuan: insert a sketch block, draw, erase, undo/redo, save, reopen, and confirm thumbnail rendering. Include manual verification notes in the PR.

## Commit & Pull Request Guidelines

Recent history uses Conventional Commit prefixes such as `feat:`, `fix:`, `revert:`, `docs:`, and `refactor:` with concise Chinese descriptions, for example: `fix: 修复橡皮擦导出边界计算`.

Pull requests should include a short summary, affected user workflows, verification commands, and screenshots or screen recordings for UI/editor changes. Link related issues when available and call out any changes to `plugin.json`, release packaging, or SiYuan API assumptions.

## Agent-Specific Instructions

Unless explicitly requested otherwise, reply to users in Simplified Chinese. When committing code, use concise Chinese commit messages with a conventional prefix.

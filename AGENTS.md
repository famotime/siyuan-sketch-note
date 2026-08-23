# Repository Guidelines

## Project Overview

siyuan-sketch-note (闲笔) is a vector handwriting editor plugin for SiYuan Note, built with Vue 3, HTML5 Canvas, and TypeScript using the SiYuan Plugin SDK.

## Project Structure & Module Organization

Core code is located in `src/`: `index.ts` (plugin lifecycle, settings, context menus, DOM injection), `main.ts` (Vue app bridge), `App.vue` (visibility, theme detection, tab management). Key modules:

- `composables/` — Vue 3 composables: `useThemeDetection`, `useSaveManager` (debounce + queue), `useColorPalettes`, `usePenHoverTooltip`, `useOcrSearch`, `useExportManager`, `useEditorPreferences`, `useZenMode`, `useViewport`, `useTextEditing`
- `editor/` — Editor UI & logic: `SketchEditor.vue` (orchestrator), `SketchCanvas.vue` (canvas), `EditorTopBar.vue`, `ToolBar.vue`, `ToolDropdown.vue`, `FloatingToolbar.vue`, `ReplayControls.vue`, `ColorPickerPopup.vue`, `shortcuts.ts`, `clipboard.ts`, `inputMode.ts`, `tools.ts`
- `live/` — Real-time screen projection / sync (mobile stylus writer -> PC viewer via SiYuan Broadcast API & SSE): `useLiveSession.ts`, `transport.ts`, `session.ts`, `viewerApply.ts`, `types.ts`
- `elements/` — Element models: `SketchElement` (strokes, shapes, text, images), `model.ts`, `lasso.ts` / `lassoEdit.ts`, `transform.ts`, `renderOrder.ts`
- `engine/` — Canvas rendering engine: `canvasEngine.ts` (state machine, undo/redo, image caching), `strokeSmoothing.ts`, `penSubtypePressure.ts`
- `storage/` — Data persistence: `saveQueue.ts`, `migrations.ts`, `thumbnail.ts` (cropping + eraser compositing), `cleanup.ts` (invalid sketch cleanup), `sketchIndex.ts`, `pluginSettings.ts`
- `recorder/` — Stroke operation recorder (`recorder.ts`), player (`player.ts`), and state reconstruction (`reconstruct.ts`)
- `template/` — 9 built-in page templates + custom background support
- `export/` — PNG, PDF, and JSON export/import
- `pages/` — Multi-page model
- `search/` — Pluggable OCR interface (`ocrProvider.ts`) and text indexing
- `tools/` — Presets, palette management, and brush profiles
- `feature-flags/` — Alpha feature toggles
- `utils/` — Date formatting, image upload, sketch identity/references, logger, confirm dialogs, workspace resolution
- `types/` — Shared TypeScript definitions (`SketchData`, `Stroke`, `SketchTool`, `LiveMessage`, etc.)
- `i18n/` — Locale JSON files (`en_US.json`, `zh_CN.json`)

## Build, Test, and Development Commands

- `pnpm install`: Install dependencies
- `pnpm dev`: Development mode (`vite build --watch`) outputting to SiYuan workspace
- `pnpm build`: Production build into `dist/` + `package.zip`
- `pnpm test`: Run full Vitest test suite
- `npx vitest run src/path/to/file.test.ts`: Run a single test file
- `npx eslint src/`: Check code style and linting
- `pnpm release:patch|minor|major`: Bump version, update files, tag, and push

## Coding Style & Conventions

- **Tooling & Formatting**: Follow `.editorconfig` (2 spaces, UTF-8). ESLint via `@antfu/eslint-config` (single quotes, semicolons required, multiline trailing commas).
- **Vue SFC**: Order must be `<template>` → `<script setup lang="ts">` → `<style>`. Attributes on separate lines (`vue/max-attributes-per-line: 1`).
- **Naming**: PascalCase for components, camelCase for modules/functions.
- **i18n**: Keep keys synchronized across `src/i18n/en_US.json` and `src/i18n/zh_CN.json`.
- **Testing**: Colocate test files alongside source with `.test.ts` suffix. Run `pnpm test` before committing.
- **Commits**: Conventional Commits in concise Simplified Chinese (e.g., `feat: 支持实时投屏同步`, `fix: 修复缩略图裁剪边界`).

## Agent-Specific Instructions

Unless explicitly requested otherwise, reply to users in Simplified Chinese. Maintain concise, structured responses.

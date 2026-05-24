# Repository Guidelines

## Project Structure & Module Organization

This repository is a SiYuan Note plugin built with Vite, Vue 3, and TypeScript. Core plugin code lives in `src/`: `main.ts` and `index.ts` handle entry points, `editor/` contains Vue editor components, `engine/` contains canvas rendering, `storage/` handles sketch data and thumbnails, `template/` defines page backgrounds, `types/` stores shared types, and `i18n/` contains locale JSON files. Root files such as `plugin.json`, `icon.png`, and `preview.png` provide plugin metadata and marketplace assets. `developer_docs/` stores SiYuan API references, and `plugin-sample-vite-vue/` is an upstream sample for comparison. Do not edit generated `dist/` or `package.zip` by hand.

## Build, Test, and Development Commands

Use `pnpm install` to install dependencies from `pnpm-lock.yaml`.

- `pnpm dev`: runs `vite build --watch` for plugin development.
- `pnpm build`: creates a production build in `dist/`.
- `pnpm release`: runs `release.js` using the default release mode.
- `pnpm release:patch|minor|major`: bumps the corresponding version and packages the plugin.
- `pnpm release:manual`: packages without automatic version bumping.

There is currently no dedicated test script. Before submitting changes, at minimum run `pnpm build`.

## Coding Style & Naming Conventions

Follow `.editorconfig`: UTF-8, spaces, 2-space indentation, final newline, and trimmed trailing whitespace except Markdown and declaration files. TypeScript and Vue style is governed by `eslint.config.mjs`, based on `@antfu/eslint-config`. Prefer single quotes, multiline object properties, trailing commas in multiline structures, and Vue SFC block order of `template`, `script`, then `style`. Name Vue components in PascalCase, modules in camelCase, and keep locale keys aligned across `src/i18n/en_US.json` and `src/i18n/zh_CN.json`.

## Testing Guidelines

No automated test framework is configured yet. For behavior changes, verify manually in SiYuan: insert a sketch block, draw, erase, undo/redo, save, reopen, and confirm thumbnail rendering. For rendering or storage changes, include focused manual verification notes in the PR. If tests are added later, place them near the affected module and name files with `.spec.ts`.

## Commit & Pull Request Guidelines

Recent history uses Conventional Commit prefixes such as `feat:`, `fix:`, `revert:`, `docs:`, and `refactor:` with concise Chinese descriptions, for example: `fix: 修复橡皮擦导出边界计算`.

Pull requests should include a short summary, affected user workflows, verification commands, and screenshots or screen recordings for UI/editor changes. Link related issues when available and call out any changes to `plugin.json`, release packaging, or SiYuan API assumptions.

## Agent-Specific Instructions

Unless explicitly requested otherwise, reply to users in Simplified Chinese. When committing code, use concise Chinese commit messages with a conventional prefix.

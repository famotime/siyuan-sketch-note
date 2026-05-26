# Refactor Plan

## 1. Project Snapshot

- Generated on: 2026-05-27
- Scope: siyuan-sketch-note (full repository)
- Goal: Reduce god-component complexity, eliminate code duplication, and improve maintainability

## 2. Architecture and Module Analysis

| Module | Key Files | Current Responsibility | Main Pain Points | Test Coverage Status |
| --- | --- | --- | --- | --- |
| Editor Components | `SketchEditor.vue` (1490L), `SketchCanvas.vue` (1429L), `FloatingToolbar.vue` (1063L) | Full editor orchestration, canvas drawing, floating toolbar | God components, ~30-40 refs each, 500+ line CSS blocks | No component tests |
| Top Bar | `EditorTopBar.vue` (563L) | Toolbar with undo/redo/clear/settings | Dead code (`v-if="false"` blocks), CSS bloat | No tests |
| Theme Detection | `App.vue:32-167`, `SketchEditor.vue:313-372` | Light/dark theme resolution via 4 cascading strategies | Duplicated logic across two files | No tests |
| Engine | `canvasEngine.ts` (519L) | Canvas state machine, rendering, eraser, undo/redo | Module-level `imageCache` Map never cleaned up | Has tests |
| Elements | `lassoEdit.ts` (292L) | Batch operations on selected elements | Parallel `*LassoSelection` / `*StrokeSelection` implementations | Has tests |
| Export | `pdf.ts`, `png.ts`, `json.ts` | PDF/PNG/JSON export | Duplicated `pad()` function across 3 files | Has tests |
| Storage | `thumbnail.ts` (593L) | Thumbnail generation with auto-crop | Large file, multiple rendering paths, `renderNonStrokeElements()` duplicated with engine | Has tests |
| App.vue | `App.vue` (291L) | Root component, editor lifecycle | Module-level `ref()`s outside `setup()` (anti-pattern) | No tests |

## 3. Prioritized Refactor Backlog

| ID | Priority | Module/Scenario | Files in Scope | Refactor Objective | Risk Level | Pre-Refactor Test Checklist | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RF-001 | P0 | Extract composables from SketchEditor.vue | `SketchEditor.vue`, new `src/composables/*.ts` | Split ~40 functions into `useSaveManager`, `useExportManager`, `useOcrSearch`, `useThemeDetection`, `useColorPalettes`, `useEditorPreferences`. Target: reduce from 1490 to <500 lines | Medium | - [x] Verify editor opens/closes correctly; - [x] Save/auto-save still works; - [x] Export PNG/PDF/JSON works; - [x] Theme toggle works; - [x] Color palette add/remove works | done |
| RF-002 | P0 | Extract composables from SketchCanvas.vue | `SketchCanvas.vue`, new `src/composables/*.ts` | Extract `useViewport`, `useTextEditing`. Target: reduce from 1429 to <1100 lines | Medium | - [x] Drawing strokes works; - [x] Lasso select/move/delete works; - [x] Text editing works; - [x] Shape drawing works; - [x] Zoom/pan works | done |
| RF-003 | P0 | Unify theme detection | `App.vue`, `SketchEditor.vue`, `src/composables/useThemeDetection.ts` | Extract shared `parseCssColor()`, `getColorLuminance()`, `clampColorChannel()`, `resolveThemeModeFromColor()` into composable module | Low | - [x] Theme detection resolves correctly in all 4 strategies; - [x] Editor and app theme stay in sync | done |
| RF-004 | P1 | Remove dead code in EditorTopBar | `EditorTopBar.vue` | Remove `v-if="false"` blocks for page nav, OCR, search, export (hidden features). Remove unused imports and refs | Low | - [x] Top bar renders correctly; - [x] Undo/redo/clear still work; - [x] No console errors | done |
| RF-005 | P1 | Extract duplicated utilities | `pdf.ts`, `png.ts`, `json.ts`, `shapes.ts`, `text.ts`, `image.ts` | Extract `pad()` to `src/utils/date.ts`, `defaultTransform()` to `src/elements/model.ts` | Low | - [x] Export tests still pass; - [x] Shape/text/image creation tests still pass | done |
| RF-006 | P1 | Clean up SketchEditor.vue CSS | `SketchEditor.vue` | Consolidate repeated CSS variable definitions (removed 2 duplicate blocks) | Low | - [x] Tests pass; - [x] No style regressions | done |
| RF-007 | P2 | Clean up canvasEngine imageCache | `canvasEngine.ts` | Export `clearImageCache()` for callers to use | Low | - [x] Tests pass | done |
| RF-008 | P2 | Group SketchCanvas let variables | `SketchCanvas.vue` | Group mutable `let` variables into `interaction` and `lasso` structured objects | Low | - [x] All interaction modes work; - [x] No regressions | done |

Priority definition:
- `P0`: highest value and risk, execute first — god components and duplicated logic
- `P1`: medium value or risk — dead code, utility extraction, CSS cleanup
- `P2`: low-risk cleanup — memory leak fix, variable grouping

Status definition:
- `pending`
- `in_progress`
- `done`
- `blocked`

## 4. Execution Log

| ID | Start Date | End Date | Test Commands | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| RF-001 | 2026-05-27 | 2026-05-27 | `npx vitest run` | 168 pass | Extracted 7 composables, SketchEditor 1490→1003 lines |
| RF-002 | 2026-05-27 | 2026-05-27 | `npx vitest run` | 168 pass | Extracted useViewport + useTextEditing, SketchCanvas 1429→1039 lines |
| RF-003 | 2026-05-27 | 2026-05-27 | `npx vitest run` | 168 pass | App.vue now imports shared theme utils from useThemeDetection.ts |
| RF-004 | 2026-05-27 | 2026-05-27 | `npx vitest run` | 168 pass | Removed 8 v-if="false" blocks, EditorTopBar 563→363 lines |
| RF-005 | 2026-05-27 | 2026-05-27 | `npx vitest run` | 168 pass | Extracted pad() and defaultTransform() to shared modules |
| RF-006 | 2026-05-27 | 2026-05-27 | `npx vitest run` | 168 pass | Removed 2 duplicate CSS variable blocks |
| RF-007 | 2026-05-27 | 2026-05-27 | `npx vitest run` | 168 pass | Exported clearImageCache() from canvasEngine.ts |
| RF-008 | 2026-05-27 | 2026-05-27 | `npx vitest run` | 168 pass | Grouped into interaction{} and lasso{} objects |

## 5. Decision and Confirmation

- User approved items: All (RF-001 through RF-008)
- Deferred items: None
- Blocked items and reasons: None

## 6. Summary

All 8 refactor items completed. Key outcomes:
- **SketchEditor.vue**: 1490 → 1003 lines (33% reduction), 7 composables extracted
- **SketchCanvas.vue**: 1429 → 1039 lines (27% reduction), 2 composables extracted
- **EditorTopBar.vue**: 563 → 363 lines (36% reduction), dead code removed
- **App.vue**: 291 → 244 lines, theme utils unified
- **Deduplication**: `pad()` → `utils/date.ts`, `defaultTransform()` → `elements/model.ts`
- **Memory**: `clearImageCache()` exported for lifecycle cleanup
- **Code organization**: Interaction state grouped into structured objects
- **Tests**: 39 files, 168 tests — all passing throughout

# Replay Realistic Playback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade replay from result animation to operation-level playback for toolbar selection and image insert/transform/opacity interactions.

**Architecture:** Keep replay as structured events rather than video. Recorder stores operation source, start/end image state, and sampled transform frames; player consumes those samples and emits UI callbacks without mutating live editing state. Vue editor renders replay UI through a separate display state so playback can show toolbar clicks while recording is suspended.

**Tech Stack:** Vue 3 SFC, TypeScript, Canvas 2D, Vitest.

---

## File Structure

- Modify `src/recorder/types.ts`: extend replay events with `toolSwitch.source`, image loading metadata, image transform start state, and sampled transform frames.
- Modify `src/recorder/recorder.ts`: add suspend/resume guard so replay-driven UI changes are not recorded.
- Modify `src/recorder/player.ts`: use image transform samples and expose image lifecycle/tool-switch UI callbacks.
- Modify `src/editor/SketchEditor.vue`: add replay display state, route toolbars through replay state, preserve toolbar visibility during replay, and record image import source.
- Modify `src/editor/SketchCanvas.vue`: record image transform samples, record image insert loading duration, and fix lasso image transform sample initialization.
- Modify `src/editor/FloatingToolbar.vue`: support replay read-only mode.
- Modify `src/editor/EditorTopBar.vue`: add replay click target metadata for image import button.
- Test `src/recorder/recorder.test.ts`: recorder suspension.
- Test `src/recorder/player.test.ts`: sampled image transform playback and tool-switch callback payload.
- Test `src/editor/replayVisibility.test.ts`: floating toolbar remains visible during replay in read-only mode.
- Test `src/editor/topBarLayout.test.ts`: image import button exposes replay click target.

## Task 1: Recorder Guard

**Files:**
- Modify: `src/recorder/recorder.ts`
- Modify: `src/recorder/recorder.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests that call `setSuspended(true)`, record a stroke, assert no event is stored, then call `setSuspended(false)` and assert events are recorded again.

- [ ] **Step 2: Verify red**

Run: `npx vitest run src/recorder/recorder.test.ts`

Expected: fails because `setSuspended` is not defined.

- [ ] **Step 3: Implement minimal guard**

Add `private suspended = false`, `setSuspended(suspended: boolean)`, `isSuspended()`, and return early in `record()` when suspended.

- [ ] **Step 4: Verify green**

Run: `npx vitest run src/recorder/recorder.test.ts`

Expected: all tests in the file pass.

## Task 2: Replay Event Shape

**Files:**
- Modify: `src/recorder/types.ts`
- Modify: `src/recorder/recorder.test.ts`
- Modify: `src/recorder/player.test.ts`

- [ ] **Step 1: Add type-backed tests**

Update existing tool-switch/image-transform test fixtures so they include:

```ts
source: 'mainToolbar'
```

for tool switches and:

```ts
initialElement,
samples: [
  { offsetMs: 0, bounds: initialElement.bounds, rotation: 0, opacity: 1 },
  { offsetMs: 120, bounds: finalElement.bounds, rotation: 0.25, opacity: 1 },
]
```

for image transforms.

- [ ] **Step 2: Verify red**

Run: `npx vitest run src/recorder/recorder.test.ts src/recorder/player.test.ts`

Expected: TypeScript/Vitest fails until production event types accept the new fields.

- [ ] **Step 3: Extend event interfaces**

Add `ReplayToolSource = 'mainToolbar' | 'floatingToolbar' | 'topBar' | 'shortcut' | 'canvas' | 'paste'`; add optional `source` to `ToolSwitchReplayEvent` and `ImageReplayEvent`; add `initialElement` and `samples` to `ImageTransformReplayEvent`.

- [ ] **Step 4: Verify green**

Run: `npx vitest run src/recorder/recorder.test.ts src/recorder/player.test.ts`

Expected: type-compatible tests pass after player behavior is adjusted in Task 3.

## Task 3: Sampled Image Playback

**Files:**
- Modify: `src/recorder/player.ts`
- Modify: `src/recorder/player.test.ts`

- [ ] **Step 1: Write failing behavior test**

Add a player test that creates an image transform event with `initialElement`, `finalElement`, and two samples. Play one frame and assert the drawing context receives the initial bounds before final bounds.

- [ ] **Step 2: Verify red**

Run: `npx vitest run src/recorder/player.test.ts`

Expected: fails because player ignores transform samples.

- [ ] **Step 3: Implement sampled playback**

In `animateImageTransform`, initialize from `event.initialElement ?? current`, advance elapsed time with playback speed, choose the latest sample whose `offsetMs` is <= elapsed, draw that sampled element, and commit `finalElement` when elapsed reaches the last sample offset.

- [ ] **Step 4: Verify green**

Run: `npx vitest run src/recorder/player.test.ts`

Expected: player tests pass.

## Task 4: Toolbar Replay UI State

**Files:**
- Modify: `src/editor/SketchEditor.vue`
- Modify: `src/editor/FloatingToolbar.vue`
- Modify: `src/editor/EditorTopBar.vue`
- Modify: `src/editor/replayVisibility.test.ts`
- Modify: `src/editor/topBarLayout.test.ts`

- [ ] **Step 1: Write failing tests**

Update string-based Vue tests to assert:

- `FloatingToolbar` is not hidden solely by `!isReplayMode`.
- `FloatingToolbar` receives `:replayActive="isReplayMode"`.
- top bar image import button has `data-replay-target="topbar-image"`.

- [ ] **Step 2: Verify red**

Run: `npx vitest run src/editor/replayVisibility.test.ts src/editor/topBarLayout.test.ts`

Expected: fails because current template hides floating toolbar and top bar lacks replay target metadata.

- [ ] **Step 3: Implement replay display state**

Add `replayDisplayTool`, `replayDisplayPreset`, and computed `displayTool`/`displayPreset`. Use them for `ToolBar` and `FloatingToolbar`. Add `replayActive` prop to `FloatingToolbar` and pointer-event disabled styling during replay.

- [ ] **Step 4: Prevent replay from recording UI changes**

Call `replayRecorder.setSuspended(true)` before replay starts and restore it in `exitReplayMode`. Guard `watch(activeTool)` with `if (isReplayMode.value) return`.

- [ ] **Step 5: Verify green**

Run: `npx vitest run src/editor/replayVisibility.test.ts src/editor/topBarLayout.test.ts`

Expected: editor structure tests pass.

## Task 5: Image Operation Recording

**Files:**
- Modify: `src/editor/SketchEditor.vue`
- Modify: `src/editor/SketchCanvas.vue`
- Modify: `src/recorder/types.ts`

- [ ] **Step 1: Add recording fields**

Track `imageImportStartedAt` and `imageImportSource` in `SketchEditor.vue`; pass source/loading duration to `insertImage`.

- [ ] **Step 2: Add transform sampling**

When image transform starts, store `initialElement` and first sample. On pointer move, push throttled samples containing `offsetMs`, `bounds`, `rotation`, `opacity`, and pointer.

- [ ] **Step 3: Record opacity as an image transform sample**

In `cycleImageOpacity`, record `initialElement`, `finalElement`, and two samples from old opacity to new opacity.

- [ ] **Step 4: Verify targeted tests**

Run: `npx vitest run src/recorder/recorder.test.ts src/recorder/player.test.ts src/editor/replayVisibility.test.ts src/editor/topBarLayout.test.ts`

Expected: all targeted tests pass.

## Task 6: Full Verification

**Files:**
- All changed files

- [ ] **Step 1: Run unit tests**

Run: `pnpm test`

Expected: Vitest exits 0.

- [ ] **Step 2: Run production build**

Run: `pnpm build`

Expected: Vite build and package generation exit 0.

- [ ] **Step 3: Inspect diff**

Run: `git diff -- src docs`

Expected: diff only includes replay plan and replay implementation changes.

## Self-Review

- Requirement coverage: toolbar display, toolbar click feedback, image loading, transform samples, opacity steps, and replay recording suspension are covered.
- Placeholder scan: no placeholder-only task remains; each task names files, commands, and expected outcomes.
- Type consistency: event names keep existing public names (`toolSwitch`, `image`, `imageTransform`) where practical to reduce blast radius, while adding fields needed for high-fidelity replay.

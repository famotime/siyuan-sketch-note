# Canvas Operation Replay Feature Design

## Overview

Add a canvas operation replay feature to the sketch editor. Users can replay the entire drawing process as a point-by-point animation, with video-player-style controls (play/pause, progress bar, speed control). The feature supports both real-time animation playback for teaching/sharing and step-by-step browsing for personal review.

## Requirements

### Core Scope

**Default included operations:**
- Pen/highlighter strokes (point-by-point replay showing writing process)
- Eraser operations (erased strokes disappear immediately)
- Shape creation (line, arrow, rectangle, ellipse, triangle)
- Text element creation/editing

**Optional operations (default off):**
- Toolbar clicks (tool switches)
- Image operations (insert, move, resize, delete)

### Playback Behavior

- **Granularity**: Point-by-point playback for strokes and shapes, revealing the writing/drawing process in real-time
- **Speed**: 1x, 2x, 4x speed options
- **Controls**: Play/pause, progress bar (draggable), speed selector, previous/next step, exit button
- **Keyboard**: Space to toggle play/pause, Escape to exit replay mode
- **Eraser**: Erased strokes disappear immediately (no highlight/ghost effect)
- **Text**: At 1x speed, text appears character by character (30ms per character). At 2x/4x, text appears instantly.
- **Image**: 200ms fade-in when appearing
- **Intervals**: Preserve natural time gaps between operations; auto-compress gaps >10s to 2s; at 4x speed, compress all gaps to 1/4
- **Optional markers**: When optional operations are included, small colored dots on the progress bar (blue for tool switch, green for image operations)

## Architecture

### Module Structure

Independent recording layer in `src/recorder/`, decoupled from the canvas engine.

```
src/recorder/
  types.ts          — ReplayEvent type definitions
  recorder.ts       — ReplayRecorder class
  player.ts         — ReplayPlayer playback engine
  reconstruct.ts    — Fallback reconstruction from existing data
  player.test.ts    — Playback engine unit tests
  recorder.test.ts  — Recorder unit tests

src/editor/
  ReplayControls.vue — Playback controls UI component
```

### Modified Files

| File | Change |
|------|--------|
| `src/types/sketch.ts` | Add `replayEvents?: ReplayEvent[]` to `SketchData` |
| `src/editor/SketchCanvas.vue` | Add `recorder.record(event)` at 6 operation completion points |
| `src/editor/EditorTopBar.vue` | Add replay button |
| `src/editor/SketchEditor.vue` | Manage replay mode state, coordinate recorder and player |
| `src/engine/canvasEngine.ts` | Serialize/deserialize `replayEvents` in `serializeState`/`restoreEngineState` |
| `src/storage/index.ts` | Include `replayEvents` in save/load |
| `src/i18n/en_US.json` | Add replay i18n keys |
| `src/i18n/zh_CN.json` | Add replay i18n keys |

### Dependency Graph

```
SketchEditor.vue
  ├── ReplayRecorder (created, passed to SketchCanvas)
  ├── ReplayPlayer (created on replay mode entry)
  └── ReplayControls.vue (replay UI)

SketchCanvas.vue
  └── ReplayRecorder.record() (6 call sites)

ReplayPlayer
  └── Independent canvas rendering, reuses engine's renderStroke functions
```

## Data Model

### ReplayEvent Type

A discriminated union type where each operation maps to one event variant.

```typescript
// src/recorder/types.ts

type ReplayEventBase = {
  id: string           // Unique event ID
  timestamp: number    // Absolute timestamp (ms) when operation completed
}

// Default included events
type StrokeReplayEvent = ReplayEventBase & {
  type: 'stroke'
  stroke: Stroke       // Complete stroke data (points, color, width, etc.)
}

type EraseReplayEvent = ReplayEventBase & {
  type: 'erase'
  erasedIds: string[]  // IDs of erased strokes
}

type ShapeReplayEvent = ReplayEventBase & {
  type: 'shape'
  stroke: Stroke       // Shape stored as Stroke (isShape: true)
}

type TextReplayEvent = ReplayEventBase & {
  type: 'text'
  element: TextElement // Complete text element
}

// Optional events (default off)
type ImageReplayEvent = ReplayEventBase & {
  type: 'image'
  element: ImageElement
}

type ToolSwitchReplayEvent = ReplayEventBase & {
  type: 'toolSwitch'
  tool: SketchTool
  preset: ToolPreset
}

type ReplayEvent = StrokeReplayEvent | EraseReplayEvent | ShapeReplayEvent
  | TextReplayEvent | ImageReplayEvent | ToolSwitchReplayEvent
```

### Storage

Events are stored in `SketchData` as an optional field:

```typescript
// In existing SketchData type
replayEvents?: ReplayEvent[]
```

This ensures backward compatibility — old data without events can still be loaded and reconstructed via fallback.

## Recording Mechanism

### Recording Points

Each recording point is a single `recorder.record(event)` call appended to existing logic in SketchCanvas.vue:

| Operation | Insertion Location | Event Type |
|-----------|-------------------|------------|
| Pen/highlighter stroke | After `enginePointerUp` completes | `stroke` |
| Eraser erase | After eraser branch in `enginePointerUp` | `erase` |
| Shape creation | After `createShapeStrokeForTool` in shape `onPointerUp` | `shape` |
| Text create/edit | After `finishTextEditing()` create/update branch | `text` |
| Image insert | After `insertImage()` | `image` |
| Tool switch | In `watch(tool)` or tool button handler | `toolSwitch` |

### ReplayRecorder Class

```typescript
// src/recorder/recorder.ts

class ReplayRecorder {
  private events: ReplayEvent[] = []
  private enabled = {
    stroke: true,
    erase: true,
    shape: true,
    text: true,
    image: false,
    toolSwitch: false,
  }

  record(event: ReplayEvent): void {
    if (!this.enabled[event.type]) return
    this.events.push(event)
  }

  getEvents(): ReplayEvent[] { return [...this.events] }
  clear(): void { this.events = [] }
  setEnabled(type: ReplayEventType, on: boolean): void { ... }

  // Fallback reconstruction for legacy data without events
  static reconstructFromData(data: SketchData): ReplayEvent[] { ... }
}
```

### Fallback Reconstruction

For historical data without `replayEvents`:

1. Iterate `strokes[]`, sort by `StrokePoint[0].timestamp`
2. Strokes with `isShape: true` become `shape` events, others become `stroke` events
3. Iterate `elements[]`: TextElement → `text` events, ImageElement → `image` events
4. Data without timestamps is ordered by array position
5. Eraser operations cannot be reconstructed (erased strokes no longer exist) — no `erase` events in fallback mode

## Playback Engine

### ReplayPlayer Class

```typescript
// src/recorder/player.ts

type PlaybackState = 'idle' | 'playing' | 'paused'
type PlaybackSpeed = 1 | 2 | 4

class ReplayPlayer {
  private events: ReplayEvent[]
  private currentIndex = 0
  private state: PlaybackState = 'idle'
  private speed: PlaybackSpeed = 1
  private animationFrame: number | null = null

  // Temporary canvas for replay rendering
  private replayCanvas: HTMLCanvasElement
  private replayCtx: CanvasRenderingContext2D

  // Callbacks for UI updates
  onProgress?: (current: number, total: number) => void
  onStateChange?: (state: PlaybackState) => void
  onComplete?: () => void
}
```

### Point-by-Point Replay Algorithm

For `stroke` and `shape` events, the points array is decomposed into frame-by-frame rendering:

```
Replaying a Stroke:
1. Create an empty currentStroke
2. At speed-adjusted rate, add N points per frame (1x=1pt, 2x=2pt, 4x=4pt)
3. Each frame calls renderStrokeSegment to draw the latest segment
4. After all points are added, call renderStroke once (ensures final visual consistency)
5. Proceed to next event
```

Frame rate: `requestAnimationFrame` at 60fps base. At 2x speed, 2 points per frame; at 4x speed, 4 points per frame.

### Event-Specific Playback Behavior

| Event Type | Playback Behavior |
|-----------|-------------------|
| `stroke` | Point-by-point drawing, simulating handwriting |
| `shape` | Point-by-point outline drawing (vertices of line/rect/ellipse) |
| `erase` | Immediate removal of erased strokes (full redraw) |
| `text` | At 1x: text appears character by character, 30ms per character. At 2x/4x: text appears instantly. |
| `image` | Image appears with 200ms fade-in |
| `toolSwitch` | No canvas rendering; only updates progress bar marker |

### Interval Handling

Real time gaps between events (`event[n].timestamp - event[n-1].timestamp`):
- Default: preserve intervals (shows "thinking pauses")
- 4x speed: compress all intervals to 1/4
- Auto-compress: gaps > 10 seconds are compressed to 2 seconds
- At 2x speed: compress gaps > 5 seconds to 1.5 seconds

## UI Design

### Entry/Exit

- **Entry**: New "Replay" button (play icon) in EditorTopBar. Clicking switches editor to replay mode.
- **Exit**: "Exit replay" button (X icon) in the control bar, or pressing Escape.
- **On enter**: Editor becomes read-only, toolbar hides, replay control bar appears above the canvas.
- **On exit**: Restore to the editing state before replay entry, full redraw restores current data.

### Control Bar Layout

```
┌──────────────────────────────────────────────────────────┐
│  ⏮  ▶/⏸  ⏭  │  ████████░░░░░░░░░░░░  │  1x ▼  │  ✕  │
│ prev play next │        progress bar      │ speed  │ exit │
└──────────────────────────────────────────────────────────┘
```

- **Play/Pause**: Space key also toggles
- **Progress bar**: Draggable, shows `current step / total steps`, optional operation markers as colored dots
- **Speed selector**: Dropdown or cycle toggle 1x → 2x → 4x → 1x
- **Previous/Next**: In paused state, click to jump to previous/next event (auto-pauses)
- **Exit button**: X icon in top-right

### Progress Bar Markers

When optional operations are included, small colored dots on the progress bar:
- Tool switch: blue dot
- Image operations: green dot
- Clicking a marker shows a tooltip (e.g., "Switched to highlighter")

### Canvas State During Replay

Uses a temporary `replayCanvas` (same dimensions as strokeCanvas), overlaid on bgCanvas:
- Does not affect the editor's actual data
- Replay can be exited at any time; editing state is intact
- bgCanvas (template background) remains unchanged, reused

## Testing Strategy

### Unit Tests

- `recorder.test.ts`: Recording events, filtering by enabled types, clear/getEvents
- `player.test.ts`: Playback state machine (idle → playing → paused → idle), speed changes, event sequencing, interval calculation
- `reconstruct.test.ts`: Fallback reconstruction from strokes/elements data

### Integration Tests

- Record a sequence of operations, replay, verify canvas output matches expected state at each step
- Verify undo/redo state is unaffected by entering/exiting replay mode

### Manual Testing

- Replay a complex drawing with mixed operations (pen, eraser, shapes, text)
- Verify speed control works correctly at 1x/2x/4x
- Verify progress bar dragging works
- Verify exit replay restores editing state correctly
- Test with legacy data (no replayEvents) to verify fallback reconstruction

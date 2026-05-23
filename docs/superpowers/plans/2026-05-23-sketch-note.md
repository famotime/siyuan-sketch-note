# Sketch Note 插件实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为思源笔记构建手写插件，支持在代码块中嵌入手写缩略图，点击后打开全屏 Canvas 编辑器进行手写输入，支持矢量笔迹存储和二次编辑。

**Architecture:** 使用代码块（`data-subtype="sketch-note"`）作为手写内容载体，通过 `loaded-protyle-static/dynamic` 事件拦截渲染并替换为缩略图（与 ECharts/Mermaid 同模式）。矢量笔迹数据和缩略图存储在思源插件存储中（`saveData`/`loadData`）。Canvas 引擎使用原生 Pointer Events API + 双层 Canvas 渲染。

**Tech Stack:** Vue 3, TypeScript, HTML5 Canvas 2D, Pointer Events API, SiYuan Plugin SDK

---

## File Structure

```
src/
├── index.ts                  # [MODIFY] 插件入口
├── main.ts                   # [MODIFY] Vue app 生命周期
├── App.vue                   # [REWRITE] 根组件 → 编辑器容器
├── api.ts                    # [KEEP] SiYuan API 封装
├── index.scss                # [REWRITE] 全局样式
├── i18n/
│   ├── zh_CN.json            # [REWRITE] 中文翻译
│   └── en_US.json            # [REWRITE] 英文翻译
├── types/
│   ├── sketch.ts             # [CREATE] 笔迹数据类型
│   ├── api.d.ts              # [KEEP]
│   └── index.d.ts            # [MODIFY] 扩展 Window 类型
├── template/                 # [CREATE] 模板系统
│   ├── index.ts              # 模板注册表
│   ├── blank.ts              # 白纸模板
│   └── grid.ts               # 方格纸模板
├── storage/                  # [CREATE] 数据持久化
│   └── index.ts              # 序列化/反序列化/缩略图导出
├── engine/                   # [CREATE] Canvas 引擎
│   └── canvasEngine.ts       # 纯 TS，无 Vue 依赖
├── widget/                   # [CREATE] 代码块渲染拦截
│   └── sketchRenderer.ts     # 监听事件，替换缩略图
├── editor/                   # [CREATE] 全屏编辑器
│   ├── SketchEditor.vue      # 编辑器主组件
│   ├── SketchCanvas.vue      # Canvas 画布组件
│   └── SketchToolbar.vue     # 底部工具栏
├── components/SiyuanTheme/   # [KEEP]
└── utils/index.ts            # [KEEP]
```

**config files:**
- `plugin.json` — [MODIFY] 更新名称/作者/描述
- `package.json` — [MODIFY] 更新名称/描述
- `tsconfig.json` — [KEEP]
- `vite.config.ts` — [KEEP]

---

## Task 1: Project Setup & Plugin Identity

**Files:**
- Modify: `plugin.json`
- Modify: `package.json`
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`

- [ ] **Step 1: Update plugin.json**

Read `plugin.json`, then replace its content:

```json
{
  "name": "sketch-note",
  "author": "sketch-note",
  "url": "",
  "version": "0.1.0",
  "minAppVersion": "2.10.14",
  "backends": ["all"],
  "frontends": ["all"],
  "displayName": {
    "default": "Sketch Note",
    "zh_CN": "手写笔记"
  },
  "description": {
    "default": "Handwriting plugin for SiYuan Note with vector strokes, templates, and undo/redo",
    "zh_CN": "思源笔记手写插件，支持矢量笔迹、稿纸模板和撤销重做"
  },
  "readme": {
    "default": "README.md"
  },
  "funding": {
    "custom": []
  },
  "keywords": ["sketch", "handwriting", "canvas", "drawing", "手写", "绘图"]
}
```

- [ ] **Step 2: Update package.json**

Read `package.json`, then update `name`, `version`, and `description` fields:

```json
{
  "name": "siyuan-sketch-note",
  "version": "0.1.0",
  "description": "Handwriting plugin for SiYuan Note",
  "type": "module",
  "scripts": {
    "dev": "vite build --watch",
    "build": "vite build"
  }
}
```

Keep all other fields (dependencies, devDependencies, etc.) unchanged.

- [ ] **Step 3: Update i18n files**

Write `src/i18n/zh_CN.json`:
```json
{
  "addTopBarIcon": "手写笔记",
  "insertSketch": "插入手写块",
  "sketchNote": "手写笔记",
  "clickToEdit": "点击编辑手写笔记",
  "templateBlank": "白纸",
  "templateGrid": "方格纸",
  "pen": "画笔",
  "eraser": "橡皮",
  "undo": "撤销",
  "redo": "重做",
  "clear": "清除",
  "save": "保存",
  "back": "返回",
  "unsavedConfirm": "有未保存的更改，确定要离开吗？"
}
```

Write `src/i18n/en_US.json`:
```json
{
  "addTopBarIcon": "Sketch Note",
  "insertSketch": "Insert Sketch Block",
  "sketchNote": "Sketch Note",
  "clickToEdit": "Click to edit sketch",
  "templateBlank": "Blank",
  "templateGrid": "Grid",
  "pen": "Pen",
  "eraser": "Eraser",
  "undo": "Undo",
  "redo": "Redo",
  "clear": "Clear",
  "save": "Save",
  "back": "Back",
  "unsavedConfirm": "You have unsaved changes. Are you sure you want to leave?"
}
```

- [ ] **Step 4: Install dependencies and verify build**

Run: `pnpm install`
Then run: `pnpm build`
Expected: Build succeeds, `dist/` directory created with `index.js` and `index.css`.

---

## Task 2: Types & Templates

**Files:**
- Create: `src/types/sketch.ts`
- Create: `src/template/index.ts`
- Create: `src/template/blank.ts`
- Create: `src/template/grid.ts`

- [ ] **Step 1: Create sketch types**

Write `src/types/sketch.ts`:
```typescript
export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;    // 0~1, default 0.5 when unavailable
  timestamp: number;   // ms
}

export interface Stroke {
  id: string;
  points: StrokePoint[];
  color: string;       // hex color
  width: number;       // base line width in px
  tool: "pen" | "eraser";
}

export interface SketchData {
  version: 1;
  template: string;         // template id: "blank" | "grid"
  canvasWidth: number;
  canvasHeight: number;
  strokes: Stroke[];
  thumbnail: string | null; // data:image/png;base64,...
}

export const DEFAULT_SKETCH_DATA: SketchData = {
  version: 1,
  template: "blank",
  canvasWidth: 800,
  canvasHeight: 1200,
  strokes: [],
  thumbnail: null,
};

export type SketchTool = "pen" | "eraser";

export const PRESET_COLORS = [
  "#000000",
  "#e74c3c",
  "#3498db",
  "#2ecc71",
  "#f39c12",
] as const;

export const DEFAULT_PEN_WIDTH = 3;
export const DEFAULT_ERASER_WIDTH = 20;
export const CANVAS_LOGICAL_WIDTH = 800;
export const CANVAS_INITIAL_HEIGHT = 1200;
export const CANVAS_HEIGHT_INCREMENT = 600;
```

- [ ] **Step 2: Create template interface and registry**

Write `src/template/index.ts`:
```typescript
import type { Template } from "./blank";
import { blankTemplate } from "./blank";
import { gridTemplate } from "./grid";

export type { Template };

const templates: Template[] = [blankTemplate, gridTemplate];

export function getTemplate(id: string): Template {
  return templates.find((t) => t.id === id) ?? blankTemplate;
}

export function getAllTemplates(): Template[] {
  return templates;
}
```

- [ ] **Step 3: Create blank template**

Write `src/template/blank.ts`:
```typescript
export interface Template {
  id: string;
  nameKey: string;  // i18n key
  render: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
}

export const blankTemplate: Template = {
  id: "blank",
  nameKey: "templateBlank",
  render(ctx, width, height) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  },
};
```

- [ ] **Step 4: Create grid template**

Write `src/template/grid.ts`:
```typescript
import type { Template } from "./blank";

const GRID_SIZE = 19; // ~5mm at 96dpi
const GRID_COLOR = "#e0e0e0";
const GRID_LINE_WIDTH = 0.5;

export const gridTemplate: Template = {
  id: "grid",
  nameKey: "templateGrid",
  render(ctx, width, height) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = GRID_LINE_WIDTH;

    ctx.beginPath();
    for (let x = GRID_SIZE; x < width; x += GRID_SIZE) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = GRID_SIZE; y < height; y += GRID_SIZE) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  },
};
```

- [ ] **Step 5: Verify TypeScript compilation**

Run: `pnpm build`
Expected: Build succeeds with no type errors.

---

## Task 3: Storage Layer

**Files:**
- Create: `src/storage/index.ts`

- [ ] **Step 1: Create storage module**

Write `src/storage/index.ts`:
```typescript
import type { SketchData } from "@/types/sketch";
import { DEFAULT_SKETCH_DATA } from "@/types/sketch";
import { thumbnailCanvas } from "./thumbnail";

export { thumbnailCanvas };

const STORAGE_PREFIX = "sketch:";

export function storageKey(blockId: string): string {
  return `${STORAGE_PREFIX}${blockId}`;
}

/**
 * Load sketch data for a given block ID.
 * Returns null if no data exists.
 */
export async function loadSketchData(
  loadData: (key: string) => Promise<any>,
  blockId: string
): Promise<SketchData | null> {
  const key = storageKey(blockId);
  const raw = await loadData(key);
  if (!raw) return null;

  // Validate version
  if (raw.version !== 1) {
    console.warn(`[Sketch Note] Unknown data version: ${raw.version}`);
    return null;
  }

  return raw as SketchData;
}

/**
 * Save sketch data for a given block ID.
 */
export async function saveSketchData(
  saveData: (key: string, data: any) => Promise<void>,
  blockId: string,
  data: SketchData
): Promise<void> {
  const key = storageKey(blockId);
  await saveData(key, data);
}

/**
 * Create a new empty sketch data object.
 */
export function createEmptySketchData(templateId: string): SketchData {
  return {
    ...DEFAULT_SKETCH_DATA,
    template: templateId,
    strokes: [],
    thumbnail: null,
  };
}
```

- [ ] **Step 2: Create thumbnail utility**

Write `src/storage/thumbnail.ts`:
```typescript
import { CANVAS_LOGICAL_WIDTH } from "@/types/sketch";
import { getTemplate } from "@/template";
import type { Stroke } from "@/types/sketch";

const THUMBNAIL_WIDTH = CANVAS_LOGICAL_WIDTH;
const THUMBNAIL_BG_PADDING = 0;

/**
 * Render strokes to a PNG data URL for thumbnail display.
 * Uses a separate offscreen canvas at reduced resolution.
 */
export function thumbnailCanvas(
  strokes: Stroke[],
  templateId: string,
  canvasHeight: number
): string {
  const scale = 1; // 1:1 for thumbnails (already logical size)
  const width = THUMBNAIL_WIDTH;
  const height = canvasHeight;

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  // Render template background
  const template = getTemplate(templateId);
  template.render(ctx, width, height);

  // Render all strokes
  for (const stroke of strokes) {
    renderStrokeToCtx(ctx, stroke);
  }

  return canvas.toDataURL("image/png");
}

function renderStrokeToCtx(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const { points, color, width, tool } = stroke;
  if (points.length < 2) return;

  ctx.save();
  if (tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = color;
  }

  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
  ctx.restore();
}
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `pnpm build`
Expected: Build succeeds.

---

## Task 4: Canvas Engine

**Files:**
- Create: `src/engine/canvasEngine.ts`

- [ ] **Step 1: Create canvas engine**

Write `src/engine/canvasEngine.ts`:
```typescript
import type { Stroke, StrokePoint, SketchTool, SketchData } from "@/types/sketch";
import {
  DEFAULT_PEN_WIDTH,
  DEFAULT_ERASER_WIDTH,
  CANVAS_LOGICAL_WIDTH,
  CANVAS_HEIGHT_INCREMENT,
} from "@/types/sketch";
import { getTemplate } from "@/template";

let idCounter = 0;
function newId(): string {
  return `s${Date.now()}-${++idCounter}`;
}

export interface EngineState {
  strokes: Stroke[];
  currentStroke: Stroke | null;
  undoStack: Stroke[][];
  redoStack: Stroke[][];
  tool: SketchTool;
  color: string;
  penWidth: number;
  eraserWidth: number;
  canvasWidth: number;
  canvasHeight: number;
  templateId: string;
  isDirty: boolean;
}

export function createEngineState(
  templateId: string,
  canvasWidth = CANVAS_LOGICAL_WIDTH,
  canvasHeight = 1200
): EngineState {
  return {
    strokes: [],
    currentStroke: null,
    undoStack: [],
    redoStack: [],
    tool: "pen",
    color: "#000000",
    penWidth: DEFAULT_PEN_WIDTH,
    eraserWidth: DEFAULT_ERASER_WIDTH,
    canvasWidth,
    canvasHeight,
    templateId,
    isDirty: false,
  };
}

export function restoreEngineState(data: SketchData): EngineState {
  return {
    strokes: [...data.strokes],
    currentStroke: null,
    undoStack: [],
    redoStack: [],
    tool: "pen",
    color: "#000000",
    penWidth: DEFAULT_PEN_WIDTH,
    eraserWidth: DEFAULT_ERASER_WIDTH,
    canvasWidth: data.canvasWidth,
    canvasHeight: data.canvasHeight,
    templateId: data.template,
    isDirty: false,
  };
}

/**
 * Setup the background canvas (template layer).
 */
export function setupBackgroundCanvas(
  canvas: HTMLCanvasElement,
  state: EngineState
): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = state.canvasWidth * dpr;
  canvas.height = state.canvasHeight * dpr;
  canvas.style.width = `${state.canvasWidth}px`;
  canvas.style.height = `${state.canvasHeight}px`;

  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  const template = getTemplate(state.templateId);
  template.render(ctx, state.canvasWidth, state.canvasHeight);
}

/**
 * Setup the stroke canvas (drawing layer).
 */
export function setupStrokeCanvas(
  canvas: HTMLCanvasElement,
  state: EngineState
): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = state.canvasWidth * dpr;
  canvas.height = state.canvasHeight * dpr;
  canvas.style.width = `${state.canvasWidth}px`;
  canvas.style.height = `${state.canvasHeight}px`;

  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  // Re-render all existing strokes
  for (const stroke of state.strokes) {
    renderStroke(ctx, stroke);
  }
}

/**
 * Handle pointerdown: start a new stroke.
 */
export function handlePointerDown(
  state: EngineState,
  e: PointerEvent,
  canvas: HTMLCanvasElement
): void {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const point: StrokePoint = {
    x,
    y,
    pressure: e.pressure || 0.5,
    timestamp: e.timeStamp,
  };

  state.currentStroke = {
    id: newId(),
    points: [point],
    color: state.tool === "eraser" ? "#000000" : state.color,
    width: state.tool === "eraser" ? state.eraserWidth : state.penWidth,
    tool: state.tool,
  };
}

/**
 * Handle pointermove: add point to current stroke and render it.
 */
export function handlePointerMove(
  state: EngineState,
  e: PointerEvent,
  canvas: HTMLCanvasElement
): void {
  if (!state.currentStroke) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  state.currentStroke.points.push({
    x,
    y,
    pressure: e.pressure || 0.5,
    timestamp: e.timeStamp,
  });

  // Auto-grow canvas if near bottom
  if (y > state.canvasHeight - 100) {
    state.canvasHeight += CANVAS_HEIGHT_INCREMENT;
    // Caller should call setupBackgroundCanvas and setupStrokeCanvas to resize
    return;
  }

  // Render only the current stroke incrementally
  const ctx = canvas.getContext("2d")!;
  const pts = state.currentStroke.points;
  if (pts.length >= 2) {
    const prev = pts[pts.length - 2];
    const curr = pts[pts.length - 1];

    ctx.save();
    if (state.currentStroke.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = state.currentStroke.color;
    }
    ctx.lineWidth = state.currentStroke.width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Handle pointerup: finalize the current stroke.
 */
export function handlePointerUp(state: EngineState): boolean {
  if (!state.currentStroke) return false;

  // Push undo snapshot before adding the new stroke
  state.undoStack.push([...state.strokes]);
  state.redoStack = [];

  state.strokes.push(state.currentStroke);
  state.currentStroke = null;
  state.isDirty = true;

  return true; // stroke completed
}

/**
 * Undo the last stroke.
 */
export function undo(state: EngineState): boolean {
  if (state.undoStack.length === 0) return false;
  state.redoStack.push([...state.strokes]);
  state.strokes = state.undoStack.pop()!;
  state.isDirty = true;
  return true;
}

/**
 * Redo the last undone stroke.
 */
export function redo(state: EngineState): boolean {
  if (state.redoStack.length === 0) return false;
  state.undoStack.push([...state.strokes]);
  state.strokes = state.redoStack.pop()!;
  state.isDirty = true;
  return true;
}

/**
 * Clear all strokes.
 */
export function clearAll(state: EngineState): void {
  if (state.strokes.length === 0) return;
  state.undoStack.push([...state.strokes]);
  state.redoStack = [];
  state.strokes = [];
  state.isDirty = true;
}

/**
 * Full redraw of the stroke canvas (used after undo/redo/clear).
 */
export function fullRedrawStrokeCanvas(
  canvas: HTMLCanvasElement,
  state: EngineState
): void {
  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext("2d")!;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  for (const stroke of state.strokes) {
    renderStroke(ctx, stroke);
  }
}

/**
 * Resize both canvases (after auto-grow).
 */
export function resizeCanvases(
  bgCanvas: HTMLCanvasElement,
  strokeCanvas: HTMLCanvasElement,
  state: EngineState
): void {
  setupBackgroundCanvas(bgCanvas, state);
  setupStrokeCanvas(strokeCanvas, state);
}

/**
 * Serialize the current state to SketchData for storage.
 */
export function serializeState(state: EngineState): SketchData {
  return {
    version: 1,
    template: state.templateId,
    canvasWidth: state.canvasWidth,
    canvasHeight: state.canvasHeight,
    strokes: state.strokes,
    thumbnail: null, // caller fills this
  };
}

// ---- Internal helpers ----

function renderStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const { points, color, width, tool } = stroke;
  if (points.length < 2) return;

  ctx.save();
  if (tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = color;
  }
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
  ctx.restore();
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `pnpm build`
Expected: Build succeeds. (Note: `restoreEngineState` has a stray `template` field — fix if TS errors on it.)

---

## Task 5: Code Block Renderer (Widget Integration)

**Files:**
- Create: `src/widget/sketchRenderer.ts`
- Modify: `src/types/index.d.ts`

- [ ] **Step 1: Extend Window type for plugin reference**

Read `src/types/index.d.ts`, then add to the `Window` interface:

```typescript
interface Window {
  // ... existing fields ...
  sySketchNote?: {
    openEditor: (blockId: string) => void;
  };
}
```

- [ ] **Step 2: Create sketch renderer**

Write `src/widget/sketchRenderer.ts`:
```typescript
import type { SketchData } from "@/types/sketch";

type LoadDataFn = (key: string) => Promise<any>;
type OpenEditorFn = (blockId: string) => void;

const SKETCH_SUBTYPE = "sketch-note";
const STORAGE_PREFIX = "sketch:";

/**
 * Render all sketch-note code blocks in the given container.
 * Follows the same pattern as SiYuan's chartRender/mindmapRender:
 *   - Query [data-subtype="sketch-note"]:not([data-render="true"])
 *   - Mark as rendered
 *   - Replace inner DOM with custom thumbnail
 */
export function renderSketchBlocks(
  container: HTMLElement,
  loadData: LoadDataFn,
  openEditor: OpenEditorFn
): void {
  const elements = container.querySelectorAll(
    `[data-subtype="${SKETCH_SUBTYPE}"]:not([data-render="true"])`
  );

  elements.forEach((el) => {
    const blockElement = el as HTMLElement;
    blockElement.setAttribute("data-render", "true");
    renderSingleBlock(blockElement, loadData, openEditor);
  });
}

async function renderSingleBlock(
  blockElement: HTMLElement,
  loadData: LoadDataFn,
  openEditor: OpenEditorFn
): Promise<void> {
  const blockId = blockElement.getAttribute("data-node-id");
  if (!blockId) return;

  // Hide the default code block action bar (language label, copy, edit)
  const actionBar = blockElement.querySelector(".protyle-action");
  if (actionBar) {
    (actionBar as HTMLElement).style.display = "none";
  }

  // Get or create the render target
  let renderTarget = blockElement.querySelector(".sketch-note-render");
  if (!renderTarget) {
    renderTarget = document.createElement("div");
    renderTarget.className = "sketch-note-render";

    // Hide the original code content
    const codeDom = blockElement.querySelector(".protyle-wysiwyg__dom");
    if (codeDom) {
      (codeDom as HTMLElement).style.display = "none";
    }

    blockElement.appendChild(renderTarget);
  }

  // Load sketch data from plugin storage
  const key = `${STORAGE_PREFIX}${blockId}`;
  const data: SketchData | null = await loadData(key);

  if (data && data.thumbnail) {
    renderTarget.innerHTML = "";
    renderTarget.className = "sketch-note-render sketch-note-render--has-content";

    const img = document.createElement("img");
    img.src = data.thumbnail;
    img.alt = "Sketch Note";
    img.className = "sketch-note-thumbnail";
    renderTarget.appendChild(img);

    const label = document.createElement("div");
    label.className = "sketch-note-label";
    label.textContent = "✏️";
    renderTarget.appendChild(label);
  } else {
    renderTarget.innerHTML = "";
    renderTarget.className = "sketch-note-render sketch-note-render--empty";

    const placeholder = document.createElement("div");
    placeholder.className = "sketch-note-placeholder";
    placeholder.textContent = "✏️ 点击编辑手写笔记";
    renderTarget.appendChild(placeholder);
  }

  // Click handler to open fullscreen editor
  renderTarget.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    openEditor(blockId);
  });
}
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `pnpm build`
Expected: Build succeeds.

---

## Task 6: Editor Components

**Files:**
- Create: `src/editor/SketchEditor.vue`
- Create: `src/editor/SketchCanvas.vue`
- Create: `src/editor/SketchToolbar.vue`

- [ ] **Step 1: Create SketchToolbar.vue**

Write `src/editor/SketchToolbar.vue`:
```vue
<template>
  <div class="sketch-toolbar">
    <div class="sketch-toolbar__colors">
      <button
        v-for="c in colors"
        :key="c"
        class="sketch-toolbar__color-btn"
        :class="{ 'sketch-toolbar__color-btn--active': modelColor === c && modelTool === 'pen' }"
        :style="{ backgroundColor: c }"
        @click="selectColor(c)"
      />
    </div>

    <div class="sketch-toolbar__separator" />

    <button
      class="sketch-toolbar__tool-btn"
      :class="{ 'sketch-toolbar__tool-btn--active': modelTool === 'pen' }"
      @click="selectTool('pen')"
    >
      ✏️
    </button>
    <button
      class="sketch-toolbar__tool-btn"
      :class="{ 'sketch-toolbar__tool-btn--active': modelTool === 'eraser' }"
      @click="selectTool('eraser')"
    >
      🧹
    </button>

    <div class="sketch-toolbar__separator" />

    <button class="sketch-toolbar__action-btn" :disabled="!canUndo" @click="$emit('undo')">↩️</button>
    <button class="sketch-toolbar__action-btn" :disabled="!canRedo" @click="$emit('redo')">↪️</button>
    <button class="sketch-toolbar__action-btn" @click="$emit('clear')">🗑️</button>
  </div>
</template>

<script setup lang="ts">
import type { SketchTool } from "@/types/sketch";
import { PRESET_COLORS } from "@/types/sketch";

const props = defineProps<{
  modelColor: string;
  modelTool: SketchTool;
  canUndo: boolean;
  canRedo: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelColor", value: string): void;
  (e: "update:modelTool", value: SketchTool): void;
  (e: "undo"): void;
  (e: "redo"): void;
  (e: "clear"): void;
}>();

const colors = PRESET_COLORS;

function selectColor(c: string) {
  emit("update:modelColor", c);
  emit("update:modelTool", "pen");
}

function selectTool(t: SketchTool) {
  emit("update:modelTool", t);
}
</script>

<style scoped>
.sketch-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--b3-theme-surface);
  border-top: 1px solid var(--b3-border-color);
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  justify-content: center;
}

.sketch-toolbar__colors {
  display: flex;
  gap: 6px;
}

.sketch-toolbar__color-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.15s;
}

.sketch-toolbar__color-btn--active {
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 2px var(--b3-theme-primary-light);
}

.sketch-toolbar__separator {
  width: 1px;
  height: 24px;
  background: var(--b3-border-color);
  margin: 0 4px;
}

.sketch-toolbar__tool-btn,
.sketch-toolbar__action-btn {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface);
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

.sketch-toolbar__tool-btn--active {
  background: var(--b3-theme-primary-light);
  border-color: var(--b3-theme-primary);
}

.sketch-toolbar__action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
```

- [ ] **Step 2: Create SketchCanvas.vue**

Write `src/editor/SketchCanvas.vue`:
```vue
<template>
  <div class="sketch-canvas-container" ref="containerRef">
    <canvas ref="bgCanvasRef" class="sketch-canvas sketch-canvas--bg" />
    <canvas
      ref="strokeCanvasRef"
      class="sketch-canvas sketch-canvas--stroke"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onPointerUp"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import type { SketchData, SketchTool } from "@/types/sketch";
import {
  createEngineState,
  restoreEngineState,
  setupBackgroundCanvas,
  setupStrokeCanvas,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  undo as engineUndo,
  redo as engineRedo,
  clearAll as engineClear,
  fullRedrawStrokeCanvas,
  resizeCanvases,
  serializeState,
} from "@/engine/canvasEngine";
import type { EngineState } from "@/engine/canvasEngine";

const props = defineProps<{
  initialData: SketchData | null;
  tool: SketchTool;
  color: string;
}>();

const emit = defineEmits<{
  (e: "update:canUndo", value: boolean): void;
  (e: "update:canRedo", value: boolean): void;
  (e: "heightChanged", height: number): void;
}>();

const containerRef = ref<HTMLDivElement>();
const bgCanvasRef = ref<HTMLCanvasElement>();
const strokeCanvasRef = ref<HTMLCanvasElement>();

let state: EngineState;

onMounted(() => {
  if (!bgCanvasRef.value || !strokeCanvasRef.value) return;

  state = props.initialData
    ? restoreEngineState(props.initialData)
    : createEngineState("blank");

  setupBackgroundCanvas(bgCanvasRef.value, state);
  setupStrokeCanvas(strokeCanvasRef.value, state);

  updateUndoRedoState();
});

// Sync tool/color from parent
watch(() => props.tool, (t) => { if (state) state.tool = t; });
watch(() => props.color, (c) => { if (state) state.color = c; });

function getCanvas(): HTMLCanvasElement {
  return strokeCanvasRef.value!;
}

function onPointerDown(e: PointerEvent) {
  e.preventDefault();
  (e.target as HTMLElement).setPointerCapture(e.pointerId);
  handlePointerDown(state, e, getCanvas());
}

function onPointerMove(e: PointerEvent) {
  e.preventDefault();
  const prevHeight = state.canvasHeight;
  handlePointerMove(state, e, getCanvas());

  if (state.canvasHeight !== prevHeight) {
    resizeCanvases(bgCanvasRef.value!, strokeCanvasRef.value!, state);
    emit("heightChanged", state.canvasHeight);
  }
}

function onPointerUp(e: PointerEvent) {
  const completed = handlePointerUp(state);
  if (completed) {
    updateUndoRedoState();
  }
}

function updateUndoRedoState() {
  emit("update:canUndo", state.undoStack.length > 0);
  emit("update:canRedo", state.redoStack.length > 0);
}

function doUndo() {
  engineUndo(state);
  fullRedrawStrokeCanvas(getCanvas(), state);
  updateUndoRedoState();
}

function doRedo() {
  engineRedo(state);
  fullRedrawStrokeCanvas(getCanvas(), state);
  updateUndoRedoState();
}

function doClear() {
  engineClear(state);
  fullRedrawStrokeCanvas(getCanvas(), state);
  updateUndoRedoState();
}

function getData(): SketchData {
  const data = serializeState(state);
  return data;
}

function getState(): EngineState {
  return state;
}

defineExpose({ doUndo, doRedo, doClear, getData, getState });
</script>

<style scoped>
.sketch-canvas-container {
  position: relative;
  width: fit-content;
  margin: 0 auto;
  touch-action: none;
}

.sketch-canvas {
  display: block;
}

.sketch-canvas--bg {
  position: relative;
}

.sketch-canvas--stroke {
  position: absolute;
  top: 0;
  left: 0;
  cursor: crosshair;
}
</style>
```

- [ ] **Step 3: Create SketchEditor.vue**

Write `src/editor/SketchEditor.vue`:
```vue
<template>
  <div v-if="visible" class="sketch-editor">
    <div class="sketch-editor__header">
      <button class="sketch-editor__back" @click="goBack">← {{ t("back") }}</button>
      <select class="sketch-editor__template-select" v-model="currentTemplate" @change="onTemplateChange">
        <option v-for="tpl in templates" :key="tpl.id" :value="tpl.id">
          {{ t(tpl.nameKey) }}
        </option>
      </select>
      <span class="sketch-editor__title">{{ t("sketchNote") }}</span>
      <button class="sketch-editor__save" @click="doSave">{{ t("save") }}</button>
    </div>

    <div class="sketch-editor__body">
      <SketchCanvas
        ref="canvasRef"
        :initialData="loadedData"
        :tool="activeTool"
        :color="activeColor"
        @update:canUndo="canUndo = $event"
        @update:canRedo="canRedo = $event"
        @heightChanged="onHeightChanged"
      />
    </div>

    <SketchToolbar
      :modelColor="activeColor"
      :modelTool="activeTool"
      :canUndo="canUndo"
      :canRedo="canRedo"
      @update:modelColor="activeColor = $event"
      @update:modelTool="activeTool = $event"
      @undo="canvasRef?.doUndo()"
      @redo="canvasRef?.doRedo()"
      @clear="canvasRef?.doClear()"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import type { SketchData, SketchTool } from "@/types/sketch";
import { PRESET_COLORS } from "@/types/sketch";
import { getAllTemplates } from "@/template";
import SketchCanvas from "./SketchCanvas.vue";
import SketchToolbar from "./SketchToolbar.vue";

const props = defineProps<{
  blockId: string;
  initialData: SketchData | null;
  i18n: Record<string, string>;
  saveData: (key: string, data: any) => Promise<void>;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

function t(key: string): string {
  return props.i18n[key] ?? key;
}

const visible = ref(false);
const canvasRef = ref<InstanceType<typeof SketchCanvas>>();
const activeTool = ref<SketchTool>("pen");
const activeColor = ref(PRESET_COLORS[0]);
const canUndo = ref(false);
const canRedo = ref(false);
const currentTemplate = ref(props.initialData?.template ?? "blank");
const templates = getAllTemplates();
const loadedData = ref<SketchData | null>(props.initialData);

onMounted(() => {
  visible.value = true;
  document.body.style.overflow = "hidden";
});

onUnmounted(() => {
  document.body.style.overflow = "";
});

function onTemplateChange() {
  // Template change requires re-rendering background canvas.
  // For MVP, we reload the editor. A future version could swap in-place.
}

function onHeightChanged(height: number) {
  // Scroll to keep the writing area visible
}

async function doSave() {
  if (!canvasRef.value) return;

  const data = canvasRef.value.getData();
  // Generate thumbnail
  const { thumbnailCanvas } = await import("@/storage/thumbnail");
  data.thumbnail = thumbnailCanvas(data.strokes, data.template, data.canvasHeight);
  data.template = currentTemplate.value;

  const key = `sketch:${props.blockId}`;
  await props.saveData(key, data);

  emit("close");
}

async function goBack() {
  await doSave();
}
</script>

<style scoped>
.sketch-editor {
  position: fixed;
  inset: 0;
  z-index: 999;
  background: var(--b3-theme-background);
  display: flex;
  flex-direction: column;
}

.sketch-editor__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: var(--b3-theme-surface);
  border-bottom: 1px solid var(--b3-border-color);
  flex-shrink: 0;
}

.sketch-editor__back,
.sketch-editor__save {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface);
  cursor: pointer;
  font-size: 14px;
}

.sketch-editor__save {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  border-color: var(--b3-theme-primary);
  margin-left: auto;
}

.sketch-editor__template-select {
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface);
  font-size: 13px;
}

.sketch-editor__title {
  font-weight: 500;
  font-size: 15px;
  color: var(--b3-theme-on-surface);
}

.sketch-editor__body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 0 60px;
  touch-action: none;
}
</style>
```

- [ ] **Step 4: Verify TypeScript compilation**

Run: `pnpm build`
Expected: Build succeeds.

---

## Task 7: App.vue Rewrite & Plugin Entry

**Files:**
- Rewrite: `src/App.vue`
- Modify: `src/index.ts`
- Modify: `src/main.ts`
- Rewrite: `src/index.scss`

- [ ] **Step 1: Rewrite App.vue**

Write `src/App.vue`:
```vue
<template>
  <SketchEditor
    v-if="editorVisible"
    :blockId="editorBlockId"
    :initialData="editorData"
    :i18n="pluginI18n"
    :saveData="pluginSaveData"
    @close="closeEditor"
  />
</template>

<script setup lang="ts">
import { ref } from "vue";
import SketchEditor from "@/editor/SketchEditor.vue";
import type { SketchData } from "@/types/sketch";
import { storageKey, loadSketchData } from "@/storage";

const editorVisible = ref(false);
const editorBlockId = ref("");
const editorData = ref<SketchData | null>(null);
const pluginI18n = ref<Record<string, string>>({});
const pluginSaveData = ref<(key: string, data: any) => Promise<void>>(async () => {});

let loadDataFn: (key: string) => Promise<any> = async () => null;

export function setI18n(i18n: Record<string, string>) {
  pluginI18n.value = i18n;
}

export function setSaveDataFn(fn: (key: string, data: any) => Promise<void>) {
  pluginSaveData.value = fn;
}

export function setLoadDataFn(fn: (key: string) => Promise<any>) {
  loadDataFn = fn;
}

export async function openSketchEditor(blockId: string) {
  editorBlockId.value = blockId;
  editorData.value = await loadSketchData(loadDataFn, blockId);
  editorVisible.value = true;
}

function closeEditor() {
  const savedBlockId = editorBlockId.value;
  editorVisible.value = false;
  editorBlockId.value = "";
  editorData.value = null;
  // Notify renderer to refresh the thumbnail
  window.dispatchEvent(new CustomEvent("sketch-note-saved", { detail: { blockId: savedBlockId } }));
}
</script>
```

- [ ] **Step 2: Update main.ts**

Read `src/main.ts`, then rewrite:
```typescript
import { createApp } from "vue";
import App from "./App.vue";
import { setI18n, setSaveDataFn, setLoadDataFn } from "./App.vue";
import type { Plugin } from "siyuan";

let app: ReturnType<typeof createApp> | null = null;
let container: HTMLDivElement | null = null;

export function usePlugin(pluginProps?: Plugin): Plugin | undefined {
  if (pluginProps) {
    (window as any)._sketchNotePlugin = pluginProps;
  }
  return (window as any)._sketchNotePlugin;
}

export function init(plugin: Plugin) {
  container = document.createElement("div");
  container.className = "sketch-note-app";
  document.body.appendChild(container);

  app = createApp(App);
  app.mount(container);

  // Wire up plugin APIs to Vue app
  setSaveDataFn((key, data) => plugin.saveData(key, data));
  setLoadDataFn((key) => plugin.loadData(key));
}

export function destroy() {
  if (app) {
    app.unmount();
    app = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
}
```

- [ ] **Step 3: Update plugin entry (index.ts)**

Read `src/index.ts`, then rewrite:
```typescript
import {
  Plugin,
  fetchSyncPost,
  getFrontend,
} from "siyuan";
import { init, destroy } from "./main";
import { renderSketchBlocks } from "./widget/sketchRenderer";
import { openSketchEditor, setI18n } from "./App.vue";
import { storageKey } from "./storage";

export default class SketchNotePlugin extends Plugin {
  public isMobile = false;
  public isBrowser = false;
  public isElectron = false;

  async onload() {
    const frontEnd = getFrontend();
    this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";
    this.isBrowser = frontEnd === "browser-desktop" || frontEnd === "browser-mobile";
    this.isElectron = frontEnd === "desktop";

    // Load i18n
    const i18nData = await this.loadData("i18n");
    // Use built-in i18n from plugin SDK
    setI18n(this.i18n ?? {});

    // Initialize Vue app
    init(this);

    // Register event listeners for block rendering
    this.eventBus.on("loaded-protyle-static", this.onProtyleLoaded);
    this.eventBus.on("loaded-protyle-dynamic", this.onProtyleLoaded);

    // Add top bar button
    this.addTopBar({
      icon: "iconPencil",
      title: this.i18n?.insertSketch ?? "Insert Sketch Block",
      callback: () => this.insertSketchBlock(),
    });

    // Register command
    this.addCommand({
      langKey: "insertSketch",
      hotkey: "Ctrl+Shift+S",
      callback: () => this.insertSketchBlock(),
    });

    // Expose openEditor for renderer callbacks
    window.sySketchNote = {
      openEditor: (blockId: string) => openSketchEditor(blockId),
    };
  }

  onunload() {
    this.eventBus.off("loaded-protyle-static", this.onProtyleLoaded);
    this.eventBus.off("loaded-protyle-dynamic", this.onProtyleLoaded);
    destroy();
    delete window.sySketchNote;
  }

  private onProtyleLoaded = (event: CustomEvent) => {
    const { protyle } = event.detail;
    if (!protyle?.wysiwyg?.element) return;

    const container = protyle.wysiwyg.element;
    renderSketchBlocks(container, (key) => this.loadData(key), (blockId) => {
      openSketchEditor(blockId);
    });
  };

  private async insertSketchBlock() {
    const blockId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    // Insert a code block with sketch-note language
    const data = `\`\`\`sketch-note\n${blockId}\n\`\`\``;

    try {
      const result = await fetchSyncPost("/api/block/insertBlock", {
        dataType: "markdown",
        data,
        nextID: "",
        previousID: "",
        parentID: "",
      });

      if (result.code === 0) {
        // Initialize empty sketch data in plugin storage
        await this.saveData(storageKey(blockId), {
          version: 1,
          template: "blank",
          canvasWidth: 800,
          canvasHeight: 1200,
          strokes: [],
          thumbnail: null,
        });

        // Open the editor
        await openSketchEditor(blockId);
      }
    } catch (e) {
      console.error("[Sketch Note] Failed to insert block:", e);
    }
  }
}
```

- [ ] **Step 4: Write global styles**

Write `src/index.scss`:
```scss
.sketch-note-app {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100dvh;
  pointer-events: none;
  z-index: 998;
}

// Sketch block rendering styles
.sketch-note-render {
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  transition: box-shadow 0.2s;
  position: relative;

  &:hover {
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
  }
}

.sketch-note-render--has-content {
  .sketch-note-thumbnail {
    display: block;
    max-width: 100%;
    border-radius: 4px;
  }

  .sketch-note-label {
    position: absolute;
    top: 8px;
    right: 8px;
    font-size: 14px;
    opacity: 0;
    transition: opacity 0.2s;
  }

  &:hover .sketch-note-label {
    opacity: 1;
  }
}

.sketch-note-render--empty {
  padding: 24px;
  border: 2px dashed var(--b3-border-color);
  text-align: center;
  color: var(--b3-theme-on-surface-light);
  background: var(--b3-theme-surface);
}

.sketch-note-placeholder {
  font-size: 14px;
}

// Editor styles
.sketch-editor {
  pointer-events: all;
}
```

- [ ] **Step 5: Verify build**

Run: `pnpm build`
Expected: Build succeeds, `dist/index.js` contains the plugin code.

---

## Task 8: Manual Integration Test

- [ ] **Step 1: Start dev mode**

Run: `pnpm dev`
Expected: Vite watches and builds to the SiYuan workspace plugin directory.

- [ ] **Step 2: Enable plugin in SiYuan**

1. Open SiYuan Note
2. Go to Settings → Marketplace → Installed
3. Enable "Sketch Note" plugin
4. Verify top bar shows the pencil icon

- [ ] **Step 3: Test block creation**

1. Open a document
2. Click the top bar "Insert Sketch Block" button
3. Verify: a code block with language "sketch-note" appears
4. Verify: fullscreen editor opens automatically

- [ ] **Step 4: Test drawing**

1. In the editor, draw with the default black pen
2. Verify: strokes appear on the canvas in real-time
3. Switch to red color, draw more
4. Switch to eraser, erase part of a stroke
5. Verify: eraser removes pixels

- [ ] **Step 5: Test undo/redo**

1. Draw several strokes
2. Click undo multiple times
3. Verify: strokes disappear in reverse order
4. Click redo
5. Verify: last undone stroke reappears

- [ ] **Step 6: Test save and display**

1. Click "Save" (or "Back")
2. Verify: editor closes
3. Verify: a thumbnail image appears in the code block
4. Verify: hovering shows the pencil label

- [ ] **Step 7: Test re-edit (二次编辑)**

1. Click the thumbnail
2. Verify: editor opens with all strokes restored
3. Draw more strokes
4. Save and verify thumbnail updates

- [ ] **Step 8: Test template switching**

1. Open editor for a new sketch block
2. Switch template from "Blank" to "Grid"
3. Verify: background changes to grid pattern
4. Draw and save
5. Verify: thumbnail shows grid background

- [ ] **Step 9: Test on mobile (if available)**

1. Open SiYuan on a mobile device or browser with touch simulation
2. Test touch drawing
3. Verify: page scrolling is blocked during drawing
4. Verify: save and re-edit work correctly

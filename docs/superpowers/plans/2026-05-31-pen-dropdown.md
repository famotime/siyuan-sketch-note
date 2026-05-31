# 画笔下拉菜单 + 笔型系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在工具栏的画笔和荧光笔按钮上添加下拉菜单，支持切换 4 种笔型（铅笔/圆珠笔/钢笔/毛笔）和 3 种荧光笔笔尖（圆形/方形/水彩），每种有独立预置和渲染效果。

**Architecture:** 笔型通过 `ToolPreset` 上的可选字段 `penSubtype` / `highlighterSubtype` 区分，不改变 `SketchTool` 类型。新增 `ToolDropdown.vue` 可复用下拉组件，渲染引擎根据笔型应用不同压感曲线。

**Tech Stack:** Vue 3 + TypeScript, HTML5 Canvas, IconPark SVG icons

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/types/sketch.ts` | 新增 PenSubtype、HighlighterSubtype 类型；ToolPreset 增加字段；新增默认预置常量 |
| Modify | `src/tools/presets.ts` | 各笔型默认预置值；normalizeToolPreset 填充默认 subtype |
| Create | `src/editor/ToolDropdown.vue` | 可复用下拉组件（触发器 + 弹出面板 + click-outside） |
| Create | `src/editor/penSubtypeIcons.ts` | 各笔型/笔尖的自定义 SVG 图标映射 |
| Modify | `src/editor/ToolBar.vue` | 画笔/荧光笔按钮改为下拉触发器，集成 ToolDropdown |
| Modify | `src/editor/SketchEditor.vue` | 处理笔型切换事件、应用对应预置 |
| Modify | `src/engine/canvasEngine.ts` | 根据笔型应用不同压力曲线和笔触效果 |
| Modify | `src/engine/strokeSmoothing.ts` | 新增 getPenSubtypePressureWidth 函数 |
| Modify | `src/editor/FloatingToolbar.vue` | 颜色/粗细控制适配新笔型 |
| Modify | `src/editor/iconParkIcons.ts` | 注册新增图标名称 |
| Modify | `src/editor/toolbarModel.ts` | getToolButtonActiveState 适配笔型 |
| Modify | `src/i18n/en_US.json` | 新增笔型翻译 key |
| Modify | `src/i18n/zh_CN.json` | 新增笔型翻译 key |
| Modify | `src/storage/migrations.ts` | 旧数据迁移填充默认 subtype |
| Create | `src/editor/ToolDropdown.test.ts` | 下拉组件单元测试 |
| Create | `src/engine/penSubtypePressure.test.ts` | 压感曲线单元测试 |

---

### Task 1: 类型系统 + 默认预置

**Files:**
- Modify: `src/types/sketch.ts`
- Modify: `src/tools/presets.ts`
- Create: `src/engine/penSubtypePressure.test.ts`

- [ ] **Step 1: 在 sketch.ts 中新增类型和常量**

在 `src/types/sketch.ts` 的 `SketchTool` 类型定义之后（第 71 行后）添加：

```typescript
export type PenSubtype = "pencil" | "ballpoint" | "fountain" | "brush";
export type HighlighterSubtype = "round" | "square" | "watercolor";

export const DEFAULT_PEN_SUBTYPE: PenSubtype = "ballpoint";
export const DEFAULT_HIGHLIGHTER_SUBTYPE: HighlighterSubtype = "round";
```

在 `ToolPreset` 接口中（第 78 行 `mode` 字段后）添加：

```typescript
  penSubtype?: PenSubtype;
  highlighterSubtype?: HighlighterSubtype;
```

在文件末尾（第 104 行后）添加各笔型默认预置常量：

```typescript
export const PEN_SUBTYPE_DEFAULTS: Record<PenSubtype, { color: string; width: number; opacity: number }> = {
  pencil:    { color: "#4a4a4a", width: 2,   opacity: 0.85 },
  ballpoint: { color: "#1a237e", width: 1.5, opacity: 1.0 },
  fountain:  { color: "#1a1a2e", width: 2,   opacity: 0.95 },
  brush:     { color: "#1a1a2e", width: 3,   opacity: 0.9 },
};

export const HIGHLIGHTER_SUBTYPE_DEFAULTS: Record<HighlighterSubtype, { color: string; width: number; opacity: number }> = {
  round:      { color: "#fff176", width: 18, opacity: 0.45 },
  square:     { color: "#fff176", width: 18, opacity: 0.45 },
  watercolor: { color: "#64b5f6", width: 24, opacity: 0.3 },
};
```

- [ ] **Step 2: 修改 presets.ts 支持 subtype**

在 `src/tools/presets.ts` 中，更新 import 以包含新类型：

```typescript
import type {
  SketchTool,
  ToolPreset,
  ToolPresetCollection,
  PenSubtype,
  HighlighterSubtype,
} from "@/types/sketch";
import {
  DEFAULT_ERASER_WIDTH,
  DEFAULT_HIGHLIGHTER_WIDTH,
  DEFAULT_PEN_WIDTH,
  DEFAULT_PEN_SUBTYPE,
  DEFAULT_HIGHLIGHTER_SUBTYPE,
  PEN_SUBTYPE_DEFAULTS,
  HIGHLIGHTER_SUBTYPE_DEFAULTS,
} from "@/types/sketch";
```

在 `createDefaultToolPresets()` 函数中（第 17-41 行），更新 pen 和 highlighter 预置：

```typescript
export function createDefaultToolPresets(): ToolPresetCollection {
  return {
    pen: {
      tool: "pen",
      ...PEN_SUBTYPE_DEFAULTS[DEFAULT_PEN_SUBTYPE],
      mode: "ink",
      penSubtype: DEFAULT_PEN_SUBTYPE,
    },
    highlighter: {
      tool: "highlighter",
      ...HIGHLIGHTER_SUBTYPE_DEFAULTS[DEFAULT_HIGHLIGHTER_SUBTYPE],
      mode: "marker",
      highlighterSubtype: DEFAULT_HIGHLIGHTER_SUBTYPE,
    },
    eraser: {
      tool: "eraser",
      color: "#000000",
      width: DEFAULT_ERASER_WIDTH,
      opacity: 1,
      mode: "pixel",
    },
  };
}
```

在 `normalizeToolPreset()` 函数中（第 43-49 行），添加默认 subtype 填充：

```typescript
export function normalizeToolPreset(preset: ToolPreset): ToolPreset {
  const normalized = {
    ...preset,
    width: clamp(Number.isFinite(preset.width) ? preset.width : MIN_WIDTH, MIN_WIDTH, MAX_WIDTH),
    opacity: clamp(Number.isFinite(preset.opacity) ? preset.opacity : MAX_OPACITY, MIN_OPACITY, MAX_OPACITY),
  };
  if (normalized.tool === "pen" && !normalized.penSubtype) {
    normalized.penSubtype = DEFAULT_PEN_SUBTYPE;
  }
  if (normalized.tool === "highlighter" && !normalized.highlighterSubtype) {
    normalized.highlighterSubtype = DEFAULT_HIGHLIGHTER_SUBTYPE;
  }
  return normalized;
}
```

新增 `applyPenSubtypeDefaults()` 和 `applyHighlighterSubtypeDefaults()` 函数：

```typescript
export function applyPenSubtypeDefaults(
  presets: ToolPresetCollection,
  subtype: PenSubtype,
): ToolPresetCollection {
  const defaults = PEN_SUBTYPE_DEFAULTS[subtype];
  return {
    ...presets,
    pen: normalizeToolPreset({
      ...presets.pen,
      ...defaults,
      tool: "pen",
      mode: "ink",
      penSubtype: subtype,
    }),
  };
}

export function applyHighlighterSubtypeDefaults(
  presets: ToolPresetCollection,
  subtype: HighlighterSubtype,
): ToolPresetCollection {
  const defaults = HIGHLIGHTER_SUBTYPE_DEFAULTS[subtype];
  return {
    ...presets,
    highlighter: normalizeToolPreset({
      ...presets.highlighter,
      ...defaults,
      tool: "highlighter",
      mode: "marker",
      highlighterSubtype: subtype,
    }),
  };
}
```

- [ ] **Step 3: 编写压感曲线单元测试**

创建 `src/engine/penSubtypePressure.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { getPenSubtypePressureWidth, getHighlighterSubtypeLineCap } from "./strokeSmoothing";

describe("getPenSubtypePressureWidth", () => {
  it("pencil: low sensitivity, range 0.7x-1.2x", () => {
    expect(getPenSubtypePressureWidth(10, 0, "pencil")).toBeCloseTo(7);
    expect(getPenSubtypePressureWidth(10, 0.5, "pencil")).toBeCloseTo(9.5);
    expect(getPenSubtypePressureWidth(10, 1, "pencil")).toBeCloseTo(12);
  });

  it("ballpoint: near-constant, range 0.9x-1.1x", () => {
    expect(getPenSubtypePressureWidth(10, 0, "ballpoint")).toBeCloseTo(9);
    expect(getPenSubtypePressureWidth(10, 0.5, "ballpoint")).toBeCloseTo(10);
    expect(getPenSubtypePressureWidth(10, 1, "ballpoint")).toBeCloseTo(11);
  });

  it("fountain: high sensitivity, range 0.5x-2.0x", () => {
    const low = getPenSubtypePressureWidth(10, 0, "fountain");
    const high = getPenSubtypePressureWidth(10, 1, "fountain");
    expect(low).toBeLessThan(6);
    expect(high).toBeGreaterThan(18);
  });

  it("brush: very high sensitivity, range 0.3x-2.5x", () => {
    const low = getPenSubtypePressureWidth(10, 0, "brush");
    const high = getPenSubtypePressureWidth(10, 1, "brush");
    expect(low).toBeLessThan(5);
    expect(high).toBeGreaterThan(20);
  });

  it("defaults to ballpoint for undefined subtype", () => {
    const result = getPenSubtypePressureWidth(10, 0.5, undefined);
    expect(result).toBeCloseTo(getPenSubtypePressureWidth(10, 0.5, "ballpoint"));
  });
});

describe("getHighlighterSubtypeLineCap", () => {
  it("round subtype returns 'round'", () => {
    expect(getHighlighterSubtypeLineCap("round")).toBe("round");
  });

  it("square subtype returns 'butt'", () => {
    expect(getHighlighterSubtypeLineCap("square")).toBe("butt");
  });

  it("watercolor subtype returns 'round'", () => {
    expect(getHighlighterSubtypeLineCap("watercolor")).toBe("round");
  });

  it("defaults to 'round' for undefined subtype", () => {
    expect(getHighlighterSubtypeLineCap(undefined)).toBe("round");
  });
});
```

- [ ] **Step 4: 运行测试确认失败**

Run: `npx vitest run src/engine/penSubtypePressure.test.ts`
Expected: FAIL — `getPenSubtypePressureWidth` 尚未定义

- [ ] **Step 5: 在 strokeSmoothing.ts 中实现压感曲线**

在 `src/engine/strokeSmoothing.ts` 末尾（第 70 行后）添加：

```typescript
import type { PenSubtype, HighlighterSubtype } from "@/types/sketch";

function sigmoid(t: number): number {
  return 1 / (1 + Math.exp(-10 * (t - 0.5)));
}

export function getPenSubtypePressureWidth(
  baseWidth: number,
  pressure: number,
  penSubtype: PenSubtype | undefined,
): number {
  const p = Math.min(1, Math.max(0, Number.isFinite(pressure) ? pressure : 0.5));
  let multiplier: number;
  switch (penSubtype) {
    case "pencil":
      multiplier = 0.7 + p * 0.5;
      break;
    case "fountain":
      multiplier = 0.5 + sigmoid(p) * 1.5;
      break;
    case "brush":
      multiplier = 0.3 + sigmoid(p) * 2.2;
      break;
    case "ballpoint":
    default:
      multiplier = 0.9 + p * 0.2;
      break;
  }
  return baseWidth * multiplier;
}

export function getPenSubtypeOpacityMultiplier(
  pressure: number,
  penSubtype: PenSubtype | undefined,
): number {
  const p = Math.min(1, Math.max(0, Number.isFinite(pressure) ? pressure : 0.5));
  switch (penSubtype) {
    case "pencil":
      return 0.8 + p * 0.2;
    case "brush":
      return 0.85 + p * 0.15;
    case "fountain":
      return 0.9 + p * 0.1;
    case "ballpoint":
    default:
      return 1;
  }
}

export function getHighlighterSubtypeLineCap(
  subtype: HighlighterSubtype | undefined,
): CanvasLineCap {
  return subtype === "square" ? "butt" : "round";
}

export function getSquareHighlighterWidthMultiplier(
  angle: number,
): number {
  const absAngle = Math.abs(angle);
  const normalized = absAngle / (Math.PI / 2);
  return 0.4 + (1 - normalized) * 0.6;
}
```

- [ ] **Step 6: 运行测试确认通过**

Run: `npx vitest run src/engine/penSubtypePressure.test.ts`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add src/types/sketch.ts src/tools/presets.ts src/engine/strokeSmoothing.ts src/engine/penSubtypePressure.test.ts
git commit -m "feat: 新增笔型类型系统和压感曲线函数"
```

---

### Task 2: 图标资产

**Files:**
- Create: `src/editor/penSubtypeIcons.ts`

- [ ] **Step 1: 创建笔型图标映射文件**

创建 `src/editor/penSubtypeIcons.ts`：

```typescript
import type { PenSubtype, HighlighterSubtype } from "@/types/sketch";

const PENCIL_SVG = `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M38.4 6L42 9.6L15.6 36H12V32.4L38.4 6Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M8 42H42" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M33 11.6L36.6 15.2" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const BALLPOINT_SVG = `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5.32 43.5L13.81 43.5L44.92 12.39L36.44 3.9L5.32 35.01L5.32 43.5Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M27.95 12.39L36.44 20.87" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const FOUNTAIN_SVG = `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24 4V18" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M18 18H30L34 42H14L18 18Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M14 30H34" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M20 4L28 4" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><circle cx="24" cy="44" r="2" fill="currentColor" stroke="none"/></svg>`;

const BRUSH_SVG = `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24 4C24 4 18 14 18 22C18 25.3 20.7 28 24 28C27.3 28 30 25.3 30 22C30 14 24 4 24 4Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M20 28V44" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M28 28V44" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M16 44H32" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>`;

const ROUND_HIGHLIGHTER_SVG = `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M34 5H6V20H34V5Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M34.03 12H43V28.1L19 31.2V43" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const SQUARE_HIGHLIGHTER_SVG = `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M34 5H6V20H34V5Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M34.03 12H43V28.1L19 31.2V43" stroke="currentColor" stroke-width="4" stroke-linecap="butt" stroke-linejoin="miter"/><path d="M15 31H23" stroke="currentColor" stroke-width="6" stroke-linecap="butt"/></svg>`;

const WATERCOLOR_SVG = `<svg width="1em" height="1em" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M34 5H6V20H34V5Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M34.03 12H43V28.1L19 31.2V43" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="24" cy="36" r="4" fill="none" stroke="currentColor" stroke-width="2" opacity="0.6"/><circle cx="20" cy="38" r="3" fill="none" stroke="currentColor" stroke-width="2" opacity="0.4"/></svg>`;

export const PEN_SUBTYPE_ICONS: Record<PenSubtype, string> = {
  pencil: PENCIL_SVG,
  ballpoint: BALLPOINT_SVG,
  fountain: FOUNTAIN_SVG,
  brush: BRUSH_SVG,
};

export const HIGHLIGHTER_SUBTYPE_ICONS: Record<HighlighterSubtype, string> = {
  round: ROUND_HIGHLIGHTER_SVG,
  square: SQUARE_HIGHLIGHTER_SVG,
  watercolor: WATERCOLOR_SVG,
};

export const PEN_SUBTYPE_LABEL_KEYS: Record<PenSubtype, string> = {
  pencil: "penPencil",
  ballpoint: "penBallpoint",
  fountain: "penFountain",
  brush: "penBrush",
};

export const HIGHLIGHTER_SUBTYPE_LABEL_KEYS: Record<HighlighterSubtype, string> = {
  round: "highlighterRound",
  square: "highlighterSquare",
  watercolor: "highlighterWatercolor",
};
```

- [ ] **Step 2: 提交**

```bash
git add src/editor/penSubtypeIcons.ts
git commit -m "feat: 添加笔型/笔尖图标资产和标签映射"
```

---

### Task 3: i18n 翻译

**Files:**
- Modify: `src/i18n/en_US.json`
- Modify: `src/i18n/zh_CN.json`

- [ ] **Step 1: 添加英文翻译**

在 `src/i18n/en_US.json` 的 `"pen": "Pen"` 行之后添加：

```json
  "penPencil": "Pencil",
  "penBallpoint": "Ballpoint Pen",
  "penFountain": "Fountain Pen",
  "penBrush": "Brush Pen",
  "highlighterRound": "Round Tip",
  "highlighterSquare": "Square Tip",
  "highlighterWatercolor": "Watercolor",
```

- [ ] **Step 2: 添加中文翻译**

在 `src/i18n/zh_CN.json` 的 `"pen": "画笔"` 行之后添加：

```json
  "penPencil": "铅笔",
  "penBallpoint": "圆珠笔",
  "penFountain": "钢笔",
  "penBrush": "毛笔",
  "highlighterRound": "圆形笔尖",
  "highlighterSquare": "方形笔尖",
  "highlighterWatercolor": "水彩笔",
```

- [ ] **Step 3: 提交**

```bash
git add src/i18n/en_US.json src/i18n/zh_CN.json
git commit -m "feat: 添加笔型/笔尖的中英文翻译"
```

---

### Task 4: ToolDropdown 下拉组件

**Files:**
- Create: `src/editor/ToolDropdown.vue`
- Create: `src/editor/ToolDropdown.test.ts`

- [ ] **Step 1: 创建 ToolDropdown 组件**

创建 `src/editor/ToolDropdown.vue`：

```vue
<template>
  <div
    ref="rootRef"
    class="sketch-tool-dropdown"
  >
    <!-- 触发器按钮 -->
    <div
      class="sketch-tool-dropdown__trigger"
      @click="toggle"
    >
      <slot name="trigger" />
      <span class="sketch-tool-dropdown__arrow" />
    </div>

    <!-- 下拉面板 -->
    <Transition name="sketch-dropdown">
      <div
        v-if="modelValue"
        class="sketch-tool-dropdown__panel"
      >
        <slot name="dropdown" />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

const rootRef = ref<HTMLDivElement>();

function toggle() {
  emit("update:modelValue", true);
}

function close() {
  emit("update:modelValue", false);
}

function onClickOutside(e: MouseEvent) {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) {
    close();
  }
}

onMounted(() => {
  document.addEventListener("mousedown", onClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("mousedown", onClickOutside);
});
</script>

<style scoped>
.sketch-tool-dropdown {
  position: relative;
  display: inline-flex;
}

.sketch-tool-dropdown__trigger {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  position: relative;
}

.sketch-tool-dropdown__arrow {
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 4px solid currentColor;
  opacity: 0.7;
  pointer-events: none;
}

.sketch-tool-dropdown__panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 1000;
  min-width: 120px;
  background: var(--sketch-toolbar-control-bg);
  border: 1px solid var(--sketch-toolbar-control-border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  padding: 4px;
  backdrop-filter: blur(12px);
}

.sketch-dropdown-enter-active,
.sketch-dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.sketch-dropdown-enter-from,
.sketch-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
```

- [ ] **Step 2: 编写下拉组件测试**

创建 `src/editor/ToolDropdown.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ToolDropdown from "./ToolDropdown.vue";

describe("ToolDropdown", () => {
  it("renders trigger slot", () => {
    const wrapper = mount(ToolDropdown, {
      props: { modelValue: false },
      slots: { trigger: "<button>Pen</button>" },
    });
    expect(wrapper.find(".sketch-tool-dropdown__trigger").text()).toBe("Pen");
  });

  it("shows arrow indicator", () => {
    const wrapper = mount(ToolDropdown, {
      props: { modelValue: false },
      slots: { trigger: "<button>Pen</button>" },
    });
    expect(wrapper.find(".sketch-tool-dropdown__arrow").exists()).toBe(true);
  });

  it("does not render dropdown panel when modelValue is false", () => {
    const wrapper = mount(ToolDropdown, {
      props: { modelValue: false },
      slots: { dropdown: "<div>Options</div>" },
    });
    expect(wrapper.find(".sketch-tool-dropdown__panel").exists()).toBe(false);
  });

  it("renders dropdown panel when modelValue is true", () => {
    const wrapper = mount(ToolDropdown, {
      props: { modelValue: true },
      slots: { dropdown: "<div>Options</div>" },
    });
    expect(wrapper.find(".sketch-tool-dropdown__panel").exists()).toBe(true);
  });

  it("emits update:modelValue when trigger is clicked", async () => {
    const wrapper = mount(ToolDropdown, {
      props: { modelValue: false },
      slots: { trigger: "<button>Pen</button>" },
    });
    await wrapper.find(".sketch-tool-dropdown__trigger").trigger("click");
    expect(wrapper.emitted("update:modelValue")![0]).toEqual([true]);
  });
});
```

- [ ] **Step 3: 运行测试**

Run: `npx vitest run src/editor/ToolDropdown.test.ts`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add src/editor/ToolDropdown.vue src/editor/ToolDropdown.test.ts
git commit -m "feat: 新增 ToolDropdown 可复用下拉组件"
```

---

### Task 5: ToolBar 集成下拉

**Files:**
- Modify: `src/editor/ToolBar.vue`

- [ ] **Step 1: 修改 ToolBar.vue 的画笔按钮为下拉**

在 `src/editor/ToolBar.vue` 的 `<script setup>` 中更新 import 和 props：

```typescript
import { ref, computed } from "vue";
import type { EditorTool, ShapeEditorTool } from "./tools";
import type { PenSubtype, HighlighterSubtype } from "@/types/sketch";
import IconParkIcon from "./IconParkIcon.vue";
import ToolDropdown from "./ToolDropdown.vue";
import type { IconParkName } from "./iconParkIcons";
import { PEN_SUBTYPE_ICONS, HIGHLIGHTER_SUBTYPE_ICONS, PEN_SUBTYPE_LABEL_KEYS, HIGHLIGHTER_SUBTYPE_LABEL_KEYS } from "./penSubtypeIcons";
import { getToolButtonActiveState } from "./toolbarModel";

const props = defineProps<{
  activeTool: EditorTool;
  lastShapeTool: ShapeEditorTool;
  penSubtype: PenSubtype;
  highlighterSubtype: HighlighterSubtype;
  t: (key: string) => string;
  replayActive?: boolean;
}>();

const emit = defineEmits<{
  (e: "selectTool", tool: EditorTool): void;
  (e: "selectPenSubtype", subtype: PenSubtype): void;
  (e: "selectHighlighterSubtype", subtype: HighlighterSubtype): void;
}>();

const showPenDropdown = ref(false);
const showHighlighterDropdown = ref(false);

const penSubtypes: PenSubtype[] = ["ballpoint", "pencil", "fountain", "brush"];
const highlighterSubtypes: HighlighterSubtype[] = ["round", "square", "watercolor"];
```

将 template 中的画笔按钮（第 8-22 行）替换为：

```html
      <!-- 画笔（下拉） -->
      <ToolDropdown v-model="showPenDropdown">
        <template #trigger>
          <button
            class="sketch-btn sketch-btn--tool sketch-btn--icon-tool sketch-btn--dropdown-trigger"
            :class="{ 'sketch-btn--tool-active': getToolButtonActiveState(activeTool, 'pen') }"
            :title="t(props.penSubtype === 'ballpoint' ? 'pen' : PEN_SUBTYPE_LABEL_KEYS[props.penSubtype])"
            :aria-label="t('pen')"
            data-tool="pen"
            @click="emit('selectTool', 'pen')"
          >
            <span
              class="sketch-btn__icon"
              aria-hidden="true"
              v-html="PEN_SUBTYPE_ICONS[props.penSubtype]"
            />
          </button>
        </template>
        <template #dropdown>
          <button
            v-for="subtype in penSubtypes"
            :key="subtype"
            class="sketch-dropdown-item"
            :class="{ 'sketch-dropdown-item--active': props.penSubtype === subtype }"
            @click="onSelectPenSubtype(subtype)"
          >
            <span
              class="sketch-dropdown-item__icon"
              v-html="PEN_SUBTYPE_ICONS[subtype]"
            />
            <span class="sketch-dropdown-item__label">{{ t(PEN_SUBTYPE_LABEL_KEYS[subtype]) }}</span>
          </button>
        </template>
      </ToolDropdown>
```

将荧光笔按钮（第 24-38 行）替换为：

```html
      <!-- 荧光笔（下拉） -->
      <ToolDropdown v-model="showHighlighterDropdown">
        <template #trigger>
          <button
            class="sketch-btn sketch-btn--tool sketch-btn--icon-tool sketch-btn--dropdown-trigger"
            :class="{ 'sketch-btn--tool-active': getToolButtonActiveState(activeTool, 'highlighter') }"
            :title="t(HIGHLIGHTER_SUBTYPE_LABEL_KEYS[props.highlighterSubtype])"
            :aria-label="t('highlighter')"
            data-tool="highlighter"
            @click="emit('selectTool', 'highlighter')"
          >
            <span
              class="sketch-btn__icon"
              aria-hidden="true"
              v-html="HIGHLIGHTER_SUBTYPE_ICONS[props.highlighterSubtype]"
            />
          </button>
        </template>
        <template #dropdown>
          <button
            v-for="subtype in highlighterSubtypes"
            :key="subtype"
            class="sketch-dropdown-item"
            :class="{ 'sketch-dropdown-item--active': props.highlighterSubtype === subtype }"
            @click="onSelectHighlighterSubtype(subtype)"
          >
            <span
              class="sketch-dropdown-item__icon"
              v-html="HIGHLIGHTER_SUBTYPE_ICONS[subtype]"
            />
            <span class="sketch-dropdown-item__label">{{ t(HIGHLIGHTER_SUBTYPE_LABEL_KEYS[subtype]) }}</span>
          </button>
        </template>
      </ToolDropdown>
```

在 `<script setup>` 末尾添加处理函数：

```typescript
function onSelectPenSubtype(subtype: PenSubtype) {
  emit("selectPenSubtype", subtype);
  showPenDropdown.value = false;
}

function onSelectHighlighterSubtype(subtype: HighlighterSubtype) {
  emit("selectHighlighterSubtype", subtype);
  showHighlighterDropdown.value = false;
}
```

在 `<style scoped>` 末尾添加下拉项样式：

```css
/* 下拉项 */
.sketch-btn--dropdown-trigger {
  position: relative;
  padding-right: 14px;
}

.sketch-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border: none;
  background: transparent;
  color: var(--sketch-toolbar-text);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s ease;
}

.sketch-dropdown-item:hover {
  background: var(--sketch-toolbar-border);
}

.sketch-dropdown-item--active {
  background: var(--b3-theme-primary);
  color: var(--sketch-toolbar-active-text);
}

.sketch-dropdown-item__icon {
  display: inline-flex;
  align-items: center;
  font-size: 14px;
  width: 1em;
  height: 1em;
}

.sketch-dropdown-item__icon > svg {
  width: 1em;
  height: 1em;
}

.sketch-dropdown-item__label {
  white-space: nowrap;
}
```

- [ ] **Step 2: 提交**

```bash
git add src/editor/ToolBar.vue
git commit -m "feat: 画笔和荧光笔按钮添加下拉菜单切换笔型"
```

---

### Task 6: SketchEditor 集成

**Files:**
- Modify: `src/editor/SketchEditor.vue`

- [ ] **Step 1: 在 SketchEditor.vue 中添加笔型状态和切换逻辑**

在 `src/editor/SketchEditor.vue` 的 import 区域（第 1-20 行附近），确保导入新函数：

```typescript
import { applyPenSubtypeDefaults, applyHighlighterSubtypeDefaults } from "@/tools/presets";
import type { PenSubtype, HighlighterSubtype } from "@/types/sketch";
```

在 `activePreset` computed 之后（约第 299 行后），添加笔型 computed：

```typescript
const activePenSubtype = computed<PenSubtype>(
  () => toolPresets.value.pen.penSubtype ?? "ballpoint",
);
const activeHighlighterSubtype = computed<HighlighterSubtype>(
  () => toolPresets.value.highlighter.highlighterSubtype ?? "round",
);
```

在 `selectTool()` 函数之后（约第 448 行后），添加笔型切换函数：

```typescript
function selectPenSubtype(subtype: PenSubtype) {
  toolPresets.value = applyPenSubtypeDefaults(toolPresets.value, subtype);
  if (activeTool.value !== "pen") {
    selectTool("pen", "floatingToolbar");
  }
}

function selectHighlighterSubtype(subtype: HighlighterSubtype) {
  toolPresets.value = applyHighlighterSubtypeDefaults(toolPresets.value, subtype);
  if (activeTool.value !== "highlighter") {
    selectTool("highlighter", "floatingToolbar");
  }
}
```

在 template 中找到 `<ToolBar` 组件（通常在 EditorTopBar 内部或 SketchEditor template 中），添加新 props 和事件：

```html
<ToolBar
  :activeTool="displayTool"
  :lastShapeTool="lastShapeTool"
  :penSubtype="activePenSubtype"
  :highlighterSubtype="activeHighlighterSubtype"
  :t="t"
  :replayActive="isReplayMode"
  @selectTool="selectTool"
  @selectPenSubtype="selectPenSubtype"
  @selectHighlighterSubtype="selectHighlighterSubtype"
/>
```

- [ ] **Step 2: 提交**

```bash
git add src/editor/SketchEditor.vue
git commit -m "feat: SketchEditor 集成笔型切换逻辑"
```

---

### Task 7: 渲染引擎适配

**Files:**
- Modify: `src/engine/canvasEngine.ts`

- [ ] **Step 1: 更新 canvasEngine.ts 的 import**

在 `src/engine/canvasEngine.ts` 的 import 区域（第 14-18 行），更新 strokeSmoothing 的 import：

```typescript
import {
  filterStrokePointsByDistance,
  getPressureWidth,
  getSmoothedSegments,
  getPenSubtypePressureWidth,
  getPenSubtypeOpacityMultiplier,
  getHighlighterSubtypeLineCap,
  getSquareHighlighterWidthMultiplier,
} from "./strokeSmoothing";
```

- [ ] **Step 2: 修改 renderStroke 函数支持笔型**

在 `renderStroke()` 函数中（第 412-473 行），修改渲染逻辑以支持笔型：

替换函数开头的 `ctx.save()` 到 `ctx.lineCap = "round"` 部分（第 415-425 行）为：

```typescript
function renderStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const { points, color, width, tool, isShape } = stroke;
  if (points.length < 2) return;
  ctx.save();
  if (tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
  } else {
    ctx.globalAlpha = stroke.opacity ?? 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = color;
  }
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
```

在分段绘制的 else 分支（第 452-471 行），修改为支持笔型的压感宽度：

```typescript
  } else {
    // 分段绘制平滑的压感曲线
    const segments = getSmoothedSegments(points);
    let currentX = points[0].x;
    let currentY = points[0].y;
    for (const segment of segments) {
      const segWidth = getPressureWidth(width, segment.control.pressure);
      ctx.lineWidth = segWidth;
      ctx.beginPath();
      ctx.moveTo(currentX, currentY);
      ctx.quadraticCurveTo(
        segment.control.x,
        segment.control.y,
        segment.end.x,
        segment.end.y,
      );
      ctx.stroke();
      currentX = segment.end.x;
      currentY = segment.end.y;
    }
  }
```

注意：当前 `getPressureWidth` 已经在 `strokeSmoothing.ts` 中处理了通用的压感映射。笔型特有的压感曲线需要通过在 `handlePointerDown` 中将 `penSubtype` 信息存储到 stroke 上，或者在渲染时从 engine state 获取。

更优的方案是在 `Stroke` 接口中不添加 `penSubtype` 字段（保持数据兼容），而是在渲染时从 `EngineState.toolPresets` 获取当前笔型信息。修改 `renderStroke` 使其接收额外参数：

修改 `renderStroke` 签名（第 412 行）：

```typescript
function renderStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  penSubtype?: import("@/types/sketch").PenSubtype,
  highlighterSubtype?: import("@/types/sketch").HighlighterSubtype,
): void {
```

在函数体中，替换 `ctx.lineWidth = getPressureWidth(width, firstPressure)` 为：

对于 allSame 分支（第 438-440 行）：

```typescript
    ctx.lineWidth = tool === "pen"
      ? getPenSubtypePressureWidth(width, firstPressure, penSubtype)
      : getPressureWidth(width, firstPressure);
    if (tool === "pen" && penSubtype) {
      ctx.globalAlpha = (stroke.opacity ?? 1) * getPenSubtypeOpacityMultiplier(firstPressure, penSubtype);
    }
```

对于分段绘制分支中的 `ctx.lineWidth`（第 458 行）：

```typescript
      const segWidth = tool === "pen"
        ? getPenSubtypePressureWidth(width, segment.control.pressure, penSubtype)
        : getPressureWidth(width, segment.control.pressure);
      ctx.lineWidth = segWidth;
      if (tool === "pen" && penSubtype) {
        ctx.globalAlpha = (stroke.opacity ?? 1) * getPenSubtypeOpacityMultiplier(segment.control.pressure, penSubtype);
      }
```

对于荧光笔方形笔尖，在 allSame 分支的 `ctx.lineCap = "round"` 之后添加：

```typescript
    if (tool === "highlighter") {
      ctx.lineCap = getHighlighterSubtypeLineCap(highlighterSubtype);
    }
```

- [ ] **Step 3: 更新所有 renderStroke 调用点**

在 `setupStrokeCanvas()`（第 205-208 行）、`fullRedrawStrokeCanvas()`（第 326-329 行）和 `renderStrokeSegment()` 中，需要传入笔型信息。

由于 `renderStroke` 在循环中调用且笔型信息对所有笔画相同（来自当前预置），可以将笔型信息作为额外参数传入。但已有笔画不需要改变渲染方式（它们在绘制时使用的是当时的笔型）。为简化，仅在实时渲染段（`renderStrokeSegment`）中使用笔型信息。

修改 `renderStrokeSegment()` 函数（第 475-498 行）以接收笔型参数：

```typescript
function renderStrokeSegment(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  prev: StrokePoint,
  curr: StrokePoint,
  penSubtype?: import("@/types/sketch").PenSubtype,
): void {
  ctx.save();
  if (stroke.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
  } else {
    ctx.globalAlpha = stroke.opacity ?? 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = stroke.color;
  }
  const segWidth = stroke.tool === "pen"
    ? getPenSubtypePressureWidth(stroke.width, curr.pressure, penSubtype)
    : getPressureWidth(stroke.width, curr.pressure);
  ctx.lineWidth = segWidth;
  if (stroke.tool === "pen" && penSubtype) {
    ctx.globalAlpha = (stroke.opacity ?? 1) * getPenSubtypeOpacityMultiplier(curr.pressure, penSubtype);
  }
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(prev.x, prev.y);
  ctx.lineTo(curr.x, curr.y);
  ctx.stroke();
  ctx.restore();
}
```

更新 `handlePointerMove()` 中 `renderStrokeSegment` 的调用（第 260 行）：

```typescript
    const preset = state.toolPresets[state.tool];
    renderStrokeSegment(ctx, state.currentStroke, prev, curr, preset.penSubtype);
```

- [ ] **Step 4: 提交**

```bash
git add src/engine/canvasEngine.ts
git commit -m "feat: 渲染引擎根据笔型应用不同压感曲线和透明度效果"
```

---

### Task 8: FloatingToolbar 适配

**Files:**
- Modify: `src/editor/FloatingToolbar.vue`

- [ ] **Step 1: 更新 FloatingToolbar 的宽度预设值**

在 `src/editor/FloatingToolbar.vue` 的 `<script setup>` 中，找到宽度预设相关的计算逻辑（搜索 `widthPresets` 或类似变量），确保画笔工具的宽度预设根据当前 `penSubtype` 动态调整。

找到宽度控制区域的 template 部分（搜索 `<!-- 5. 宽度控制` 或 `sketch-float-stroke`），在 script 中添加基于笔型的宽度预设 computed：

```typescript
const strokePresets = computed(() => {
  if (props.activeTool === "pen") {
    const subtype = props.preset.penSubtype ?? "ballpoint";
    switch (subtype) {
      case "pencil":    return [1, 2, 4];
      case "ballpoint": return [1, 1.5, 3];
      case "fountain":  return [1, 2, 5];
      case "brush":     return [1, 3, 8];
      default:          return [2, 6, 12];
    }
  }
  if (props.activeTool === "highlighter") return [8, 18, 28];
  if (props.activeTool === "eraser") return [10, 20, 30];
  if (props.activeTool === "text") return [14, 20, 28];
  return [2, 6, 12];
});
```

将宽度预设按钮中的硬编码值替换为 `strokePresets` 数组。

- [ ] **Step 2: 提交**

```bash
git add src/editor/FloatingToolbar.vue
git commit -m "feat: FloatingToolbar 宽度预设适配各笔型"
```

---

### Task 9: 数据迁移

**Files:**
- Modify: `src/storage/migrations.ts`

- [ ] **Step 1: 在 migrations.ts 中处理 subtype 迁移**

在 `src/storage/migrations.ts` 的 import 中添加：

```typescript
import { normalizeToolPresets } from "@/tools/presets";
```

在 `migrateSketchData()` 函数的 return 语句之前（第 47 行前），添加 toolPresets 迁移：

```typescript
  const toolPresets = normalizeToolPresets(data.toolPresets);
```

并在 return 中使用 `toolPresets` 替代 `data.toolPresets`：

```typescript
  return {
    ...data,
    // ...existing fields...
    toolPresets,
    // ...remaining fields...
  };
```

`normalizeToolPresets` 已在 Task 1 中修改为自动填充默认 subtype，所以旧数据会被正确迁移。

- [ ] **Step 2: 提交**

```bash
git add src/storage/migrations.ts
git commit -m "feat: 旧数据迁移自动填充默认笔型 subtype"
```

---

### Task 10: 全面验证

- [ ] **Step 1: 运行所有单元测试**

Run: `pnpm test`
Expected: 全部 PASS

- [ ] **Step 2: 运行 TypeScript 类型检查**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 3: 运行 ESLint**

Run: `npx eslint src/`
Expected: 无错误

- [ ] **Step 4: 构建验证**

Run: `pnpm build`
Expected: 构建成功，无错误

- [ ] **Step 5: 提交修复（如有）**

如有 lint 或类型错误，修复后提交：

```bash
git add -A
git commit -m "fix: 修复类型检查和 lint 问题"
```

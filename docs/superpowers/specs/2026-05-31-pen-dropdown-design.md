# 画笔下拉菜单 + 笔型系统设计

> 日期：2026-05-31
> 状态：已批准

## 概述

在工具栏的画笔和荧光笔按钮上添加下拉菜单功能：
- 画笔按钮支持切换三种笔型：铅笔、圆珠笔、钢笔
- 荧光笔按钮支持切换两种笔尖：圆形笔尖、方形笔尖
- 每种笔型/笔尖有独立的预置颜色、粗细和透明度
- 通过渲染引擎实现贴近真实状态的笔触效果（简化风格）

## 类型系统

### 新增类型

```typescript
// types/sketch.ts
export type PenSubtype = "pencil" | "ballpoint" | "fountain";
export type HighlighterSubtype = "round" | "square" | "watercolor";
```

### ToolPreset 扩展

```typescript
export interface ToolPreset {
  tool: SketchTool;
  color: string;
  width: number;
  opacity: number;
  mode: "ink" | "marker" | "pixel" | "stroke";
  penSubtype?: PenSubtype;           // tool="pen" 时有效
  highlighterSubtype?: HighlighterSubtype; // tool="highlighter" 时有效
}
```

`SketchTool` 保持不变（`"pen" | "highlighter" | "eraser"`），笔型通过可选字段区分。旧数据无字段时自动映射为默认值（ballpoint / round）。

## 默认预置值

### 画笔笔型

| 笔型 | penSubtype | 颜色 | 粗细 | 透明度 | 压感特征 |
|------|-----------|------|------|--------|----------|
| 铅笔 | `"pencil"` | `#4a4a4a`（石墨灰） | 2px | 0.85 | 低灵敏度（0.7x~1.2x），微弱毛边感 |
| 圆珠笔 | `"ballpoint"` | `#1a237e`（蓝黑色） | 1.5px | 1.0 | 低中灵敏度（0.9x~1.1x），均匀稳定 |
| 钢笔 | `"fountain"` | `#1a1a2e`（深墨黑） | 2px | 0.95 | 高灵敏度（0.5x~2.0x），粗细变化明显 |

### 荧光笔笔尖

| 笔尖 | highlighterSubtype | 颜色 | 粗细 | 透明度 | 笔触特征 |
|------|-------------------|------|------|--------|----------|
| 圆形 | `"round"` | `#fff176`（荧光黄） | 18px | 0.45 | 标准荧光笔，边缘圆润 |
| 方形 | `"square"` | `#fff176`（荧光黄） | 18px | 0.45 | 模拟马克笔，笔触扁平 |
| 水彩 | `"watercolor"` | `#64b5f6`（水彩蓝） | 24px | 0.3 | 模拟水彩笔，边缘柔和、透明度低、笔触宽 |

## 工具栏 UI

### 画笔按钮下拉

- 按钮显示当前选中笔型的图标（铅笔/圆珠笔/钢笔）
- 右下角小三角指示器表示可下拉
- 点击按钮弹出下拉面板
- 下拉面板内容：
  - 3 个笔型选项，每项显示图标 + 名称
  - 当前选中项有激活高亮（主题色）
- 点击选项 → 应用对应预置 + 关闭下拉
- 点击外部 → 关闭下拉

### 荧光笔按钮下拉

- 同样设计，按钮显示当前笔尖图标
- 下拉面板包含 3 个选项：圆形笔尖 / 方形笔尖 / 水彩笔

### 其他工具按钮

橡皮擦、套索、图形、文本按钮保持不变。

### 图标方案

使用 IconPark 图标：
- 铅笔：`"Pencil"` 或 `"DrawingMode"`
- 圆珠笔：`"Write"`（当前画笔图标）
- 钢笔：`"FountainPen"` 或自定义 SVG
- 圆形荧光笔：`"FormatBrush"`（当前荧光笔图标）
- 方形荧光笔：`"Rectangle"` 风格笔刷图标

## 渲染引擎

### canvasEngine.ts 修改

读取当前 `ToolPreset` 的 `penSubtype` / `highlighterSubtype`，根据笔型应用不同的渲染参数。

#### 压力-宽度转换曲线

```typescript
function getPressureWidthMultiplier(
  pressure: number,
  penSubtype: PenSubtype
): number {
  switch (penSubtype) {
    case "pencil":
      // 低灵敏度：宽度变化范围 0.7x ~ 1.2x
      return 0.7 + pressure * 0.5;
    case "ballpoint":
      // 近乎恒定：宽度变化范围 0.9x ~ 1.1x
      return 0.9 + pressure * 0.2;
    case "fountain":
      // 高灵敏度（sigmoid 曲线）：宽度变化范围 0.5x ~ 2.0x
      return 0.5 + sigmoid(pressure) * 1.5;
  }
}
```

#### 笔触效果

- **铅笔**：基础透明度乘以 (0.8 + pressure * 0.2)，线条边缘可添加微弱噪点
- **圆珠笔**：保持完全不透明，线条均匀
- **钢笔**：基础透明度乘以 (0.9 + pressure * 0.1)，笔触过渡更顺滑

#### 荧光笔笔尖渲染

- **圆形笔尖**：`lineCap = "round"`, `lineJoin = "round"`（当前默认行为）
- **方形笔尖**：`lineCap = "butt"`, 使用矩形笔触形状，宽度随笔划方向变化
  - 水平移动时使用完整宽度
  - 垂直移动时使用较窄宽度（如 0.4x）
  - 中间角度线性插值

### strokeSmoothing.ts 修改

钢笔模式下增加贝塞尔插值密度，使线条过渡更顺滑，模拟墨水连续流出的效果。

## 数据持久化

### 存储结构

```typescript
interface SketchData {
  // ... 现有字段 ...
  toolPresets?: ToolPresetCollection;  // 包含 penSubtype / highlighterSubtype
}
```

- `ToolPreset.pen.penSubtype` 记录当前选中的笔型
- `ToolPreset.highlighter.highlighterSubtype` 记录当前选中的笔尖
- 现有自动保存机制直接覆盖，无需额外存储逻辑

### 迁移策略

- 旧数据 `ToolPreset.pen` 无 `penSubtype` → 默认 `"ballpoint"`
- 旧数据 `ToolPreset.highlighter` 无 `highlighterSubtype` → 默认 `"round"`
- `normalizeToolPreset()` 函数中处理默认值填充

## 涉及修改的文件

| 文件 | 修改内容 |
|------|---------|
| `src/types/sketch.ts` | 新增 PenSubtype、HighlighterSubtype 类型；ToolPreset 增加字段 |
| `src/tools/presets.ts` | 新增各笔型默认预置；normalizeToolPreset 处理默认 subtype |
| `src/editor/ToolBar.vue` | 画笔/荧光笔按钮改为下拉触发器 |
| `src/editor/FloatingToolbar.vue` | 适配新笔型的颜色/粗细控制 |
| `src/editor/tools.ts` | 扩展辅助函数适配新笔型 |
| `src/editor/SketchEditor.vue` | 处理笔型切换事件、应用对应预置 |
| `src/engine/canvasEngine.ts` | 根据笔型应用不同压力曲线和渲染效果 |
| `src/engine/strokeSmoothing.ts` | 钢笔模式增加插值密度 |
| `src/storage/migrations.ts` | 旧数据迁移：填充默认 penSubtype/highlighterSubtype |

## 不在范围内

- 自定义笔型创建
- 笔触纹理像素级模拟
- 压感硬件适配细节
- 多笔型组合绘制

# 回放增强方案设计

## 背景

当前回放功能存在两个体验差距：
1. **工具切换**：仅在 canvas 上绘制文字标签，无法看到工具栏实际操作
2. **图片操作**：仅录制插入事件，播放时显示灰色占位矩形；move/resize/rotate/opacity/delete 均未录制

## 目标

- 工具切换回放时，顶部工具栏原样显示，体现按钮点击动画
- 图片操作回放时，加载真实图片并还原 move/resize/rotate/opacity/delete 全过程

---

## 一、数据结构扩展

### 新增事件类型

```typescript
// src/recorder/types.ts

export interface ImageTransformReplayEvent {
  type: "imageTransform";
  id: string;
  timestamp: number;
  elementId: string;
  op: "move" | "resize" | "rotate" | "opacity";
  finalElement: ImageElement;     // 操作完成后的快照，用于 seek
  points?: Array<{               // 指针轨迹，用于动画回放
    x: number;
    y: number;
    timestamp: number;
  }>;
}

export interface ImageDeleteReplayEvent {
  type: "imageDelete";
  id: string;
  timestamp: number;
  elementId: string;
}
```

`ReplayEvent` 联合类型新增这两个事件。`ReplayRecorderConfig` 新增 `imageTransform` 和 `imageDelete` 开关。

### 设计决策

- **`finalElement` 快照**：保证 seek（跳转到任意步骤）时能立即恢复正确状态，无需回溯计算
- **`points` 轨迹**：move/resize 记录起止点（最少 2 个点），rotate 记录起止角度对应的点，opacity 无需轨迹
- **无历史兼容负担**：旧数据不含新事件类型，降级为静态展示

---

## 二、工具栏回放

### 方案

回放时保持 ToolBar 可见，通过 `onToolSwitch` 回调驱动工具高亮切换 + CSS 点击动画。

### 改动点

| 文件 | 改动 |
|------|------|
| `SketchEditor.vue` 模板 | ToolBar 移除 `v-show="!isReplayMode"` 条件，回放时始终显示 |
| `SketchEditor.vue` 脚本 | 监听 `player.onToolSwitch`，更新 `activeTool`；添加按钮点击动画逻辑 |
| `ToolBar.vue` | 按钮添加 `data-tool` 属性，用于定位目标按钮 |
| `player.ts` | `animateToolSwitch` 触发 `onToolSwitch` 回调后立即返回 true（不再绘制 canvas 标签） |

### 点击动画

CSS keyframe：`scale(1) → scale(0.88) → scale(1)`，持续 250ms，叠加 ripple 效果。

### 边界处理

- 回放期间 ToolBar 设置 `pointer-events: none`，禁止用户交互
- FloatingToolbar 回放时保持隐藏（避免遮挡画布）

---

## 三、图片操作回放

### 录制端（SketchCanvas.vue）

| 操作 | 录制时机 | 录制内容 |
|------|---------|---------|
| move | `onPointerUp` L639 | `op: "move"`, finalElement, points |
| resize | `onPointerUp` L639 | `op: "resize"`, finalElement, points |
| rotate | `onPointerUp` L639 | `op: "rotate"`, finalElement, points |
| opacity | `cycleImageOpacity()` L1123 | `op: "opacity"`, finalElement |
| delete | 图片删除 L415 | `type: "imageDelete"`, elementId |

指针轨迹采集：在 `onPointerMove` 的 `imageTransform` 分支中，每帧将当前点追加到轨迹数组。

### 播放端（player.ts）

#### 新增状态

```typescript
private imageStates: Map<string, ImageElement> = new Map();
private imageCache: Map<string, HTMLImageElement> = new Map();
private imageTransformProgress = 0;
private imageTransformAnim: {
  elementId: string;
  op: string;
  fromBounds: Bounds;
  toBounds: Bounds;
  fromRotation: number;
  toRotation: number;
  fromOpacity: number;
  toOpacity: number;
  points: Array<{ x: number; y: number }>;
  pointIndex: number;
} | null = null;
```

#### 事件处理

| 事件 | 动画行为 | seek 行为 |
|------|---------|----------|
| `image`（插入） | 加载图片 → fade in 200ms | 直接渲染最终状态 |
| `imageTransform` move | 沿 points 轨迹移动选框+图片 | 用 finalElement 快照 |
| `imageTransform` resize | 沿 points 轨迹缩放选框+图片 | 用 finalElement 快照 |
| `imageTransform` rotate | 角度插值旋转图片 | 用 finalElement 快照 |
| `imageTransform` opacity | 透明度插值渐变 | 用 finalElement 快照 |
| `imageDelete` | 淡出动画 200ms | 从 imageStates 移除 |

#### 图片渲染

```typescript
private renderImageElement(element: ImageElement): void {
  const img = this.imageCache.get(element.src);
  if (!img || !img.complete) return;

  const ctx = this.getDrawingContext();
  const cx = element.bounds.x + element.bounds.width / 2;
  const cy = element.bounds.y + element.bounds.height / 2;

  ctx.save();
  ctx.globalAlpha = element.opacity ?? 1;
  ctx.translate(cx, cy);
  ctx.rotate(element.transform?.rotation ?? 0);
  ctx.drawImage(
    img,
    -element.bounds.width / 2,
    -element.bounds.height / 2,
    element.bounds.width,
    element.bounds.height,
  );
  ctx.restore();
}
```

#### 图片预加载

在 `play()` 和 `goToEvent()` 时，扫描所有事件收集 `src`，批量预加载到 `imageCache`。

---

## 四、开发计划

### Phase 1: 数据结构（types.ts）
- [x] 新增 `ImageTransformReplayEvent`、`ImageDeleteReplayEvent`
- [x] 更新 `ReplayEvent` 联合类型
- [x] 更新 `ReplayRecorderConfig` 和默认值
- [x] 单元测试

### Phase 2: 录制端（SketchCanvas.vue）
- [x] 图片 transform 指针轨迹采集
- [x] pointer-up 时录制 imageTransform 事件
- [x] cycleImageOpacity 录制 opacity 事件
- [x] 图片删除录制 imageDelete 事件
- [x] 单元测试

### Phase 3: 工具栏回放（player.ts + SketchEditor.vue + ToolBar.vue）
- [x] player.ts 新增 `onToolSwitch` 回调
- [x] animateToolSwitch 触发回调并跳过 canvas 绘制
- [x] SketchEditor.vue 回放时显示 ToolBar
- [x] SketchEditor.vue 监听回调更新 activeTool + 点击动画
- [x] ToolBar.vue 按钮添加 data-tool 属性
- [x] 回放时 ToolBar pointer-events: none

### Phase 4: 图片回放（player.ts）
- [x] imageStates / imageCache 状态管理
- [x] 图片预加载逻辑
- [x] animateImage 改为加载真实图片
- [x] 新增 animateImageTransform 处理 move/resize/rotate/opacity
- [x] 新增 animateImageDelete 处理删除
- [x] renderEventInstant 支持新事件
- [x] goToEvent 支持新事件的 seek
- [x] 单元测试

### Phase 5: 验证
- [x] pnpm test 全部通过
- [x] eslint 无新增错误
- [x] 构建成功

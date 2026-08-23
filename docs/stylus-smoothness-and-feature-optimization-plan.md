# siyuan-sketch-note 手写笔流畅性与功能优化实施方案与计划

> **版本**：v1.0.0  
> **更新时间**：2026-08-23  
> **对标基准**：[`docs/jsdraw-analysis-and-stylus-benchmark.md`](file:///d:/MyCodingProjects/siyuan-sketch-note/docs/jsdraw-analysis-and-stylus-benchmark.md)  
> **目标**：打造媲美 iPadOS 顶级原生笔记应用（GoodNotes / Apple Notes / Concepts / js-draw）的触控笔书写跟手度、高精度平滑曲线、物理抗抖稳定性与多端无缝体验。

---

## 1. 现状痛点与优化目标

### 1.1 现状痛点

| 痛点分类 | 具体表现 | 根因剖析 |
| :--- | :--- | :--- |
| **高刷屏折线感** | 快速草写汉字、连笔、签名时，曲线呈现生硬的直线折角 | `onPointerMove` 仅取单个事件点，**未提取 `e.getCoalescedEvents()` 硬件高频合并采样点** |
| **运笔微滞后感** | 笔尖与墨水线条之间有明显的视觉间隙（15~30ms 滞后） | 缺乏手写轨迹预测算法，**未利用 `e.getPredictedEvents()`** |
| **慢速手抖毛刺** | 慢速书写或微颤时，笔画呈现锯齿状、“蚯蚓线” | 仅依赖几何中点二次贝塞尔，缺乏物理质量-阻尼低通滤波 |
| **压感竹节与阶跃** | 笔画粗细忽粗忽细，收笔突兀 | 原始硬件压感噪声未经时序低通滤波（EMA），缺乏首尾渐变过渡 |
| **复杂画板掉帧** | 当画布上有数百上千笔画时，实时书写偶发卡顿 | 湿墨层（正在绘制的单笔）与干墨层（历史笔画）未完全分离，局部操作触发了全量 Canvas 重绘 |
| **多窗口/多端冲突** | 多窗口并发编辑同一白板覆盖丢数据；多设备同步后主文档缩略图无法自动热重载 | 缺乏思源 Kernel 跨窗口编辑排他锁；缺乏 Sync Marker 与缓存击穿机制 |

### 1.2 优化目标

1. **零丢点高采样**：在 120Hz/240Hz/480Hz 采样设备上实现高密度点采集与平滑插值。
2. **物理级抗抖与流体质感**：提供基于经典力学（弹簧-质量-阻尼）的自驱动稳定器，支持 3 档预设及高级参数微调。
3. **极速零延迟渲染（< 10ms）**：三层独立 Canvas 双缓冲架构，湿墨活动笔画跑满 120 FPS。
4. **长按停顿规整几何图形（Hold-to-Shape）**：停顿自动识别规整直线、矩形、圆/椭圆、三角形、箭头。
5. **多窗口排他锁与多端热重载**：杜绝并发写入冲突，同步后主文档缩略图无感即时刷新。

---

## 2. 核心技术方案与架构设计

```
                               ┌──────────────────────────────────────────────┐
                               │             PointerEvent (硬件输入)          │
                               └──────────────────────┬───────────────────────┘
                                                      │
                                   ┌──────────────────┴──────────────────┐
                                   ▼                                     ▼
                      getCoalescedEvents() (高频采样点)        getPredictedEvents() (预测点)
                                   │                                     │
                                   └──────────────────┬──────────────────┘
                                                      ▼
                                       ┌───────────────────────────────┐
                                       │   Pressure EMA Filter (压感滤波)│
                                       └──────────────┬────────────────┘
                                                      ▼
                                       ┌───────────────────────────────┐
                                       │   Spring-Mass-Damper 物理稳定器 │
                                       │   (质点动力学 / 自适应细分插值)   │
                                       └──────────────┬────────────────┘
                                                      ▼
                                       ┌───────────────────────────────┐
                                       │   Hold-to-Shape 停顿图形识别器  │
                                       └──────────────┬────────────────┘
                                                      │
                       ┌──────────────────────────────┴──────────────────────────────┐
                       ▼                                                             ▼
         【 Wet Ink Canvas (湿墨层) 】                                  【 Dry Canvas (干墨层) 】
         - 120 FPS 极速局部实时绘制                                     - 历史笔画 / 元素
         - 预测轨迹轻量预览                                             - 抬笔 (PointerUp) 后固化
         - 零开销高频刷新                                               - 稳定不重复全量重绘
```

---

### 2.1 超低延迟手写笔输入流升级

#### (1) Coalesced & Predicted Events 提取与解析

在 [`src/editor/inputEvents.ts`](file:///d:/MyCodingProjects/siyuan-sketch-note/src/editor/inputEvents.ts)（新建）中实现现代 Pointer Events 的完整提取：

```typescript
export interface RawInputPoint {
  x: number;
  y: number;
  pressure: number;
  tiltX?: number;
  tiltY?: number;
  timeStamp: number;
  isPredicted?: boolean;
}

export function extractPointerPoints(
  e: PointerEvent,
  canvasToLogicalCoord: (clientX: number, clientY: number) => { x: number; y: number },
  enablePressure: boolean,
): { realPoints: RawInputPoint[]; predictedPoints: RawInputPoint[] } {
  const realPoints: RawInputPoint[] = [];
  const predictedPoints: RawInputPoint[] = [];

  // 1. 提取合并的高采样率历史真实点 (Coalesced Events)
  const coalesced = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
  const sourceEvents = coalesced.length > 0 ? coalesced : [e];

  for (const evt of sourceEvents) {
    const pt = canvasToLogicalCoord(evt.clientX, evt.clientY);
    realPoints.push({
      x: pt.x,
      y: pt.y,
      pressure: enablePressure ? (evt.pressure || 0.5) : 0.5,
      tiltX: evt.tiltX,
      tiltY: evt.tiltY,
      timeStamp: evt.timeStamp || performance.now(),
      isPredicted: false,
    });
  }

  // 2. 提取未来预测点 (Predicted Events) 用于前瞻渲染消除视觉延迟
  if (typeof e.getPredictedEvents === "function") {
    const predicted = e.getPredictedEvents();
    for (const evt of predicted) {
      const pt = canvasToLogicalCoord(evt.clientX, evt.clientY);
      predictedPoints.push({
        x: pt.x,
        y: pt.y,
        pressure: enablePressure ? (evt.pressure || 0.5) : 0.5,
        tiltX: evt.tiltX,
        tiltY: evt.tiltY,
        timeStamp: evt.timeStamp || performance.now(),
        isPredicted: true,
      });
    }
  }

  return { realPoints, predictedPoints };
}
```

---

### 2.2 物理弹簧动力学稳定器 (`SpringMassStabilizer`)

在 [`src/engine/stabilizer/springMassStabilizer.ts`](file:///d:/MyCodingProjects/siyuan-sketch-note/src/engine/stabilizer/springMassStabilizer.ts)（新建）中，基于胡克定律与牛顿力学构建带质量虚拟质点的阻尼平滑器：

```typescript
export interface StabilizerOptions {
  mass: number;                // 质点质量 (0.1 ~ 2.0, 默认 0.4)
  springConstant: number;      // 弹性系数 (10 ~ 500, 默认 120.0)
  frictionCoefficient: number; // 摩擦阻尼系数 (0.0 ~ 2.0, 默认 0.3)
  maxPointDist: number;        // 最大细分步长 (1 ~ 50px, 默认 8.0)
  inertiaFraction: number;     // 惯性比例 (0.0 ~ 1.0, 默认 0.7)
  velocityDecayFactor: number; // 速度衰减 (0.0 ~ 1.0, 默认 0.1)
  minSimilarityToFinalize: number; // 收笔对齐阈值 (默认 0.0)
}

export class SpringMassStabilizer {
  private strokePoint: { x: number; y: number };
  private targetPoint: { x: number; y: number };
  private velocity = { x: 0, y: 0 };
  private lastTime = 0;

  constructor(start: { x: number; y: number }, private options: StabilizerOptions) {
    this.strokePoint = { ...start };
    this.targetPoint = { ...start };
    this.lastTime = performance.now();
  }

  setTarget(point: { x: number; y: number }) {
    this.targetPoint = point;
  }

  step(nowTime: number): Array<{ x: number; y: number }> {
    const deltaTime = Math.min(32, Math.max(1, nowTime - this.lastTime));
    this.lastTime = nowTime;
    
    const generatedPoints: Array<{ x: number; y: number }> = [];
    const dx = this.targetPoint.x - this.strokePoint.x;
    const dy = this.targetPoint.y - this.strokePoint.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 0.001) return generatedPoints;

    // 自适应时间步长细分，防止大跨度跳跃
    const parts = Math.min(10, Math.max(1, Math.ceil(dist / this.options.maxPointDist)));
    const subDt = (deltaTime / parts) / 1000;

    for (let i = 0; i < parts; i++) {
      const curDx = this.targetPoint.x - this.strokePoint.x;
      const curDy = this.targetPoint.y - this.strokePoint.y;
      
      // 弹簧拉力
      const fSpringX = curDx * this.options.springConstant;
      const fSpringY = curDy * this.options.springConstant;
      
      // 摩擦阻尼
      const vLen = Math.hypot(this.velocity.x, this.velocity.y);
      const normalForce = this.options.mass * 9.8;
      const fFrictionX = vLen > 0 ? -(this.velocity.x / vLen) * this.options.frictionCoefficient * normalForce : 0;
      const fFrictionY = vLen > 0 ? -(this.velocity.y / vLen) * this.options.frictionCoefficient * normalForce : 0;

      // 加速度与速度积分
      const ax = (fSpringX + fFrictionX) / this.options.mass;
      const ay = (fSpringY + fFrictionY) / this.options.mass;

      this.velocity.x = (this.velocity.x * (1 - this.options.velocityDecayFactor)) + ax * subDt;
      this.velocity.y = (this.velocity.y * (1 - this.options.velocityDecayFactor)) + ay * subDt;

      // 质点位移
      this.strokePoint.x += this.velocity.x * subDt;
      this.strokePoint.y += this.velocity.y * subDt;

      generatedPoints.push({ x: this.strokePoint.x, y: this.strokePoint.y });
    }

    return generatedPoints;
  }
}
```

---

### 2.3 压感低通滤波与笔锋平滑（Pressure EMA Filtering & Tapering）

在 [`src/engine/stabilizer/pressureFilter.ts`](file:///d:/MyCodingProjects/siyuan-sketch-note/src/engine/stabilizer/pressureFilter.ts) 中实现压感指数移动平均滤波与起笔/收笔渐变：

```typescript
export class PressureFilter {
  private smoothedPressure: number | null = null;
  private alpha: number; // 滤波因子 (0.2 ~ 0.4 消除噪声同时保持响应灵敏)

  constructor(alpha = 0.3) {
    this.alpha = alpha;
  }

  filter(rawPressure: number): number {
    if (this.smoothedPressure === null) {
      this.smoothedPressure = rawPressure;
      return rawPressure;
    }
    this.smoothedPressure = this.smoothedPressure + this.alpha * (rawPressure - this.smoothedPressure);
    return this.smoothedPressure;
  }

  reset() {
    this.smoothedPressure = null;
  }
}
```

---

### 2.4 三层画布架构（Triple-Buffer Canvas Rendering）

重构 [`SketchCanvas.vue`](file:///d:/MyCodingProjects/siyuan-sketch-note/src/editor/SketchCanvas.vue) 的模板与 Canvas 层级：

```html
<div class="sketch-canvas-container" :style="viewportTransformStyle">
  <!-- Layer 1: 背景与模板层 (极低频重绘) -->
  <canvas ref="bgCanvasRef" class="sketch-canvas sketch-canvas--bg" />

  <!-- Layer 2: 干墨层 (历史笔画、固化形状、图片、文字，低频重绘) -->
  <canvas ref="dryCanvasRef" class="sketch-canvas sketch-canvas--dry" />

  <!-- Layer 3: 湿墨层 (当前活动单笔、预测轨迹、橡皮擦光圈、套索选框，120 FPS 极速重绘) -->
  <canvas
    ref="wetCanvasRef"
    class="sketch-canvas sketch-canvas--wet"
    @contextmenu.prevent
    @dblclick="onCanvasDoubleClick"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointerleave="onPointerUp"
  />
</div>
```

**渲染流水线效率对比：**
- **重构前**：每次 `pointermove` 都有可能触发笔画 Canvas 的全量遍历重绘（包含上千个笔画与文本），导致掉帧。
- **重构后**：书写过程中，Layer 1 与 Layer 2 完全静止，Layer 3（Wet Canvas）仅通过 `clearRect` 清理极小活动区域并绘制正在写的一笔，**书写性能消耗降低 80% 以上**。

---

### 2.5 长按停顿智能图形规整（Hold-to-Shape）

在 [`src/engine/shapes/shapeRecognizer.ts`](file:///d:/MyCodingProjects/siyuan-sketch-note/src/engine/shapes/shapeRecognizer.ts) 中：
1. **停顿检测**：在书写过程中监测末端点位移与速度；当位移在 10px 范围内停留超 400ms，触发振动反馈（`navigator.vibrate?.(10)`）并进入图形识别状态；
2. **特征提取与拟合**：
   - 闭合度检测（首尾点距离小于外接矩形对角线 20% 判定为闭合图形）；
   - 圆形/椭圆拟合（最小二乘法圆拟合，残差方差 < 0.15 识别为圆/椭圆）；
   - 多边形检测（道格拉斯-普克算法 Douglas-Peucker 提取角点：3点为三角形、4点为矩形/平行四边形）；
   - 直线与箭头检测（长宽比极大且主方向明确，端点有锐角回折判定为箭头）；
3. **湿墨预览与平滑替换**：在湿墨层无缝替换为规整后的几何图形，抬笔时固化保存。

---

### 2.6 思源生态增强：跨窗口排他锁与跨端热重载

#### (1) Kernel RPC 跨窗口排他锁
- 在 `src/index.ts` 中注册并维持 Kernel RPC；
- 打开白板时申请锁，若被占用弹出提示并提供“只读查看”或“强制抢占”选项；
- 窗口关闭或崩溃超时（5s 无心跳）自动释放。

#### (2) Sync Marker 与图片缓存击穿
- 每次保存除了更新 `/data/assets/` 外，更新 `storage/sync-marker.json`；
- 多设备思源同步拉取到 `sync-marker.json` 后，通过 `ws-main: reloadPlugin` 触发监听；
- 前端利用 `fetch(assetUrl, { cache: 'reload' })` 击穿思源图片缓存，自动重新挂载当前打开文档中所有对应的白板缩略图。

---

## 3. 落地实施批次计划（Batch Roadmap）

```
                                   【优化实施批次路线图】
                                              │
    ┌─────────────────────────────────────────┼─────────────────────────────────────────┐
    ▼                                         ▼                                         ▼
【Batch 1: 输入采样与压感】          【Batch 2: 物理动力学稳定器】               【Batch 3: 三层画布渲染】
- Coalesced Events 高频接入         - SpringMassStabilizer 算法实现           - Wet/Dry Canvas 彻底分离
- Predicted Events 预测接入         - 抗抖等级预设 (原生/平滑/书法)           - 局部脏矩形极速重绘
- Pressure 低通滤波与笔锋平滑       - Stylus 设置 UI 调试面板                 - 彻底杜绝复杂画板卡顿
    │                                         │                                         │
    └─────────────────────────────────────────┼─────────────────────────────────────────┘
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    ▼                                                   ▼
       【Batch 4: Hold-to-Shape 停顿校正】            【Batch 5: 跨窗口锁与多端热重载】
       - 停顿检测器 (StationaryDetector)              - Kernel RPC 跨窗口排他锁
       - 几何拟合 (直线/矩形/圆/箭头)                 - Sync Marker + 缓存击穿热重载
       - 湿墨层平滑形变反馈                           - 暗黑模式文档图片智能滤镜
```

---

### Batch 1: 手写笔输入采样流与压感滤波（P0 基础底座）

**核心目标**：解构 `PointerEvent`，在 120Hz/240Hz 采样屏幕上采集全部中间点并接入预测，消除笔尖视觉延迟，压感平滑无毛刺。

- **任务清单**：
  1. 创建 `src/editor/inputEvents.ts` 与 `src/editor/inputEvents.test.ts`；
  2. 实现 `extractPointerPoints`，合并 `getCoalescedEvents()` 与 `getPredictedEvents()`；
  3. 创建 `src/engine/stabilizer/pressureFilter.ts` 与单元测试，实现 EMA 压感平滑；
  4. 修改 `SketchCanvas.vue`，将原始单一事件点替换为高频点流遍历；
  5. 运行 `pnpm test` 和 `pnpm build`，确保所有现有测试通过。

---

### Batch 2: 物理弹簧动力学稳定器与可配置面板（P0 核心平滑）

**核心目标**：引入质点物理动力学模型，彻底解决慢速手抖与快速折线，提供平滑度预设与高级参数调节。

- **任务清单**：
  1. 创建 `src/engine/stabilizer/springMassStabilizer.ts` 与 `springMassStabilizer.test.ts`；
  2. 实现基于物理弹性-阻尼-质量自驱动的平滑器与自适应细分步长；
  3. 在 `src/types/sketch.ts` 中增加手写平滑配置类型（`stabilizerMode`: `'none' | 'smooth' | 'calligraphy' | 'custom'`）；
  4. 在 `ToolOptionsPopover.vue` 或设置弹窗中增加“手写抗抖与平滑度”调节组件；
  5. 运行 `pnpm test` 和 `pnpm build`。

---

### Batch 3: 三层画布渲染管线升级（P0 性能突破）

**核心目标**：将 Canvas 引擎升级为 Triple-Buffer（背景层 + 干墨固化层 + 湿墨实时层），复杂大白板书写稳稳保持 120 FPS。

- **任务清单**：
  1. 重构 `src/editor/SketchCanvas.vue` 模板，增加独立的 `dryCanvasRef` 与 `wetCanvasRef`；
  2. 重构 `src/engine/canvasEngine.ts`：
     - `setupDryCanvas`：仅绘制已经落笔固化的历史 strokes/elements；
     - `setupWetCanvas`：仅负责当前 active stroke、预测虚线、临时 preview；
     - `finalizeWetStroke`：抬笔后将湿墨转移至干墨层；
  3. 彻底移除书写过程中无谓的 `fullRedrawStrokeCanvas`；
  4. 运行 `pnpm test` 和 `pnpm build`。

---

### Batch 4: 停顿智能几何图形识别与规整（Hold-to-Shape）（P1 交互体验）

**核心目标**：画完线条在末端停顿 400ms，自动将草图识别规整为完美直线、椭圆、矩形、三角形或箭头。

- **任务清单**：
  1. 创建 `src/engine/shapes/stationaryDetector.ts`（停顿检测器）；
  2. 创建 `src/engine/shapes/shapeRecognizer.ts` 及单元测试；
  3. 在 `SketchCanvas.vue` 中集成停顿手势与湿墨层形状平滑预览；
  4. 运行 `pnpm test` 和 `pnpm build`。

---

### Batch 5: 思源多窗口排他锁、跨端热重载与暗黑适配（P1 协同增强）

**核心目标**：借鉴 `siyuan-jsdraw-plugin` 的思源生态深度协同机制，解决多窗口并发与跨设备图片刷新难题。

- **任务清单**：
  1. 实现 `src/storage/kernelLock.ts`，基于思源 Kernel RPC 维护白板编辑排他锁与心跳维持；
  2. 实现 `src/storage/syncMarker.ts` 与 `src/storage/imageBuster.ts`，保存时写 marker，并在 `ws-main` 捕获后刷新文档中的 `<img>` 标签缓存；
  3. 在文档头部注入暗黑模式 SVG/PNG 智能反色 CSS 滤镜；
  4. 运行 `pnpm test` 和 `pnpm build`。

---

## 4. 验证与质量保证标准

1. **自动化单元测试（Vitest）**：
   - 输入点解构与 Coalesced Events 合并测试；
   - 物理稳定器动力学步进与细分插值边界测试；
   - 压感 EMA 滤波器平滑曲线测试；
   - 几何图形特征拟合与识别率测试；
   - 跨窗口锁状态机测试。
2. **真机与触控笔手感验证**：
   - 在 iPad / Surface / 压感手绘板上进行慢速画圆（验证无锯齿无手抖毛刺）；
   - 进行极速连笔草写（验证无折角、跟手无延迟）；
   - 在包含 > 1000 笔画的超大白板上书写（验证保持 120 FPS 满帧不掉帧）；
   - 测试末端停顿自动生成完美正圆和直线；
   - 多窗口打开同一白板验证排他锁拦截提示。

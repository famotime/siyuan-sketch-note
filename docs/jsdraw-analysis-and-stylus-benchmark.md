# siyuan-jsdraw-plugin 架构特性与手写笔流畅性深度分析报告

## 1. 概述与背景

[`siyuan-jsdraw-plugin`](file:///D:/MyCodingProjects/siyuan-jsdraw-plugin) 是一个基于 Svelte 4 与 `@massivebox/js-draw`（向量手绘库）构建的思源笔记手绘/白板插件。

本项目 [`siyuan-sketch-note`](file:///d:/MyCodingProjects/siyuan-sketch-note)（闲笔）则是基于 Vue 3 + HTML5 Canvas 2D 自研渲染引擎构建的专业级手写笔记插件。

为了进一步提升 `siyuan-sketch-note` 在触控笔（Apple Pencil / Surface Pen / Wacom / HUAWEI M-Pencil 等）书写与绘画时的**极致跟手性、笔迹平滑度、抗手抖稳定性以及多窗口/多端协同体验**，本文对 `siyuan-jsdraw-plugin` 的核心源码、渲染管线与交互机制展开深入逆向剖析与横向对标。

---

## 2. siyuan-jsdraw-plugin 核心特性与架构解析

`siyuan-jsdraw-plugin` 采用了轻量包装层 + 深度定制扩展的架构：

```
siyuan-jsdraw-plugin
├── src/
│   ├── index.ts               # 思源插件生命周期、斜杠命令、快捷键、WS 监听
│   ├── editor.ts              # 封装 js-draw Editor 实例、SVG 序列化与自动保存
│   ├── editor-manager.ts      # Tab / Dialog 窗口生命周期管理、互斥锁调度
│   ├── lock.ts / kernel.ts    # 思源 Kernel RPC 跨窗口排他锁与心跳维持
│   ├── refresh.ts / sync.ts   # 跨端同步标记 (Sync Marker) 与图片缓存击穿热重载
│   ├── theme.ts               # 思源明暗主题感知与 SVG CSS 智能反色滤镜
│   └── libs/
│       ├── CustomInputStabilizer.ts   # ★ 基于经典物理学的弹簧-质量-阻尼输入稳定器
│       ├── InputStabilizerOptions.ts  # 稳定器物理参数元数据与默认配置
│       ├── StylusSettingsWidget.ts    # 笔触参数可视化交互调节面板
│       └── AutocorrectOptions.ts      # 停顿手势自动识别几何形状配置
```

---

## 3. 手写笔流畅性核心机制深度剖析（重点）

在触控笔手写输入中，“流畅感”由三部分共同决定：
1. **输入延迟（Latency / 跟手度）**：从笔尖移动到像素上屏的时间差。
2. **轨迹平滑度（Smoothness / 曲线质量）**：消灭折线感、阶梯感与抖动杂音。
3. **笔压过渡感（Dynamics / 动力学质感）**：速度与压力的自然衰减与过渡。

`siyuan-jsdraw-plugin` 的核心亮点在于实现了基于**经典物理动力学（Spring-Mass-Damper System）**的自驱动输入稳定器，并在工具栏内嵌了完整的参数调优界面。

### 3.1 物理弹簧-质量-阻尼输入稳定器 (`CustomInputStabilizer.ts`)

#### (1) 数学与物理模型推导

传统绘图软件的平滑通常使用简单的几何平均或二次贝塞尔中点平滑（`siyuan-sketch-note` 目前也是如此），当手写速度较慢或有生理性微抖时，笔迹会出现明显的毛刺或抖动。

`siyuan-jsdraw-plugin` 在 [`src/libs/CustomInputStabilizer.ts`](file:///D:/MyCodingProjects/siyuan-jsdraw-plugin/src/libs/CustomInputStabilizer.ts) 中引入了虚拟质点物理模拟系统：
- 将**笔尖实际位置**视为目标吸引源（$P_{\text{target}}$）；
- 将**绘制点**视为一个带有质量 $m$ 的虚拟质点（$P_{\text{stroke}}$），由胡克定律弹性绳拉向目标点；
- 引入运动阻尼（动摩擦阻尼与速度衰减），消除简谐振动带来的高频震荡；
- 引入惯性系数，使得高速挥笔时能保持流畅惯性，低速细写时能精准跟随。

物理受力与运动公式如下：

$$F_{\text{spring}} = k \cdot (P_{\text{target}} - P_{\text{stroke}})$$

$$F_{\text{friction}} = -\mu \cdot m \cdot g \cdot \frac{v}{\|v\|}$$

$$a = \frac{F_{\text{spring}} + F_{\text{friction}}}{m}$$

$$v_{\text{spring}} = v \cdot (1 - \text{decayFactor}) + a \cdot \Delta t$$

$$v_{\text{final}} = \text{lerp}\left(\frac{P_{\text{target}} - P_{\text{stroke}}}{\|P_{\text{target}} - P_{\text{stroke}}\|} \cdot \|v_{\text{spring}}\|, v_{\text{spring}}, \text{inertiaFraction}\right)$$

$$P_{\text{stroke}} = P_{\text{stroke}} + v_{\text{final}} \cdot \Delta t$$

#### (2) RAF 自驱动细分循环（Sub-stepping & rAF Loop）

稳定器脱离了单一依赖 `pointermove` 的被动触发模式，采用 `requestAnimationFrame` 自主运行物理模拟循环：

```typescript
// 循环逻辑核心简化
private async loop() {
    this.lastUpdateTime = performance.now();
    while (this.runLoop) {
        this.update(false);
        await untilNextAnimationFrame();
    }
}
```

在每一次物理更新步长中，如果质点位移超过了设定的最大点距 `maxPointDist`，算法会执行**自适应时间步细分（Sub-stepping）**：

```typescript
let parts = 1;
do {
    velocity = this.getNextVelocity(deltaTime / parts);
    deltaX = velocity.times(deltaTime / 1000);
    parts++;
} while (deltaX.magnitude() > this.options.maxPointDist && parts < 10);
```

**这一设计的巨大价值：**
- **消除快速落笔断线**：当触控笔快速划过屏幕时，即使浏览器的 PointerEvent 采样率有限，物理细分也能均匀生成平滑中间点，绝不产生长直线折角。
- **慢速书写极致平滑**：当手部微颤时，弹簧系统作为天然的**物理低通滤波器（Low-pass Filter）**，过滤掉高于临界阻尼频率的高频毛刺，呈现如墨水在纸张上自然流淌的质感。

#### (3) 物理参数矩阵与调优维度

在 [`src/libs/InputStabilizerOptions.ts`](file:///D:/MyCodingProjects/siyuan-jsdraw-plugin/src/libs/InputStabilizerOptions.ts) 中定义了可配置参数：

| 参数名 | 默认值 | 调节范围 | 物理意义与书写手感影响 |
| :--- | :--- | :--- | :--- |
| `mass` (质量) | `0.4` | `0.1 ~ 2.0` | 增大质点质量会增加笔尖重量感与滞后感，抗抖性提升，但响应会略微延迟 |
| `springConstant` (弹性系数) | `100.0` | `10 ~ 500` | 增大拉力会提高跟手速度，减小拖尾延迟；过大会失去平滑效果 |
| `frictionCoefficient` (阻尼系数) | `0.28` | `0.0 ~ 2.0` | 抑制弹簧振荡，模拟真实纸张摩擦阻尼感，消除过冲（Overshoot） |
| `maxPointDist` (最大点步长) | `10px` | `1 ~ 50` | 限制相邻点最大跨度，超过则触发细分插值，保证曲线精细度 |
| `inertiaFraction` (惯性比例) | `0.75` | `0.0 ~ 1.0` | 保持运动方向的惯性权重，赋予快速运笔时的流体书法感 |
| `velocityDecayFactor` (速度衰减) | `0.1` | `0.0 ~ 1.0` | 模拟空气阻力，防止快速停笔时笔触漂移甩尾 |
| `minSimilarityToFinalize` (收笔阈值)| `0.0` | `-1.0 ~ 1.0`| 抬笔收锋时判断速度方向与目标向量的点积，自动补齐笔画终点 |

---

### 3.2 停顿几何图形自动识别校正（Hold-to-Shape / Autocorrect）

在 [`src/libs/StylusSettingsWidget.ts`](file:///D:/MyCodingProjects/siyuan-jsdraw-plugin/src/libs/StylusSettingsWidget.ts) 与 [`AutocorrectOptions.ts`](file:///D:/MyCodingProjects/siyuan-jsdraw-plugin/src/libs/AutocorrectOptions.ts) 中：
- 当用户绘制笔画（如画圆、画直线、画多边形）后，笔尖在末端**停顿保持静止**超过 `minTimeSeconds`（默认 0.5s）；
- 停顿检测器（`stationaryDetector`）检测到笔尖当前瞬时速度低于 `maxSpeed`（8.5）且位移波动在 `maxRadius`（11px）以内；
- 触发自动图形拟合，将刚画完的草图笔迹自动规整为完美的几何直线、矩形、椭圆或正多边形。

这一交互非常符合 iPadOS Apple Notes / GoodNotes / Procreate 的习惯，对画思维导图、流程图和手绘框图极其友好。

---

### 3.3 湿墨图层与干墨图层分离（Wet Ink Canvas vs Dry Layer）

`js-draw` 底层采用了类似专业数字绘画引擎的双层渲染：
1. **Wet Ink Canvas（湿墨层）**：单笔正在书写时，仅在最顶层独立 Canvas 上实时根据物理稳定器输出绘制当前笔画（`wetInkCanvas`），设置了专用的毛毡笔尖光标；
2. **Dry Layer（干墨层）**：抬笔（PointerUp）后，将湿墨笔迹转化为经过二次简化的 SVG 向量路径并合并入主场景。
3. **优势**：无论画板上累计了多少万个历史笔画，正在书写时的当前帧率始终能恒定跑满 60Hz/120Hz，彻底杜绝输入卡顿。

---

## 4. 其他值得借鉴的工程与架构特性

### 4.1 思源 Kernel RPC 跨窗口排他锁与代际保护（Cross-Window Kernel Lock）

#### 痛点
思源笔记支持多窗口（在新窗口打开文档、分屏、悬浮窗）。如果用户在多个窗口同时打开了同一张手写白板进行编辑，会导致相互覆盖丢失数据的严重并发冲突。

#### `siyuan-jsdraw-plugin` 的解决方案 (`src/kernel.ts` + `src/lock.ts`)
- 利用思源 Kernel 后台插件能力（`siyuan/kernel`），在内核进程维护全局锁表 `locks = new Map<string, Lock>()`；
- 每次打开白板前通过 `api.rpc.call("acquire", filename, editorId)` 申请锁；
- 内核分配单调递增的 `generation`（代际令牌），并启动心跳机制（`heartbeat` 每 2s 一次）；
- 当窗口发生迁移、重载或异常崩溃时，若超过 `LOCK_STALE_MS`（5s）未收到心跳则自动淘汰失效锁；
- 若已被其他窗口锁定，则直接拦截并弹出友好警告，避免脏数据写入。

### 4.2 跨端同步标记与图片缓存击穿（Sync Marker & Cache Busting）

#### 痛点
思源笔记同步机制会同步 `/data/assets/` 下的手绘 SVG/PNG，但思源前端**不会为 assets 的变更向插件发送实时通知**，且思源内部 `<img>` 标签有很强的浏览器内存缓存，导致在 PC 端修改了白板，在 iPad 端即便同步完成也无法自动刷新，甚至需要重启思源。

#### `siyuan-jsdraw-plugin` 的解决方案 (`src/sync.ts` + `src/refresh.ts`)
1. **写同步标记**：每次保存白板除了写入 asset 外，额外向插件专属 `storage/` 目录写一个轻量的 `sync-marker.json`（更新 `timestamp`）。由于插件 storage 会被思源完整监听并在多端同步，多端收到后会触发思源内核的 `ws-main: reloadPlugin` 广播；
2. **多端感知刷新**：插件在 `ws-main` 中捕获后，调用 `refreshAllSVGImages()`；
3. **缓存击穿**：使用 `fetch(imageURL, { cache: 'reload' })` 强制从思源服务器重新加载最新文件，随后动态重置 `img.src`，实现全自动无感热重载。

### 4.3 智能暗色模式反色滤镜（Smart Color Inversion Filter）

#### 机制 (`src/theme.ts`)
针对白板保存的深色/浅色内容，通过在思源文档头部注入 CSS 滤镜矩阵：
```css
html[data-theme-mode="dark"] img[src^="assets/jsdraw-"] {
    filter: grayscale(0%) invert(88.1%) contrast(100%) brightness(100%) hue-rotate(180deg);
}
```
保证在白天模式绘制的黑色线条在暗黑模式下自动反转为易读的明亮线条，且彩色笔迹（通过 `hue-rotate(180deg)`）保持原本色相不失真。

---

## 5. 横向对比：`siyuan-sketch-note` vs `siyuan-jsdraw-plugin`

| 维度 | siyuan-sketch-note (当前闲笔) | siyuan-jsdraw-plugin | 对标差距与优化空间 |
| :--- | :--- | :--- | :--- |
| **技术栈** | Vue 3 + TypeScript + 自研 Canvas 2D | Svelte 4 + `@massivebox/js-draw` | 闲笔组件化更好，但 js-draw 笔触算法更成熟 |
| **手写笔事件采样** | 仅获取单点 `e.clientX/Y`，**未利用 Coalesced Events** | 采用 js-draw 内部事件转换器 | **闲笔高刷屏快速运笔丢点严重，急需补充** |
| **笔迹预测** | 无 | 无 | **闲笔可率先实现 `getPredictedEvents()` 零延迟体验** |
| **平滑防抖算法** | 基础二次中点 Bézier + 距离阈值过滤 | **物理弹簧-质量-阻尼稳定器 + rAF 细分插值** | **闲笔急需引入 Spring-Mass 物理平滑模型** |
| **压感平滑** | 瞬时原始压感 + Sigmoid 映射（缺乏时序滤波） | 压感曲线映射 + 物理阻尼分配 | **闲笔需增加压感低通平滑（EMA），消除竹节毛刺** |
| **长按停顿校正** | 仅用于长按拖拽选中元素 | **智能识别并规整几何图形（Hold-to-Shape）** | **闲笔可将停顿手势升级为图形自动校正** |
| **多图层渲染隔离** | 背景 Canvas + 笔画 Canvas（部分操作仍全量重绘） | **Wet Ink Canvas（湿墨） + Dry SVG Layer** | **闲笔需彻底拆分当前活动笔画的独立湿墨层** |
| **跨窗口并发保护** | 无跨窗口锁机制 | **Kernel RPC 跨窗口排他锁与代际 Heartbeat** | **值得借鉴引入** |
| **跨端同步与热刷新** | 保存 PNG 缩略图，需手动刷新或重新进文档 | **Sync Marker + Fetch Cache-Reload 击穿缓存** | **极大提升多设备（PC/平板）无缝同步体验** |
| **多笔刷 Profile** | **支持钢笔/圆珠笔/毛笔/铅笔/荧光笔多预设** | 仅标准 Pen（支持配置多颜色槽位） | 闲笔在笔刷多样性上占优，需将平滑算法赋能各笔刷 |
| **富媒体与编辑** | **支持图片变换、套索缩放、分页、回放录制、OCR** | 基础向量编辑 | 闲笔在笔记全功能商业化上具有更强架构深度 |

---

## 6. 结论与借鉴建议

`siyuan-jsdraw-plugin` 为我们提供了极其宝贵的手写交互与工程落地参考。
结合 `siyuan-sketch-note` 的现有架构，最值得立即借鉴和突破的核心要点如下：

1. **手写笔输入管线全面重构**：
   - 接入 `PointerEvent.getCoalescedEvents()`（高采样率融合）与 `PointerEvent.getPredictedEvents()`（手写预测，抵消视觉延迟）；
   - 建立 **Spring-Mass-Damper 物理稳定器算法** 与可配置的物理参数系统；
   - 增加 **压感指数移动平均滤波（EMA Filter）**，消除手写断触与毛刺。
2. **渲染管线升级为真正三层架构（Triple-Buffer Pipeline）**：
   - Background Canvas（背景/模板） + Dry Ink Canvas（干墨已固化笔画/图片/文字） + Wet Ink Canvas（湿墨当前活动笔画/预览）；
   - 书写时干墨层保持静止，湿墨层每秒 120 帧极速局部重绘，抬笔时一次性合批固化。
3. **长按停顿智能几何规整（Hold-to-Shape）**；
4. **思源生态协同增强（Kernel Lock & Sync Marker 热重载）**。

具体的实施落地计划请参见配套方案文档：[`docs/stylus-smoothness-and-feature-optimization-plan.md`](file:///d:/MyCodingProjects/siyuan-sketch-note/docs/stylus-smoothness-and-feature-optimization-plan.md)。

# 思源笔记手写插件 (Sketch Note) 设计文档

> 状态：已审阅（架构修正：使用代码块替代挂件块）  
> 日期：2026-05-23  
> 范围：MVP v0.1.0

---

## 1. 目标

为思源笔记提供手写插件，用户可在平板/手机上通过手写笔（或手指）输入原始笔记。插件预制稿纸模板，手写内容以图片方式在文档中展示和导出，支持二次编辑（擦除、撤销等）。

**关键约束：**
- 纯 Web API 实现，不依赖任何原生 SDK
- 只要思源笔记移动端能运行，插件即可工作
- MVP 范围：自定义手写块 + 矢量笔迹 + 基础画笔 + 橡皮擦 + 撤销重做 + 2 种模板

---

## 2. 整体架构

```
┌─────────────────────────────────────────────────┐
│                 思源笔记宿主                       │
│  ┌───────────────────────────────────────────┐  │
│  │           插件入口 (index.ts)              │  │
│  │  - 注册事件监听                            │  │
│  │  - 添加顶栏按钮「插入手写块」              │  │
│  │  - 拦截代码块渲染（sketch-note 语言）      │  │
│  └──────────┬────────────────────────────────┘  │
│             │                                    │
│  ┌──────────▼────────────────────────────────┐  │
│  │      代码块渲染层 (SketchRenderer)          │  │
│  │  - 监听 loaded-protyle-static/dynamic      │  │
│  │  - 查找 data-subtype="sketch-note"         │  │
│  │  - 从插件存储加载缩略图并替换渲染           │  │
│  │  - 点击 → 打开全屏编辑器                   │  │
│  └──────────┬────────────────────────────────┘  │
│             │                                    │
│  ┌──────────▼────────────────────────────────┐  │
│  │       全屏编辑器 (SketchEditor)            │  │
│  │  ┌──────────────┐  ┌──────────────────┐  │  │
│  │  │ Canvas Engine │  │  Toolbar (Vue)   │  │  │
│  │  │ - PointerEvent│  │ - 画笔/橡皮切换  │  │  │
│  │  │ - 笔迹采样     │  │ - 颜色/粗细     │  │  │
│  │  │ - 渲染管线     │  │ - 模板切换       │  │  │
│  │  │ - 撤销/重做    │  │ - 撤销/重做/清除 │  │  │
│  │  └──────────────┘  └──────────────────┘  │  │
│  └──────────┬────────────────────────────────┘  │
│             │                                    │
│  ┌──────────▼────────────────────────────────┐  │
│  │       数据层 (SketchStorage)               │  │
│  │  - serializeStrokes() → JSON               │  │
│  │  - exportPNG() → Blob                      │  │
│  │  - 插件存储: loadData/saveData             │  │
│  │  - 键: "sketch:{blockId}"                  │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**核心模块划分：**

| 模块 | 职责 | 文件 |
|------|------|------|
| `SketchPlugin` | 插件入口，生命周期管理，事件注册 | `src/index.ts` |
| `SketchRenderer` | 拦截代码块渲染，显示缩略图，触发编辑 | `src/widget/` |
| `SketchEditor` | 全屏画布编辑器（Canvas 引擎 + 工具栏） | `src/editor/` |
| `SketchStorage` | 笔迹序列化、PNG 导出、插件存储读写 | `src/storage/` |

---

## 3. 数据模型

### 3.1 笔迹数据结构

```typescript
// 单个采样点
interface StrokePoint {
  x: number;           // 画布坐标
  y: number;
  pressure: number;    // 0~1，PointerEvent.pressure，无压感时默认 0.5
  timestamp: number;   // ms
}

// 单条笔画（一次 pointerdown → pointerup）
interface Stroke {
  id: string;              // uuid
  points: StrokePoint[];
  color: string;           // hex，如 "#000000"
  width: number;           // 基础线宽 px
  tool: "pen" | "eraser";  // 工具类型
}

// 一个手写块的完整数据
interface SketchData {
  version: 1;
  template: string;        // 模板标识，如 "blank" | "grid"
  canvasWidth: number;     // 逻辑画布宽
  canvasHeight: number;    // 逻辑画布高（可自动增长）
  strokes: Stroke[];
}
```

### 3.2 数据量估算

| 场景 | 笔画数 | 点数/笔画 | JSON 大小 | PNG 大小 |
|------|--------|-----------|-----------|----------|
| 简单速记 | ~20 | ~50 | ~50 KB | ~30 KB |
| 一页笔记 | ~100 | ~80 | ~300 KB | ~80 KB |
| 复杂绘图 | ~500 | ~150 | ~2 MB | ~200 KB |

### 3.3 在思源中的存储

**块类型：** 使用代码块（NodeCodeBlock）+ 自定义语言 `sketch-note`，与 ECharts/Mermaid/脑图使用相同的渲染拦截模式。

**代码块 DOM 结构：**

```html
<div data-node-id="{blockId}" 
     data-type="NodeCodeBlock" 
     data-subtype="sketch-note">
  <div class="protyle-action">
    <span class="protyle-action__language">sketch-note</span>
  </div>
  <div class="protyle-wysiwyg__dom">
    <code class="language-sketch-note">{blockId}</code>
  </div>
</div>
```

**代码块内容：** 仅存储 blockId（用于查找插件存储中的数据）

**插件存储（通过 `saveData`/`loadData`）：**

```json
// key: "sketch:{blockId}"
{
  "version": 1,
  "template": "blank",
  "canvasWidth": 800,
  "canvasHeight": 1200,
  "strokes": [ ... ],
  "thumbnail": "data:image/png;base64,..." 
}
```

---

## 4. Canvas 引擎

### 4.1 双层渲染架构

```
Layer 0: 背景层（模板）    ← 仅在模板切换/画布增长时重绘
Layer 1: 笔迹层（动态）    ← 每帧实时重绘当前笔画
```

两个独立的 Canvas 元素叠放，背景层性能开销低，笔迹层高频更新不影响背景。

### 4.2 笔迹渲染

- 使用 `CanvasRenderingContext2D` 的 `lineTo` 逐点连线
- `lineJoin: "round"` + `lineCap: "round"` 实现平滑笔触
- MVP 阶段不做压力感应线宽变化（压力数据已采集存储，为后续版本准备）
- 直接使用 PointerEvent 原始坐标，不做额外采样降频

### 4.3 橡皮擦

使用 `globalCompositeOperation = "destination-out"` 实现像素级擦除，用户可精确擦除笔画的一部分。每次抬起笔视为一次完整的擦除操作，纳入撤销/重做栈。

### 4.4 撤销/重做

栈式实现：

```
undoStack: Stroke[][]  ← 每次完成一笔，push strokes 快照
redoStack: Stroke[][]  ← 撤销时从 undoStack pop，push 到此

撤销 → undoStack.pop() → 当前状态 push 到 redoStack
重做 → redoStack.pop() → 当前状态 push 到 undoStack
```

### 4.5 DPI 适配

```
canvas.width  = 逻辑宽 × devicePixelRatio
canvas.style.width = 逻辑宽 + "px"
ctx.scale(devicePixelRatio, devicePixelRatio)
```

确保高分屏（iPad Retina 等）上笔迹不模糊。

### 4.6 画布尺寸

- 逻辑宽度：固定 800px
- 高度：初始 1200px，用户写到底部时自动增长（每次 +600px）
- MVP 不支持无限画布/缩放

---

## 5. UI/UX 设计

### 5.1 文档内状态（挂件块展示）

- 缩略图宽度跟随文档容器，高度按比例自适应
- hover 时显示「点击编辑」浮层
- 使用思源原生 CSS 变量适配明暗主题

### 5.2 全屏编辑器布局

```
┌──────────────────────────────────────────┐
│  ← 返回    白纸 ▾    手写笔记    💾 保存   │  ← 顶栏
├──────────────────────────────────────────┤
│                                          │
│           Canvas 画布区域                 │
│         (触摸滚动禁用，全部用于绘图)        │
│                                          │
├──────────────────────────────────────────┤
│  ●  ●  ●  ●  ●  │  ✏️ 🧹 │ ↩️ ↪️  🗑️  │  ← 底部工具栏
│  (5色预设)        │ 画笔 橡皮│ 撤销 重做 清除│
└──────────────────────────────────────────┘
```

**顶栏：**
- `← 返回`：保存并关闭编辑器
- `白纸 ▾`：模板切换下拉（白纸 / 方格纸）
- 标题文字
- `💾 保存`：手动保存（返回时也会自动保存）

**底部工具栏：**
- 5 色预设：黑 `#000000`、红 `#e74c3c`、蓝 `#3498db`、绿 `#2ecc71`、橙 `#f39c12`
- 画笔/橡皮模式切换
- 撤销、重做、清除全部
- 工具栏固定底部，方便单手操作

### 5.3 交互细节

| 交互 | 行为 |
|------|------|
| 手指触摸 | 禁用页面滚动，全部作为绘图输入 |
| 单指绘图 | 正常画笔 |
| 双指缩放 | MVP 不支持（锁定 1:1） |
| 点击返回 | 自动保存 → 关闭编辑器 → 更新缩略图 |
| 物理返回键 | 移动端拦截，等同「保存并返回」 |
| 未保存关闭 | 弹出确认对话框 |

### 5.4 创建入口

- **方式 1：** 顶栏按钮「插入手写块」→ 在光标位置插入挂件块 → 自动打开编辑器
- **方式 2：** 斜杠命令 `/sketch` → 同上

---

## 6. 模板系统

### 6.1 模板接口

```typescript
interface Template {
  id: string;
  name: string;  // i18n key
  render: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
}
```

### 6.2 MVP 模板

| 模板 | 效果 |
|------|------|
| `blank` | 纯白背景 |
| `grid` | 5mm 方格，浅灰 `#e0e0e0`，线宽 0.5px |

### 6.3 渲染时机

- 编辑器打开 → 渲染到背景层
- 切换模板 → 清除背景层 → 重新渲染
- 画布高度增长 → 扩展背景层 → 渲染新区域

---

## 7. 数据流

### 7.1 创建手写块

```
用户点击「插入手写块」
  → 1. /api/block/insertBlock 插入代码块
     dataType: "markdown", data: "```sketch-note\n{blockId}\n```"
  → 2. saveData("sketch:{blockId}", { version:1, strokes:[], thumbnail:null })
  → 3. 打开全屏编辑器（空白画布）
```

### 7.2 保存

```
用户点击「保存」或「返回」
  → 1. canvasEngine.serializeStrokes() → strokes 数组
  → 2. canvasEngine.exportPNG(thumbnailCanvas) → base64 data URL
  → 3. saveData("sketch:{blockId}", { version, template, strokes, thumbnail })
  → 4. 关闭编辑器，渲染层自动更新缩略图
```

### 7.3 二次编辑

```
用户点击缩略图
  → 1. loadData("sketch:{blockId}") → 加载存储数据
  → 2. 打开编辑器，恢复笔迹到 Canvas
  → 3. 用户编辑
  → 4. 保存时覆写同一 key
```

---

## 8. 错误处理

| 场景 | 处理方式 |
|------|----------|
| 保存失败（存储满） | Toast 提示用户，保留编辑器不关闭，支持重试 |
| 插件存储数据损坏 | 提示「手写数据异常」，显示空状态占位图 |
| 缩略图生成失败 | 降级：显示「手写笔记」文字占位 |
| 触摸与页面滚动冲突 | 编辑器打开时 body 加 `overflow: hidden`，阻止 touchmove 默认行为 |
| 未保存直接关闭 | 拦截返回键，弹确认对话框 |

---

## 9. 性能考量

| 项目 | 策略 |
|------|------|
| 长笔画渲染 | 每帧仅重绘当前笔画，不全量重绘历史 |
| 缩略图生成 | 独立小尺寸 Canvas（宽 400px），不复用编辑画布 |
| 大文件 JSON | MVP 不分片；单个 sketch 数据超 5MB 提示用户拆分 |
| DPI 缩放 | 初始化时设置一次 `ctx.scale(dpr, dpr)` |

---

## 10. i18n

```json
// zh_CN.json 新增
{
  "pluginName": "手写笔记",
  "insertSketch": "插入手写块",
  "sketch": "手写笔记",
  "clickToEdit": "点击编辑",
  "template_blank": "白纸",
  "template_grid": "方格纸",
  "pen": "画笔",
  "eraser": "橡皮",
  "undo": "撤销",
  "redo": "重做",
  "clear": "清除",
  "save": "保存",
  "back": "返回"
}
```

---

## 11. 文件结构

```
src/
├── index.ts                    # 插件入口（改造自模板）
├── main.ts                     # Vue app 生命周期（保留）
├── api.ts                      # SiYuan API 封装（保留）
├── index.scss                  # 全局样式
│
├── editor/                     # 全屏编辑器模块
│   ├── SketchEditor.vue        # 编辑器主组件（全屏容器）
│   ├── SketchCanvas.vue        # Canvas 画布组件
│   ├── SketchToolbar.vue       # 底部工具栏
│   └── canvasEngine.ts         # Canvas 引擎（纯 TS）
│
├── widget/                     # 代码块渲染模块
│   └── SketchRenderer.ts       # 代码块渲染拦截（替换缩略图）
│
├── template/                   # 模板系统
│   ├── index.ts                # 模板注册表
│   ├── blank.ts                # 白纸模板
│   └── grid.ts                 # 方格纸模板
│
├── storage/                    # 数据持久化
│   └── index.ts                # 序列化、PNG 导出、资产读写
│
├── types/
│   ├── sketch.ts               # 笔迹数据类型
│   ├── api.d.ts                # （保留）
│   └── index.d.ts              # （保留，扩展 Window 类型）
│
├── components/SiyuanTheme/     # （保留，复用）
├── i18n/                       # （扩展）
└── utils/                      # （保留）
```

---

## 12. MVP 功能清单

| 功能 | 状态 |
|------|------|
| 自定义「手写块」（代码块 + sketch-note 语言） | 待实现 |
| 矢量笔迹数据存储（插件存储） | 待实现 |
| 全屏画布编辑器 | 待实现 |
| 基础画笔（5 色） | 待实现 |
| 橡皮擦 | 待实现 |
| 撤销/重做 | 待实现 |
| 2 种模板（白纸、方格纸） | 待实现 |
| PNG 缩略图展示 | 待实现 |
| 代码块渲染拦截（ECharts/Mermaid 模式） | 待实现 |
| 二次编辑 | 待实现 |
| i18n（中/英） | 待实现 |
| 明暗主题适配 | 待实现 |

---

## 13. 已知限制（MVP 不解决）

- 无压感线宽变化（数据已采集，渲染未启用）
- 无荧光笔/马克笔模式
- 无笔画选择和移动
- 无 PDF 导出
- 无画布缩放/平移
- 无双指缩放
- 模板仅 2 种

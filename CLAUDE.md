# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

siyuan-sketch-note（闲笔）是思源笔记的手写插件，使用 HTML5 Canvas 实现矢量手写编辑器，嵌入思源文档作为块级元素。基于 Vue 3 + TypeScript + SiYuan Plugin SDK 构建。

## Commands

| 命令 | 说明 |
|------|------|
| `pnpm install` | 安装依赖 |
| `pnpm dev` | 开发模式（watch），输出到思源工作空间 `data/plugins/siyuan-sketch-note` |
| `pnpm build` | 生产构建，输出 `dist/` + `package.zip` |
| `pnpm test` | 运行 Vitest 单元测试 |
| `pnpm test -- --watch` | 测试 watch 模式 |
| `npx vitest run src/path/to/file.test.ts` | 运行单个测试文件 |
| `npx eslint src/` | 检查代码规范 |

## Architecture

### Plugin Lifecycle

`src/index.ts` 导出 `SketchNotePlugin`（继承 `Plugin`），实现 `onload()`/`onunload()` 生命周期。`src/main.ts` 负责 Vue 应用挂载/销毁，桥接插件 API。

### Component Hierarchy

```
App.vue (编辑器可见性管理、主题检测)
  └── SketchEditor.vue (全屏编辑器，业务编排，通过 composables 拆分逻辑)
       ├── EditorTopBar.vue (模板、撤销/重做、禅模式)
       ├── ToolBar.vue (工具按钮、颜色、撤销/重做)
       ├── ToolOptionsPopover.vue (粗细/透明度滑块)
       ├── FloatingToolbar.vue (浮动侧栏：颜色/粗细/透明度)
       └── SketchCanvas.vue (Canvas 绘制画布，通过 composables 拆分逻辑)
```

### Core Modules

- **`composables/`** — Vue 3 组合式函数，从编辑器组件中提取的可复用逻辑：
  - `useThemeDetection` — 主题检测（CSS 颜色解析、亮度计算、light/dark 判定），被 App.vue 和 SketchEditor.vue 共享
  - `useSaveManager` — 保存队列、自动保存（1.5s 防抖）、缩略图上传
  - `useColorPalettes` — 颜色选择、自定义颜色、删除、重置
  - `useOcrSearch` — OCR 识别、搜索导航
  - `useExportManager` — PNG/PDF/JSON 导出
  - `useEditorPreferences` — 触控笔模式、压感、模板持久化
  - `useZenMode` — 禅模式切换与拖拽定位
  - `useViewport` — 缩放/平移、双指手势、右键拖拽
  - `useTextEditing` — 文本元素创建与编辑
- **`editor/`** — 编辑器组件与业务逻辑模块：
  - `SketchEditor.vue`（主编排）、`SketchCanvas.vue`（Canvas 绘制画布）
  - `shortcuts.ts`（快捷键）、`clipboard.ts`（剪贴板）、`inputMode.ts`（输入模式）、`tools.ts`（工具切换）、`toolbarModel.ts`（工具栏状态）、`insertPosition.ts`（插入位置）、`textPointerAction.ts`（文本指针交互）
- **`elements/`** — 元素模型系统。`SketchElement` 判别联合类型（StrokeElement | ShapeElement | TextElement | ImageElement），包含 `model.ts`（核心类型、边界计算、`defaultTransform()`）、`shapes.ts`、`text.ts`、`image.ts`、`lasso.ts`/`lassoEdit.ts`（套索选区）、`transform.ts`、`renderOrder.ts`（z 序分层）
- **`engine/`** — Canvas 渲染引擎。`canvasEngine.ts` 是状态机，管理指针事件、笔迹渲染、撤销/重做、图片缓存（`clearImageCache()`）；`strokeSmoothing.ts` 处理点过滤和贝塞尔曲线平滑；`strokeRenderer.ts` 笔迹渲染
- **`storage/`** — 数据持久化。通过 `plugin.saveData()`/`plugin.loadData()` 存取，`migrations.ts` 处理数据版本迁移和恢复，`thumbnail.ts` 生成缩略图（自动裁剪+橡皮合成），`saveQueue.ts` 保证顺序写入，`sketchIdentity.ts` 管理 sketch ID，`sketchIndex.ts` 追踪块关联，`cleanup.ts` 清理无效数据
- **`template/`** — 9 种内置稿纸模板 + 自定义背景。每个模板实现 `Template` 接口（id, nameKey, render），新增模板在 `index.ts` 注册
- **`export/`** — PNG/PDF/JSON 导出，共用 `utils/date.ts` 的 `pad()` 工具函数
- **`pages/`** — 多页模型
- **`search/`** — OCR 识别与搜索，`OcrProvider` 可插拔注入
- **`tools/`** — 工具预设、最近颜色管理和画笔配置（`brushProfiles.ts`）
- **`recorder/`** — 操作回放系统：录制（`recorder.ts`）、播放（`player.ts`）、状态重建（`reconstruct.ts`）
- **`feature-flags/`** — Alpha 功能开关，控制实验性/隐藏设置
- **`utils/`** — 通用工具函数：`date.ts`（日期格式化 `pad()`）、`uploadPng.ts`（SiYuan 资源上传）、`sketchReference.ts`（sketch ID 提取、markdown 构建）、`compress.ts`（数据压缩）、`confirm.ts`（确认对话框）、`logger.ts`（调试日志）、`workspace.ts`（工作空间路径）
- **`types/sketch.ts`** — 核心数据类型：`Stroke`、`SketchData`、`SketchTool`、`ToolPreset`；`types/index.d.ts` 扩展 Window 全局类型（`window.siyuan`、`window.sySketchNote`）

> 注意：`src/abandon/` 已废弃，被 tsconfig.json 排除，不应修改。

### Data Flow

手写数据以 `SketchData` 存储（strokes + elements + template + 工具预设等）。自动保存 1.5s 防抖，通过 `saveQueue` 顺序写入 SiYuan 插件存储（key 前缀 `sketch:`）。保存时生成 PNG 缩略图上传到 `data/assets/`，作为文档中可见的嵌入图片。

### Build Configuration

- Vite 输出 CJS 格式（SiYuan 插件要求），`siyuan` 和 `process` 为外部依赖
- 路径别名 `@` → `src/`
- Dev 模式读 `.env` 的 `VITE_SIYUAN_WORKSPACE_PATH`，livereload 输出到思源插件目录
- 生产模式打包 `package.zip` 并拷贝 plugin.json/icon/preview 到 dist

## Coding Conventions

- ESLint 基于 `@antfu/eslint-config`，单引号、分号必须、2 空格缩进、多行尾逗号
- Vue SFC 块顺序：template → script → style（`<script setup lang="ts">`）
- 每个 Vue 属性独占一行（`vue/max-attributes-per-line: 1`）
- Vue 组件 PascalCase，模块 camelCase
- i18n key 在 `en_US.json` 和 `zh_CN.json` 间保持对齐
- 提交信息使用 Conventional Commit 前缀（feat/fix/docs/refactor），中文描述
- 测试文件与源文件共置，后缀 `.test.ts`（非 `.spec.ts`）

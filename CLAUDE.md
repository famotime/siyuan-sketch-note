# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

siyuan-sketch-note（闲笔，v0.9.0）是思源笔记的矢量手写编辑器插件。基于 Vue 3 (`<script setup lang="ts">`) + HTML5 Canvas + TypeScript + SiYuan Plugin SDK 构建，嵌入文档作为块级元素。

## Commands

| 命令 | 说明 |
|------|------|
| `pnpm install` | 安装依赖 |
| `pnpm dev` | 开发模式（watch），构建输出到思源工作空间插件目录 |
| `pnpm build` | 生产构建，输出 `dist/` + `package.zip` |
| `pnpm test` | 运行 Vitest 单元测试套件 |
| `npx vitest run src/path/to/file.test.ts` | 运行单个测试文件 |
| `npx eslint src/` | 代码规范检查 |
| `pnpm release:patch\|minor\|major` | 自动递增版本、打 tag 并发布 |

## Architecture

### Plugin Lifecycle

- `src/index.ts`：导出 `SketchNotePlugin`。负责插件加载/卸载、设置项面板、顶栏/命令注册、图片块 MutationObserver 注入编辑按钮、右键菜单（编辑/复制独立副本）以及光标位置感知插入。
- `src/main.ts`：Vue 应用的挂载、卸载及 API 桥接。
- `src/App.vue`：全屏/新标签页状态管理、多重算法实时主题检测与同步（CSS 变量/计算背景色/系统偏好）。

### Component Hierarchy

```
App.vue (编辑器可见性、多源主题同步、新标签页)
  └── SketchEditor.vue (全屏编辑器主编排，集成 composables 与实时投屏)
       ├── EditorTopBar.vue (模板选择、多页管理、撤销/重做、导出、搜索、实时投屏、回放入口)
       ├── ToolBar.vue (线框工具栏)
       │    └── ToolDropdown.vue (图形/画笔子类型下拉选择)
       ├── ToolOptionsPopover.vue (粗细/透明度滑块)
       ├── FloatingToolbar.vue (浮动侧栏：颜色/粗细/透明度/套索操作)
       │    └── PresetColorPalette.vue / ColorPickerPopup.vue (预设色盘与拾色器)
       ├── ReplayControls.vue (操作回放控制栏：播放/步进/调速/重构)
       └── SketchCanvas.vue (HTML5 Canvas 矢量绘制引擎表面)
```

### Core Modules

- **`composables/`** — Vue 3 组合式函数：
  - `useThemeDetection`：主题检测（CSS 解析、亮度计算、light/dark 判定）
  - `useSaveManager`：保存队列管理、1.5s 防抖自动保存、缩略图渲染上传
  - `useColorPalettes`：色盘选择、常用收藏色、自定义色彩、长按拾色器与重置
  - `usePenHoverTooltip`：移动端触控笔悬停与鼠标 Tooltips 提示
  - `useOcrSearch`：OCR 识别与画板文本检索导航
  - `useExportManager`：PNG/PDF/JSON 导出
  - `useEditorPreferences`：触控笔独占、压感开关、默认模板持久化
  - `useZenMode`：禅模式全屏切换与悬浮球拖拽定位
  - `useViewport`：缩放/平移、双指手势、右键拖动、重置视口
  - `useTextEditing`：文本元素创建与行内编辑
- **`editor/`** — 编辑器组件与业务逻辑（`shortcuts.ts`、`clipboard.ts`、`inputMode.ts`、`tools.ts`、`toolbarModel.ts`、`topBarLayout.ts`、`colorLongPress.ts`）。
- **`live/`** — 实时投屏/同步系统：
  - 基于思源 Broadcast 机制（SSE 订阅 `/api/broadcast/subscribe` + POST `/api/broadcast/post` 发送）
  - `useLiveSession.ts`：Writer（手机/平板端书写投屏）与 Viewer（PC 端大屏观看）双模式
  - `session.ts` / `transport.ts` / `viewerApply.ts` / `types.ts`：会话单调递增 revision 序号、环形事件缓存、断线断点续传与轻量增量渲染
- **`elements/`** — 元素模型系统（`SketchElement` 判别联合：StrokeElement | ShapeElement | TextElement | ImageElement）。包含边界计算、`defaultTransform()`、套索选择/变换（`lasso.ts`/`lassoEdit.ts`/`transform.ts`）与 Z 序分层（`renderOrder.ts`）。
- **`engine/`** — Canvas 渲染引擎：`canvasEngine.ts`（状态机、指针事件流、撤销/重做栈、图片缓存）、`strokeSmoothing.ts`（贝塞尔平滑）、`strokeRenderer.ts` / `penSubtypePressure.ts`（笔迹渲染与压感计算）。
- **`recorder/`** — 笔迹操作回放系统：录制（`recorder.ts`）、播放与调速（`player.ts`）、历史状态时间旅行与重建（`reconstruct.ts`）。
- **`storage/`** — 数据持久化：`saveQueue.ts`（顺序队列）、`migrations.ts`（数据迁移与容灾恢复）、`thumbnail.ts`（自动裁剪与橡皮擦合成）、`cleanup.ts`（无效手写块检测与清理）、`sketchIndex.ts`、`pluginSettings.ts`。
- **`template/`** — 9 种内置稿纸模板 + 自定义背景底图。
- **`export/`** — PNG、PDF、JSON 导出及从文件/图片中反向导入。
- **`pages/`** — 多页模型与分页导航。
- **`search/`** — 可插拔 OCR 引擎接口（`ocrProvider.ts`）与索引检索。
- **`tools/`** — 工具预设配置、色板管理与画笔特性（`brushProfiles.ts`）。
- **`feature-flags/`** — Alpha 实验功能与隐藏设置管理。
- **`utils/`** — 基础工具（`date.ts`、`uploadPng.ts`、`sketchReference.ts`、`workspace.ts`、`logger.ts`、`confirm.ts` 等）。
- **`types/`** — 核心类型（`SketchData`、`Stroke`、`SketchTool`、`LiveMessage` 等）。

> 注意：`src/abandon/` 目录已废弃且被编译排除，请勿修改。

### Data Flow

- **持久化流**：手写数据以 `SketchData` 存储。编辑变更触发 1.5s 防抖，通过 `saveQueue` 顺序写入插件存储（key `sketch:<id>`），并生成裁剪后 PNG 缩略图上传到 `data/assets/` 嵌入笔记文档。
- **实时同步流**：移动端作为 Writer 发送实时手写事件（SSE+Broadcast），PC 端作为 Viewer 订阅并增量渲染；断线通过 snapshot + revision 序号实现无缝断点续传。

### Build Configuration

- Vite 构建输出 CJS 格式（思源插件要求），`siyuan` 与 `process` 为 external 外部依赖
- 路径别名 `@` 映射至 `src/`
- Dev 模式读取 `.env` 的 `VITE_SIYUAN_WORKSPACE_PATH` 并实时输出到思源插件目录
- 生产构建输出至 `dist/`，打包生成 `package.zip` 并同步静态资源（plugin.json / icon / preview）

## Coding Conventions

- ESLint 基于 `@antfu/eslint-config`，单引号、分号必须、2 空格缩进、多行尾逗号
- Vue SFC 块顺序：template → script → style（`<script setup lang="ts">`）
- 每个 Vue 属性独占一行（`vue/max-attributes-per-line: 1`）
- Vue 组件 PascalCase，模块 camelCase
- i18n key 在 `en_US.json` 和 `zh_CN.json` 间保持对齐
- 提交信息使用 Conventional Commit 前缀（feat/fix/docs/refactor），中文描述
- 测试文件与源文件共置，后缀 `.test.ts`（非 `.spec.ts`）

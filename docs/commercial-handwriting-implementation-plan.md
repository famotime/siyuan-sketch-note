# Commercial Handwriting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `siyuan-sketch-note` 从基础手写块逐步升级为接近商业手写笔记软件的成熟应用。

**Architecture:** 先强化稳定的书写工具和数据模型，再扩展对象编辑、形状/尺子、混合内容、导出、OCR/AI。每个批次必须提供可运行代码、测试或明确的构建验证，并用中文 Conventional Commit 提交。

**Tech Stack:** Vue 3, TypeScript, Vite, Canvas 2D, Pointer Events, SiYuan Plugin SDK, Vitest.

---

## Batch 0: 基础治理与计划固化

**Files:**
- Create: `AGENTS.md`
- Create: `docs/noteshelf-commercial-roadmap.md`
- Create: `docs/commercial-handwriting-implementation-plan.md`
- Modify: `plugin.json`
- Modify: `README.md`

- [ ] 确认插件 ID 为 `siyuan-sketch-note`。
- [ ] README 说明插件 ID、开发构建目录和商业化路线入口。
- [ ] 保存 Noteshelf 对标路线图。
- [ ] 保存本实施计划。
- [ ] 运行 `pnpm build`。
- [ ] 提交：`docs: 补充商业化手写笔记开发计划`。

## Batch 1: P0 工具预设、荧光笔、笔宽与透明度

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `src/tools/presets.ts`
- Create: `src/tools/presets.test.ts`
- Modify: `src/types/sketch.ts`
- Modify: `src/engine/canvasEngine.ts`
- Modify: `src/storage/thumbnail.ts`
- Modify: `src/editor/SketchEditor.vue`
- Modify: `src/editor/SketchCanvas.vue`
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`
- Modify: `README.md`

- [ ] 添加 `vitest` 和 `pnpm test`。
- [ ] 先写 `createDefaultToolPresets`、`normalizeToolPreset`、`updateToolPreset` 的失败测试。
- [ ] 实现工具预设模块：笔、荧光笔、橡皮各自保存颜色、宽度、透明度和模式。
- [ ] 扩展 `SketchTool` 和 `Stroke`，支持 `highlighter` 与 `opacity`。
- [ ] 编辑器增加荧光笔按钮、笔宽滑杆、透明度滑杆。
- [ ] Canvas 引擎按当前预设生成 stroke，并在编辑器和缩略图中使用一致的透明度合成。
- [ ] 运行 `pnpm test` 和 `pnpm build`。
- [ ] 提交：`feat: 增加荧光笔与工具预设`。

## Batch 2: P0 笔迹质量升级

**Files:**
- Create: `src/engine/strokeSmoothing.ts`
- Create: `src/engine/strokeSmoothing.test.ts`
- Modify: `src/engine/canvasEngine.ts`
- Modify: `src/storage/thumbnail.ts`
- Modify: `src/types/sketch.ts`

- [ ] 测试点距过滤能减少抖动点。
- [ ] 测试平滑曲线输出稳定且保留端点。
- [ ] 引擎输入使用点距过滤。
- [ ] 渲染使用二次曲线平滑。
- [ ] 压感映射线宽，低压与高压产生可见宽度差。
- [ ] 运行 `pnpm test` 和 `pnpm build`。
- [ ] 提交：`feat: 优化手写笔迹平滑和压感渲染`。

## Batch 3: P1 元素模型与套索选择

**Files:**
- Create: `src/elements/model.ts`
- Create: `src/elements/model.test.ts`
- Create: `src/elements/lasso.ts`
- Create: `src/elements/lasso.test.ts`
- Modify: `src/types/sketch.ts`
- Modify: `src/storage/index.ts`
- Modify: `src/engine/canvasEngine.ts`
- Modify: `src/editor/SketchEditor.vue`
- Modify: `src/editor/SketchCanvas.vue`

- [ ] 定义 `SketchElement`、`StrokeElement`、`Bounds`、`Transform`。
- [ ] 测试 v1 `Stroke[]` 可迁移为 v2 elements。
- [ ] 测试 bounds 计算覆盖所有点和笔宽。
- [ ] 实现套索命中算法。
- [ ] UI 支持套索选中、移动、删除、改色。
- [ ] 撤销/重做覆盖元素操作。
- [ ] 运行 `pnpm test` 和 `pnpm build`。
- [ ] 提交：`feat: 引入元素模型和套索编辑`。

## Batch 4: P1 形状与尺子

**Files:**
- Create: `src/elements/shapes.ts`
- Create: `src/elements/shapes.test.ts`
- Create: `src/tools/ruler.ts`
- Create: `src/tools/ruler.test.ts`
- Modify: `src/editor/SketchCanvas.vue`
- Modify: `src/editor/SketchEditor.vue`
- Modify: `src/engine/canvasEngine.ts`

- [ ] 支持直线、箭头、矩形、椭圆。
- [ ] 测试形状序列化和 bounds。
- [ ] 实现可拖动、可旋转尺子状态。
- [ ] 测试点到尺边投影和角度吸附。
- [ ] UI 显示半透明尺子和角度。
- [ ] 运行 `pnpm test` 和 `pnpm build`。
- [ ] 提交：`feat: 增加形状工具和尺子辅助线`。

## Batch 5: P2 混合内容与模板库

**Files:**
- Create: `src/elements/text.ts`
- Create: `src/elements/image.ts`
- Create: `src/template/ruled.ts`
- Create: `src/template/dotted.ts`
- Create: `src/template/cornell.ts`
- Modify: `src/template/index.ts`
- Modify: `src/editor/SketchEditor.vue`
- Modify: `src/editor/SketchCanvas.vue`

- [ ] 文本框可插入、移动、保存、导出。
- [ ] 图片可粘贴/导入、移动、缩放、标注。
- [ ] 新增横线纸、点阵纸、康奈尔模板。
- [ ] 模板切换不改变已有元素坐标。
- [ ] 运行 `pnpm test` 和 `pnpm build`。
- [ ] 提交：`feat: 支持文本图片混合笔记和模板库`。

## Batch 6: P3 导出、搜索与长期可靠性

**Files:**
- Create: `src/export/png.ts`
- Create: `src/export/pdf.ts`
- Create: `src/search/ocrIndex.ts`
- Create: `src/storage/migrations.ts`
- Modify: `src/storage/index.ts`
- Modify: `src/editor/SketchEditor.vue`
- Modify: `README.md`

- [ ] 当前页导出 PNG。
- [ ] 多页准备结构与 PDF 导出接口。
- [ ] OCR 结果结构和手写块搜索索引。
- [ ] 数据迁移失败可回退。
- [ ] 保存队列串行化。
- [ ] 运行 `pnpm test` 和 `pnpm build`。
- [ ] 提交：`feat: 增加导出搜索和数据可靠性基础`。


# Commercial Handwriting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Status note:** 2026-05-24 已根据 `docs/commercial-handwriting-completion-audit.md` 对 Batch 0-6 做完成度回填。`[x]` 表示当前仓库有实现和测试/构建证据；`[~]` 表示已有基础但距离商业化路线仍有缺口。

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

- [x] 确认插件 ID 为 `siyuan-sketch-note`。
- [~] README 说明插件 ID、开发构建目录和商业化路线入口。仍需补充完成度审计和后续商业化批次入口。
- [x] 保存 Noteshelf 对标路线图。
- [x] 保存本实施计划。
- [x] 运行 `pnpm build`。
- [x] 提交：`docs: 补充商业化手写笔记开发计划`。

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

- [x] 添加 `vitest` 和 `pnpm test`。
- [x] 先写 `createDefaultToolPresets`、`normalizeToolPreset`、`updateToolPreset` 的失败测试。
- [x] 实现工具预设模块：笔、荧光笔、橡皮各自保存颜色、宽度、透明度和模式。
- [x] 扩展 `SketchTool` 和 `Stroke`，支持 `highlighter` 与 `opacity`。
- [x] 编辑器增加荧光笔按钮、笔宽滑杆、透明度滑杆。
- [x] Canvas 引擎按当前预设生成 stroke，并在编辑器和缩略图中使用一致的透明度合成。
- [x] 运行 `pnpm test` 和 `pnpm build`。
- [x] 提交：`feat: 增加荧光笔与工具预设`。

## Batch 2: P0 笔迹质量升级

**Files:**
- Create: `src/engine/strokeSmoothing.ts`
- Create: `src/engine/strokeSmoothing.test.ts`
- Modify: `src/engine/canvasEngine.ts`
- Modify: `src/storage/thumbnail.ts`
- Modify: `src/types/sketch.ts`

- [x] 测试点距过滤能减少抖动点。
- [x] 测试平滑曲线输出稳定且保留端点。
- [x] 引擎输入使用点距过滤。
- [x] 渲染使用二次曲线平滑。
- [x] 压感映射线宽，低压与高压产生可见宽度差。
- [x] 运行 `pnpm test` 和 `pnpm build`。
- [x] 提交：`feat: 优化手写笔迹平滑和压感渲染`。

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

- [x] 定义 `SketchElement`、`StrokeElement`、`Bounds`、`Transform`。
- [~] 测试 v1 `Stroke[]` 可迁移为 v2 elements。当前有兼容迁移证据，但数据版本仍为 `version: 1`。
- [x] 测试 bounds 计算覆盖所有点和笔宽。
- [x] 实现套索命中算法。
- [x] UI 支持套索选中、移动、删除、改色。
- [x] 撤销/重做覆盖元素操作。
- [x] 运行 `pnpm test` 和 `pnpm build`。
- [x] 提交：`feat: 引入元素模型和套索编辑`。

## Batch 4: P1 形状与尺子

**Files:**
- Create: `src/elements/shapes.ts`
- Create: `src/elements/shapes.test.ts`
- Create: `src/tools/ruler.ts`
- Create: `src/tools/ruler.test.ts`
- Modify: `src/editor/SketchCanvas.vue`
- Modify: `src/editor/SketchEditor.vue`
- Modify: `src/engine/canvasEngine.ts`

- [x] 支持直线、箭头、矩形、椭圆。
- [x] 测试形状序列化和 bounds。
- [x] 实现可拖动、可旋转尺子状态。
- [x] 测试点到尺边投影和角度吸附。
- [x] UI 显示半透明尺子和角度。
- [x] 运行 `pnpm test` 和 `pnpm build`。
- [x] 提交：`feat: 增加形状工具和尺子辅助线`。

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

- [~] 文本框可插入、移动、保存、导出。基础文本框已实现，富文本仍未完成。
- [~] 图片可粘贴/导入、移动、缩放、标注。基础图片元素已实现，裁剪、替换和成熟手柄交互仍未完成。
- [x] 新增横线纸、点阵纸、康奈尔模板。
- [x] 模板切换不改变已有元素坐标。
- [x] 运行 `pnpm test` 和 `pnpm build`。
- [x] 提交：`feat: 支持文本图片混合笔记和模板库`。

## Batch 6: P3 导出、搜索与长期可靠性

**Files:**
- Create: `src/export/png.ts`
- Create: `src/export/pdf.ts`
- Create: `src/search/ocrIndex.ts`
- Create: `src/storage/migrations.ts`
- Modify: `src/storage/index.ts`
- Modify: `src/editor/SketchEditor.vue`
- Modify: `README.md`

- [x] 当前页导出 PNG。
- [x] 多页准备结构与 PDF 导出接口。
- [~] OCR 结果结构和手写块搜索索引。仅有结构与函数，真实 OCR 和 UI 搜索闭环未完成。
- [x] 数据迁移失败可回退。
- [x] 保存队列串行化。
- [x] 运行 `pnpm test` 和 `pnpm build`。
- [x] 提交：`feat: 增加导出搜索和数据可靠性基础`。

## Batch 7: 完成度治理与发布前基线

**Files:**
- Create: `docs/commercial-handwriting-completion-audit.md`
- Create: `docs/manual-verification-checklist.md`
- Create: `docs/plugin-release-preflight.md`
- Modify: `docs/commercial-handwriting-implementation-plan.md`

- [x] 根据当前代码证据补充完成度审计。
- [x] 将 Batch 0-6 checkbox 与审计状态对齐。
- [x] 建立手动验证清单：插入手写块、保存、重开、缩略图、分页、导出、JSON 恢复、移动端触控笔。
- [x] 执行 SiYuan 插件发布预检，记录 `plugin.json`、README、图标、预览图、`package.zip` 内容和版本。
- [x] 明确当前不纳入提交的本地资产变更：`icon.png`、`package.zip`。
- [x] 运行 `pnpm test` 和 `pnpm build`。
- [x] 提交：`docs: 对齐商业手写开发计划状态`。

## Batch 8: 专业编辑器 UI 产品化

**Files:**
- Create: `src/editor/EditorTopBar.vue`
- Create: `src/editor/ToolBar.vue`
- Create: `src/editor/ToolOptionsPopover.vue`
- Modify: `src/editor/SketchEditor.vue`
- Modify: `src/editor/SketchCanvas.vue`
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`

- [x] 拆分顶栏、工具栏和工具属性面板。
- [x] 使用图标优先的工具按钮，并提供 tooltip 和可访问标签。
- [x] 将颜色、宽度、透明度、橡皮模式、套索模式迁移到浮动属性面板。
- [x] 优化小屏横向滚动和画布可用面积。
- [x] 增加 UI 状态测试或交互状态测试。
- [x] 运行 `pnpm test` 和 `pnpm build`。
- [x] 提交：`refactor: 优化手写编辑器工具栏体验`。

## Batch 7.1: 发布阻断整改

**Files:**
- Create: `src/release/preflight.test.ts`
- Modify: `plugin.json`
- Modify: `LICENSE`
- Modify: `src/index.ts`
- Modify: `vite.config.ts`
- Modify: `icon.png`
- Modify: `package.zip`
- Modify: `docs/plugin-release-preflight.md`

- [x] 为发布元数据、图标大小、LICENSE、快捷键和打包冗余目录新增失败测试。
- [x] 修复 `plugin.json.url`、`author`、`frontends`、`backends` 和空 `funding.custom`。
- [x] 更新 LICENSE 年份和版权人。
- [x] 将插件命令快捷键改为 SiYuan 原生 Unicode 修饰键格式。
- [x] 移除打包内冗余 `i18n/` 静态目录。
- [x] 生成 160x160 且小于 20 KB 的 `icon.png`。
- [x] 重新构建 `package.zip`。
- [x] 运行 `pnpm test`、`pnpm build` 和 SiYuan 插件发布预检。
- [x] 提交：`fix: 修复插件发布预检阻断项`。

## Batch 9: 真实 OCR 与搜索闭环

**Files:**
- Create: `src/search/ocrProvider.ts`
- Create: `src/search/ocrProvider.test.ts`
- Modify: `src/editor/SketchEditor.vue`
- Modify: `src/editor/SketchCanvas.vue`
- Modify: `src/editor/EditorTopBar.vue`
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`
- Modify: `README.md`

- [x] 设计 OCR provider 接口，默认本地空 provider，不上传用户数据。
- [x] 增加”识别当前页文字”入口和识别状态。
- [x] 将 OCR 结果保存到 `SketchData.ocrIndex`。
- [x] 提供手写块内搜索和结果页内定位。
- [x] 评估将识别文本写入思源块属性或伴随隐藏文本的方案。
- [x] 增加隐私提示、失败处理和测试。
- [x] 运行 `pnpm test` 和 `pnpm build`。
- [x] 提交：`feat: 增加手写 OCR 搜索闭环基础`。

## Batch 10: 富文本、图片裁剪与 PDF 标注入口

**Files:**
- Modify: `src/elements/text.ts`
- Modify: `src/elements/image.ts`
- Modify: `src/editor/SketchEditor.vue`
- Modify: `src/editor/SketchCanvas.vue`
- Modify: `src/storage/thumbnail.ts`
- Modify: `src/export/pdf.ts`
- Modify: `src/export/png.ts`

- [ ] 文本框支持字号、颜色、粗体、斜体、列表。
- [ ] 图片支持裁剪、替换、删除、手柄交互优化。
- [ ] 支持导入 PDF 页面为多页背景或图片背景。
- [ ] 导出时保持文本、图片、笔迹和背景一致。
- [ ] 运行 `pnpm test` 和 `pnpm build`。
- [ ] 提交：`feat: 增强混合内容编辑与 PDF 标注入口`。

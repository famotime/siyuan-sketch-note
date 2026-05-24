# Sketch Note (闲笔)

思源笔记手写插件，支持在文档中嵌入手写笔记。

插件标识：`siyuan-sketch-note`。

## 功能特性

- 手写输入：使用触控笔或手指在 Canvas 画布上书写
- 矢量笔迹：笔迹以矢量数据存储，支持无损二次编辑
- 5 色画笔：黑、红、蓝、绿、橙
- 荧光笔：支持半透明标注效果
- 工具预设：画笔、荧光笔、橡皮分别记忆粗细和透明度
- 橡皮擦：像素级精确擦除
- 形状与尺子：支持直线、矩形、椭圆和水平尺辅助书写
- 混合内容：支持可编辑文本框，支持插入或粘贴图片，图片可移动、缩放，并可继续手写标注
- 撤销 / 重做：完整的历史操作栈
- 5 种模板：白纸、方格纸、横线纸、点阵纸、康奈尔笔记
- 自动增长：写到底部时画布自动扩展
- PNG 导出：可将当前手写块导出为图片
- DPI 适配：高分屏（iPad Retina 等）笔迹清晰
- 明暗主题：跟随思源笔记主题
- 中英双语

## 使用方法

1. 点击顶栏手写笔图标，或按 `Ctrl+Shift+S` 插入手写块
2. 在全屏编辑器中书写
3. 点击保存或返回，缩略图自动嵌入文档
4. 点击文档中的缩略图可再次编辑

## 开发

```bash
pnpm install
pnpm dev    # 开发模式（watch）
pnpm test   # 运行单元测试
pnpm build  # 生产构建
```

`pnpm dev` 会读取 `.env` 中的 `VITE_SIYUAN_WORKSPACE_PATH`，并将插件构建到：

```text
{思源工作空间}/data/plugins/siyuan-sketch-note
```

`pnpm build` 会生成 `dist/` 和 `package.zip`，其中 `plugin.json` 的 `name` 为 `siyuan-sketch-note`，安装后的插件目录也应使用该名称。

## 技术栈

- Vue 3 + TypeScript
- HTML5 Canvas 2D + Pointer Events API
- SiYuan Plugin SDK
- Vite

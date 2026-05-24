# Sketch Note (闲笔)

思源笔记手写插件，支持在文档中嵌入手写笔记。

## 功能特性

- 手写输入：使用触控笔或手指在 Canvas 画布上书写
- 矢量笔迹：笔迹以矢量数据存储，支持无损二次编辑
- 5 色画笔：黑、红、蓝、绿、橙
- 橡皮擦：像素级精确擦除
- 撤销 / 重做：完整的历史操作栈
- 2 种模板：白纸、方格纸
- 自动增长：写到底部时画布自动扩展
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
pnpm build  # 生产构建
```

## 技术栈

- Vue 3 + TypeScript
- HTML5 Canvas 2D + Pointer Events API
- SiYuan Plugin SDK
- Vite

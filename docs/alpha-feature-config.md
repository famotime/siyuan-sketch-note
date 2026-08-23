# Alpha 功能隐藏配置

## 概述

闲笔插件采用 **编译时常量配置** 来控制发布版本中哪些功能对外可见。开发者编辑一个 TypeScript 源文件，重新构建后，被标记的功能即从 UI 中完全消失——用户既看不到入口，也无法触发相关逻辑。

设计原则：

- **编译时生效**：配置是源码常量，修改后必须 `pnpm build` 重新打包
- **单一配置源**：所有功能可见性由一个文件统一管理
- **零运行时开销**：隐藏的功能不会注册到 DOM，不影响包体积以外的性能

## 配置文件位置

```
src/feature-flags/alpha-feature-config.ts
```

## 快速开始

### 隐藏回放功能（最常见的场景）

```ts
const ALPHA_FEATURE_HIDE_CONFIG: AlphaFeatureHideConfig = {
  hiddenSettingKeys: ['replay'],
  hiddenTopbarKeys: ['replay'],
}
```

修改后执行 `pnpm build`，回放相关的所有 UI 元素将从发布包中消失。

### 恢复所有功能

```ts
const ALPHA_FEATURE_HIDE_CONFIG: AlphaFeatureHideConfig = {
  hiddenSettingKeys: [],
  hiddenTopbarKeys: [],
}
```

## 可隐藏的功能清单

### 设置页面（hiddenSettingKeys）

| Key | 说明 | 包含的 UI 元素 |
|-----|------|----------------|
| `'replay'` | 录制/回放设置组 | 录制开关、回放开关、笔迹/橡皮擦/形状/文本/图片/工具切换 6 个子开关、隐藏回放控制栏开关 |

> `debugLog`（日志打印）与 `openInNewTab`（从新页签打开）属于插件基础配置，始终显示，不纳入可隐藏范围。

### 顶部工具栏（hiddenTopbarKeys）

| Key | 说明 | 对应按钮 |
|-----|------|---------|
| `'undo'` | 撤销 | Undo 图标按钮 |
| `'redo'` | 重做 | Redo 图标按钮 |
| `'replay'` | 回放入口 | Play 图标按钮 |
| `'insertImage'` | 插入图片 | Plus 图标按钮 |
| `'zenMode'` | 禅模式 | 禅模式切换按钮 |
| `'moreMenu'` | 更多菜单 | MoreFour 按钮及其弹出层（若配置则隐藏整个更多菜单按钮） |

> `back`（返回按钮）始终显示，因为它是关闭编辑器的唯一途径。

### 更多菜单子项（hiddenMoreMenuKeys）

支持对更多菜单（MoreFour）弹出层内的各项功能进行细粒度独立隐藏控制：

| Key | 说明 | 对应菜单项 |
|-----|------|-----------|
| `'clear'` | 清空笔记 | 清空（Clear 图标项） |
| `'export'` | 导出笔记 | 导出（打开格式/背景/矢量数据弹窗） |
| `'exportSketchData'` | 嵌入矢量数据 | 导出弹窗中的“导出手写数据”开关 Toggle（隐藏后导出不嵌入矢量数据） |
| `'importSketch'` | 导入笔记 | 导入笔记（Download 图标项） |
| `'cleanupInvalidSketches'` | 清理无效手写 | 清理无效手写（Delete 图标项） |
| `'live'` | 实时同步 / 投屏 | 实时同步 / 投屏到 PC（SmartOptimization 图标项） |
| `'template'` | 笔记背景模板 | 笔记背景下拉选择框 |
| `'backgroundFit'` | 背景适配方式 | 背景适配下拉选择框（cover / contain / stretch） |
| `'stylusOnly'` | 仅触控笔模式 | 仅触控笔绘制开关 Toggle |
| `'enablePressure'` | 压感开关 | 笔刷压感响应开关 Toggle |

> **智能 UI 联动**：
> 1. 当所有子项均被配置为隐藏时，顶栏的更多菜单按钮将自动隐藏；
> 2. 中间分割线仅在上半区动作项与下半区设置项**同时存在可见项**时显示。

## 组合示例

### 隐藏录制回放、实时同步、矢量导出与清理无效笔记

```ts
const ALPHA_FEATURE_HIDE_CONFIG: AlphaFeatureHideConfig = {
  // 隐藏设置页中的录制/回放配置组
  hiddenSettingKeys: ['replay'],
  // 隐藏顶栏中的回放入口按钮
  hiddenTopbarKeys: ['replay'],
  // 隐藏实时同步、导入笔记、矢量数据嵌入、清理无效笔记
  hiddenMoreMenuKeys: [
    'live',
    'importSketch',
    'exportSketchData',
    'cleanupInvalidSketches',
  ],
}
```

### 仅保留导出与清空，隐藏其余更多菜单项

```ts
const ALPHA_FEATURE_HIDE_CONFIG: AlphaFeatureHideConfig = {
  hiddenSettingKeys: [],
  hiddenTopbarKeys: [],
  hiddenMoreMenuKeys: [
    'importSketch',
    'cleanupInvalidSketches',
    'live',
    'template',
    'backgroundFit',
    'stylusOnly',
    'enablePressure',
  ],
}
```

## 数据流

```
alpha-feature-config.ts   ← 编辑此文件
        │
        ├─→ index.ts onload()
        │     ├─ getHiddenTopbarKeySet()   → setHiddenTopbarKeys()   → App.vue ref ──┐
        │     ├─ getHiddenMoreMenuKeySet() → setHiddenMoreMenuKeys() → App.vue ref ──┼─→ SketchEditor.vue prop ──→ EditorTopBar.vue v-if
        │     │                                                                      │
        │     └─ isSettingHidden('replay') → openPluginSetting() 条件渲染            │
        │                                                                            │
        └─→ alpha-feature-config.test.ts  ← 单元测试                                 │
```

## 如何扩展

### 新增一个可隐藏的设置组

1. 在 `HiddenSettingKey` 联合类型中添加新 key：

   ```ts
   export type HiddenSettingKey = 'replay' | 'ocr';
   ```

2. 在 `src/index.ts` 的 `openPluginSetting()` 中用 `isSettingHidden()` guard 包裹对应的设置项：

   ```ts
   if (!isSettingHidden('ocr')) {
     setting.addItem({ /* OCR 相关设置 */ });
   }
   ```

### 新增一个可隐藏的工具栏按钮

1. 在 `HiddenTopbarKey` 联合类型中添加新 key：

   ```ts
   export type HiddenTopbarKey =
     | 'undo' | 'redo' | 'replay' | 'insertImage' | 'zenMode' | 'moreMenu'
     | 'ocrSearch';
   ```

2. 在 `EditorTopBar.vue` 模板中对应按钮上添加 `v-if`：

   ```vue
   <button v-if="!hiddenTopbarKeys.has('ocrSearch')" ... />
   ```

3. 更新本文件的可选值表格。

### 新增一个可隐藏的更多菜单子项

1. 在 `HiddenMoreMenuKey` 联合类型中添加新 key：

   ```ts
   export type HiddenMoreMenuKey =
     | 'clear' | 'export' | ... | 'newMenuItem';
   ```

2. 在 `EditorTopBar.vue` 模板中对应子项上添加 `v-if="!hiddenMoreKeys.has('newMenuItem')"`。

## 相关文件

| 文件 | 职责 |
|------|------|
| `src/feature-flags/alpha-feature-config.ts` | 配置定义 + 工具函数 |
| `src/feature-flags/alpha-feature-config.test.ts` | 单元测试 |
| `src/index.ts` | 设置页面条件渲染 + 顶部工具栏与更多菜单配置加载 |
| `src/App.vue` | `hiddenTopbarKeys` / `hiddenMoreMenuKeys` ref 与 setter |
| `src/main.ts` | 独立页签编辑器挂载配置传递 |
| `src/editor/SketchEditor.vue` | prop 透传与状态计算 |
| `src/editor/EditorTopBar.vue` | 按钮及菜单项 `v-if` 条件渲染与智能分割线 |


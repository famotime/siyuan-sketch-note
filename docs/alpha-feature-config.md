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

> `debugLog`（日志打印）始终显示，不纳入可隐藏范围。

### 顶部工具栏（hiddenTopbarKeys）

| Key | 说明 | 对应按钮 |
|-----|------|---------|
| `'undo'` | 撤销 | Undo 图标按钮 |
| `'redo'` | 重做 | Redo 图标按钮 |
| `'replay'` | 回放入口 | Play 图标按钮 |
| `'insertImage'` | 插入图片 | Plus 图标按钮 |
| `'zenMode'` | 禅模式 | 禅模式切换按钮 |
| `'moreMenu'` | 更多菜单 | MoreFour 按钮及其弹出层（含清空、背景选择、背景适配、触控笔模式、压感开关） |

> `back`（返回按钮）始终显示，因为它是关闭编辑器的唯一途径。

## 组合示例

### 仅发布基础手写功能

```ts
const ALPHA_FEATURE_HIDE_CONFIG: AlphaFeatureHideConfig = {
  // 隐藏设置页中的回放配置组
  hiddenSettingKeys: ['replay'],
  // 隐藏工具栏中的回放、插入图片、更多菜单
  hiddenTopbarKeys: ['replay', 'insertImage', 'moreMenu'],
}
```

### 保留回放但隐藏更多菜单

```ts
const ALPHA_FEATURE_HIDE_CONFIG: AlphaFeatureHideConfig = {
  hiddenSettingKeys: [],
  hiddenTopbarKeys: ['moreMenu'],
}
```

## 数据流

```
alpha-feature-config.ts   ← 编辑此文件
        │
        ├─→ index.ts onload()
        │     ├─ getHiddenTopbarKeySet() → setHiddenTopbarKeys() → App.vue ref
        │     │                                                        │
        │     │                                          SketchEditor.vue prop
        │     │                                                        │
        │     │                                          EditorTopBar.vue v-if
        │     │
        │     └─ isSettingHidden('replay') → openPluginSetting() 条件渲染
        │
        └─→ alpha-feature-config.test.ts  ← 单元测试
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

## 相关文件

| 文件 | 职责 |
|------|------|
| `src/feature-flags/alpha-feature-config.ts` | 配置定义 + 工具函数 |
| `src/feature-flags/alpha-feature-config.test.ts` | 单元测试 |
| `src/index.ts` | 设置页面条件渲染 + 顶部工具栏配置加载 |
| `src/App.vue` | `hiddenTopbarKeys` ref / setter |
| `src/editor/SketchEditor.vue` | prop 透传 |
| `src/editor/EditorTopBar.vue` | 按钮 `v-if` 条件渲染 |

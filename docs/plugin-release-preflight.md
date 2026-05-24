# Plugin Release Preflight

> 日期：2026-05-24  
> 范围：对 `siyuan-sketch-note` 当前仓库与 `package.zip` 做 SiYuan Bazaar 发布前检查。  
> 发布决策：修复小问题后可发布。自动发布预检已通过；仍需补充真实 SiYuan 宿主手动验证记录。

## 1. 自动检查结果

命令：

```bash
python C:\Users\Administrator.DESKTOP-SV57E1C\.cc-switch\skills\siyuan-plugin-preflight\scripts\check_siyuan_plugin_release.py --root D:\MyCodingProjects\siyuan-sketch-note
```

结果：脚本退出码为 0。

### PASS

- 找到 `plugin.json`、`README.md`、`icon.png`、`preview.png`、`package.zip`。
- `icon.png` 大小为 3 KB，符合 Bazaar 20 KB 上限。
- `plugin.json` 可解析，并包含发布所需字段。
- 插件名称为 `siyuan-sketch-note`。
- 插件版本 `0.1.0` 符合语义化版本规范。
- 插件 URL 格式有效：`https://github.com/famotime/siyuan-sketch-note`。
- `backends` 声明了 4 个目标，`frontends` 声明了 3 个目标。
- README 中未发现相对路径图片链接。
- `package.json.version` 与 `plugin.json.version` 一致，均为 `0.1.0`。
- `package.zip` 比核心上架文件更新。
- `package.zip` 根目录包含 `plugin.json`、`README.md`、`icon.png`、`preview.png`、`index.js`、`index.css`。
- 打包内 `plugin.json`、`README.md`、`icon.png`、`preview.png` 与仓库副本一致。

## 2. 包内容记录

当前 `package.zip` 根目录内容：

| 文件 | 大小 |
| --- | ---: |
| `icon.png` | 3773 B |
| `index.css` | 6507 B |
| `index.js` | 132829 B |
| `plugin.json` | 714 B |
| `preview.png` | 12208 B |
| `README.md` | 3101 B |

已修复：

- 移除打包内冗余 `i18n/` 静态目录。
- 重新生成 160x160 的 `icon.png`，体积降至 20 KB 以下。
- 重新构建 `package.zip`，包内图标与仓库副本一致。

## 3. 人工检查结果

### FAIL

- 无自动化发布阻断项。

### WARN

- 仍缺少真实 SiYuan 宿主手动验证记录，包括顶栏单击、插入手写块、保存重开、缩略图、导出、分页和桌面/浏览器端支持范围。
- `plugin.json.frontends` 和 `plugin.json.backends` 已收窄到桌面/浏览器桌面相关范围；发布前应按 `docs/manual-verification-checklist.md` 填写验证记录。
- 生产源码可检索到 `console.error`、`console.warn`；其中错误日志用于异常诊断，但发布前仍可继续评估是否改为用户可见 i18n 错误提示。
- `ICON_SVG` 使用硬编码 `stroke="#333"` 和 `fill="#333"`，顶栏图标在深色主题下可能不如 `currentColor` 稳定。
- README 暂未提供隐私、OCR/AI 未启用、移动端未声明支持等发布说明。

### PASS

- `plugin.json.name` 为 `siyuan-sketch-note`。
- `plugin.json.url` 已指向公开仓库。
- `plugin.json.author` 已从占位值改为 `famotime`。
- `plugin.json` 已移除空 `funding.custom`。
- `displayName.default` 为 `Sketch Note`，未重复包含 SiYuan/思源品牌词。
- `LICENSE` 年份为 2026，版权人为 `famotime`。
- 插件命令快捷键已改为 SiYuan 原生 Unicode 修饰键格式：`⌃⇧S`。
- README 中未发现相对路径图片链接。
- `preview.png` 为 12208 B，小于建议的 200 KB。
- `package.zip` 包含基本发布文件与构建入口。
- 未发现 `removeData()` 被放在 `onunload()` 中。
- 新增 `src/release/preflight.test.ts` 覆盖发布元数据、图标大小、LICENSE、快捷键和打包冗余目录规则。

## 4. 待修复项

1. 按 `docs/manual-verification-checklist.md` 完成真实 SiYuan 宿主手动验证，并记录结果。
2. 将顶栏 SVG 颜色改为 `currentColor`，并记录顶栏入口真实点击验证。
3. 逐条审查生产源码中的 `console.*` 和用户错误提示 i18n。
4. 在 README 中补充发布范围、移动端验证状态、OCR/AI 未启用状态和隐私说明。

## 5. 后续验证门槛

后续每次修改元数据、图标、打包配置或 README 后必须重新执行：

```bash
pnpm test
pnpm build
python C:\Users\Administrator.DESKTOP-SV57E1C\.cc-switch\skills\siyuan-plugin-preflight\scripts\check_siyuan_plugin_release.py --root D:\MyCodingProjects\siyuan-sketch-note
```

# Plugin Release Preflight

> 日期：2026-05-24  
> 范围：对 `siyuan-sketch-note` 当前仓库与 `package.zip` 做 SiYuan Bazaar 发布前检查。  
> 发布决策：暂不可发布。

## 1. 自动检查结果

命令：

```bash
python C:\Users\Administrator.DESKTOP-SV57E1C\.cc-switch\skills\siyuan-plugin-preflight\scripts\check_siyuan_plugin_release.py --root D:\MyCodingProjects\siyuan-sketch-note
```

结果：脚本退出码为 1，存在阻断项。

### FAIL

- `icon.png` 大小为 289.2 KB，超出 Bazaar 要求的 20 KB 上限。
- `plugin.json.url` 为空，不是有效的 `http://` 或 `https://` 地址。

### PASS

- 找到 `plugin.json`、`README.md`、`icon.png`、`preview.png`、`package.zip`。
- `plugin.json` 可解析，包含 `name`、`author`、`url`、`version`、`minAppVersion`、`backends`、`frontends`、`displayName`、`description`、`readme`。
- 插件名称为 `siyuan-sketch-note`。
- `plugin.json.version` 与 `package.json.version` 一致，均为 `0.1.0`。
- `package.zip` 比核心上架文件更新。
- `package.zip` 根目录包含 `plugin.json`、`README.md`、`icon.png`、`preview.png`、`index.js`。
- 打包内 `plugin.json`、`README.md`、`icon.png`、`preview.png` 与仓库副本一致。

## 2. 包内容记录

当前 `package.zip` 根目录内容：

| 文件 | 大小 |
| --- | ---: |
| `i18n/` | 0 B |
| `i18n/en_US.json` | 2262 B |
| `i18n/zh_CN.json` | 2292 B |
| `icon.png` | 296129 B |
| `index.css` | 6507 B |
| `index.js` | 132834 B |
| `plugin.json` | 634 B |
| `preview.png` | 12208 B |
| `README.md` | 3101 B |

发布风险：

- 包内包含 `i18n/` 目录。当前代码通过打包后的 `index.js` 内联使用 i18n，静态 `i18n/` 目录未证明会被运行时加载，Bazaar 审查中可能被认为是冗余静态资源。

## 3. 人工检查结果

### FAIL

- `LICENSE` 仍为 `Copyright (c) 2025 SiYuan`，年份不是当前年份 2026，版权人也不是插件实际开发者。
- `plugin.json.url` 为空，无法指向公开仓库。
- `icon.png` 当前为 296129 B，超过 20 KB 发布上限。
- `plugin.json.frontends` 和 `plugin.json.backends` 均声明 `["all"]`，但当前缺少移动端、桌面端、浏览器端全平台手动验证记录。
- `src/index.ts` 的 `addCommand()` 使用 `hotkey: "Ctrl+Shift+S"`，不是 SiYuan 原生 Unicode 修饰键格式。

### WARN

- `plugin.json.author` 为 `sketch-note`，看起来像占位名称，发布前应确认是否为真实开发者或组织名。
- `plugin.json` 包含空 `funding.custom`，Bazaar 审查可能要求删除无实际用途字段。
- `vite.config.ts` 会把 `src/i18n/**` 拷贝到包内 `i18n/` 目录；若运行时不依赖这些静态文件，建议移除拷贝规则。
- 生产源码可检索到 `console.error`、`console.warn`；其中错误日志用于异常诊断，但发布前仍需逐条确认是否改为用户可见 i18n 错误提示或移除非必要日志。
- `ICON_SVG` 使用硬编码 `stroke="#333"` 和 `fill="#333"`，顶栏图标在深色主题下可能不如 `currentColor` 稳定。
- 顶栏 `addTopBar()` 入口和右键菜单编辑链路缺少真实 SiYuan 环境单击验证记录。
- README 暂未提供隐私、OCR/AI 未启用、移动端验证范围等发布说明。

### PASS

- `plugin.json.name` 为 `siyuan-sketch-note`。
- `displayName.default` 为 `Sketch Note`，未重复包含 SiYuan/思源品牌词。
- README 中未发现相对路径图片链接。
- `preview.png` 为 12208 B，小于建议的 200 KB。
- `package.zip` 包含基本发布文件与构建入口。
- 未发现 `removeData()` 被放在 `onunload()` 中。

## 4. 待修复项

1. 将 `icon.png` 收敛到 160x160 左右，并压缩到 20 KB 以下，然后重新构建 `package.zip`。
2. 补充有效的 `plugin.json.url`。
3. 将 LICENSE 年份更新为 2026，并替换为实际版权人。
4. 根据真实测试范围收窄或确认 `frontends`、`backends`，不能在未验证移动端时声明 `all`。
5. 将 `hotkey: "Ctrl+Shift+S"` 改为 SiYuan 原生 Unicode 修饰键格式。
6. 评估并移除包内冗余 `i18n/` 静态目录。
7. 删除空 `funding.custom` 或补充真实 funding 配置。
8. 将顶栏 SVG 颜色改为 `currentColor`，并记录顶栏入口真实点击验证。
9. 逐条审查生产源码中的 `console.*` 和用户错误提示 i18n。
10. 在 README 中补充发布范围、移动端验证状态和隐私说明。

## 5. 后续验证门槛

发布修复完成后必须重新执行：

```bash
pnpm test
pnpm build
python C:\Users\Administrator.DESKTOP-SV57E1C\.cc-switch\skills\siyuan-plugin-preflight\scripts\check_siyuan_plugin_release.py --root D:\MyCodingProjects\siyuan-sketch-note
```

同时需要填写 `docs/manual-verification-checklist.md` 中的真实 SiYuan 宿主验证结果。

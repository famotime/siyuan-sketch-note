# 技术验证结果

本文档记录移动端手写实时同步方案的两个前置技术验证结果。

## 验证 1：移动端 WebSocket 连接 PC 局域网

**目的**：确认移动端思源插件 WebView 中 `new WebSocket()` 和 `fetch()` 能否访问 PC 局域网地址。

### 测试环境

| 项目 | PC 端 | 移动端 |
|------|-------|--------|
| 操作系统 | | |
| 思源版本 | | |
| getFrontend() | desktop | mobile |
| getBackend() | | |
| 网络环境 | | |

### 测试步骤

1. PC 端运行 `node scripts/ws-test-server.mjs`，确认监听端口 9527
2. 浏览器访问 `http://PC_IP:9527/` 确认 HTTP 返回 JSON
3. 浏览器中打开思源 → 闲笔插件 → 顶栏菜单 → WS 连接测试 → 输入 PC IP
4. 移动端打开思源 → 闲笔插件 → 顶栏菜单 → WS 连接测试 → 输入 PC IP

### 测试结果

#### PC 端（基准）

```
[粘贴 PC 端测试结果]
```

#### 移动端

```
[粘贴移动端测试结果]
```

### 结论

| 检查项 | 结果 | 备注 |
|--------|------|------|
| HTTP 连通性 | ⬜ 待测 | |
| WebSocket 连接 | ⬜ 待测 | |
| WebSocket 收发消息 | ⬜ 待测 | |
| 连接延迟 | ⬜ 待测 | |

**判定**：
- ✅ 通过 → 可走方案 A（局域网直连）
- △ 部分通过 → 需进一步排查（如 HTTP 通但 WS 不通，尝试 WSS）
- ❌ 失败 → 需评估替代方案（方案 C 或 forwardProxy 中转）

---

## 验证 2：思源 Broadcast API 跨设备消息传递

**目的**：确认思源内核的 broadcast API 能否在不同设备的插件之间传递自定义 JSON 消息。

### 测试环境

| 项目 | 设备 A | 设备 B |
|------|--------|--------|
| 操作系统 | | |
| 思源版本 | | |
| getFrontend() | | |
| getBackend() | | |
| 是否同一内核 | ⬜ 同一 / ⬜ 不同 | |

### 测试步骤

1. 设备 A 打开思源 → 闲笔插件 → 顶栏菜单 → Broadcast 测试 → 记录结果
2. 设备 B 打开思源 → 闲笔插件 → 顶栏菜单 → Broadcast 测试 → 记录结果
3. 对比两端结果

### API 端点测试结果

| 端点 | 设备 A 结果 | 设备 B 结果 |
|------|-------------|-------------|
| `POST /api/broadcast/getChannels` | ⬜ 待测 | ⬜ 待测 |
| `POST /api/broadcast/getChannelInfo` | ⬜ 待测 | ⬜ 待测 |
| `POST /api/broadcast/publish` | ⬜ 待测 | ⬜ 待测 |
| `POST /api/broadcast/postMessage` | ⬜ 待测 | ⬜ 待测 |
| `GET /es/broadcast/subscribe` (SSE) | ⬜ 待测 | ⬜ 待测 |
| `GET /ws/broadcast` (WebSocket) | ⬜ 待测 | ⬜ 待测 |

### 设备 A 详细输出

```
[粘贴设备 A Broadcast 测试结果]
```

### 设备 B 详细输出

```
[粘贴设备 B Broadcast 测试结果]
```

### 结论

**判定**：
- ✅ 全部通过 → Broadcast API 可跨设备工作，可作为传输层候选
- △ 部分通过 → API 存在但有限制，需评估是否满足实时同步需求
- ❌ 失败 → Broadcast API 不可用或仅限内部使用，放弃方案 C

---

## 综合结论

| 方案 | 结论 | 备注 |
|------|------|------|
| 方案 A：局域网 WebSocket 直连 | ⬜ 待定 | |
| 方案 C：思源 Broadcast API | ⬜ 待定 | |

**推荐下一步**：[待填写]

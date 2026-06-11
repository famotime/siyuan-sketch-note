# 移动端手写与 PC 实时展示方案

## 目标

在不依赖思源数据同步的前提下，实现“手机端书写，PC 端实时展示手机端笔记动作”的能力。第一阶段建议限定为：手机端作为唯一编辑端，PC 端进入只读观看模式，双方通过实时通信通道传输手写事件，最终保存仍由手机端沿用现有保存流程完成。

## 用户使用场景与价值分析

### 核心场景

#### 场景 1：课堂/会议投屏演示

老师或主讲人用手机（或平板）书写，通过投影仪连接的电脑实时展示书写过程。

- 老师可以拿着手机在教室里走动书写，不需要被束缚在讲台电脑前
- 只传输手写矢量数据而非屏幕镜像，带宽需求极低，在校园 Wi-Fi 下表现良好
- 矢量手写在投影仪上保持清晰，不受手机屏幕分辨率限制

#### 场景 2：远程会议共享手写板书

线上会议中，主讲人用手机书写，其他人通过屏幕共享看到 PC 端的实时画面。

- 手机屏幕太小，直接共享手机屏幕在视频会议软件中效果差且操作不便
- PC 端有了实时画面后，可以通过腾讯会议/Zoom 等工具正常屏幕共享
- 不需要额外购买手写板硬件，一部手机即可充当手写输入设备

#### 场景 3：家庭辅导/一对一教学

家长或老师用手机书写讲解，孩子在电脑屏幕上同步看到书写过程。

- 手机比电脑更适合作为”手写板”——随时随地、不需要桌面
- 在电脑上观看的体验更好——大屏幕、可以同时看教材和手写内容

### 价值定位

这个功能的核心价值在于**让思源笔记的手写能力突破单设备的边界**——手机变成便携的”手写输入设备”，PC 变成”展示终端”，两者配合形成完整的教学/演示工具链。这对思源笔记的定位有战略意义：它不仅是个人笔记工具，还可以成为**教学场景的基础设施**。

### 需要注意的局限

- **按笔画同步的延迟感知**：MVP 阶段写完一笔才显示，用户会感觉到短暂延迟。验证数据显示局域网往返延迟 33ms，加上笔画渲染时间，实际体感约 100-200ms，对教学场景可接受
- **现有替代方案**：Android Scrcpy、华为多屏协同等通用投屏工具已经存在。本功能的优势在于：只传手写数据（轻量）、保留矢量清晰度、与思源笔记深度集成（自动保存、回放）
- **使用习惯培养**：需要在产品中提供清晰的引导，让用户知道这个功能存在并愿意尝试

## 技术验证结论

已完成两项前置技术验证，结果见 `docs/tech-verification-results.md`。

### 验证 1：局域网 WebSocket 直连（方案 A）

- **结论**：✅ 通过，PC 和移动端（HarmonyOS）均可正常建立 WebSocket 连接
- 延迟：PC 端消息往返 10ms，移动端 33ms
- **注意**：手写 RFC 6455 握手在浏览器端会 1006 失败，生产实现需使用成熟的 WebSocket 库（如 `ws`）

### 验证 2：思源 Broadcast API 跨设备消息传递（方案 C）

- **结论**：✅ 全部通过，Broadcast API 可在同一思源内核的不同前端间传递自定义消息
- 延迟：PC 端 1-5ms，移动端 14-18ms（低于方案 A）
- WebSocket 最大消息 128 MiB，足够传输笔迹数据
- 已有其他插件（`snippets-plugin-sync`）在生产中使用 Broadcast API，验证了可靠性

### 推荐方案

**以方案 C（Broadcast API）为主方案**，理由：

- 主场景”手机远程访问 PC 思源”天然满足同一内核条件
- 用户无需额外操作（不需要运行独立服务器、不需要输入 IP 地址）
- 可通过思源官方中转或反向代理支持跨网络
- 延迟更低（移动端 14-18ms vs 33ms）
- 思源内核已处理连接管理，无需自建重连逻辑

**方案 A（局域网 WebSocket）作为备选**，用于不依赖思源内核的独立场景（如未来扩展为非思源环境的手写同步工具）。

## 结论

该功能在现有架构下可行，但不应直接复用当前 `saveData`/`loadData` 机制作为实时同步通道。当前项目已经具备三个关键基础：

- 手写数据模型：`SketchData` 包含 `strokes`、`elements`、`replayEvents`，见 `src/types/sketch.ts`。
- 本地动作录制：`SketchEditor.vue` 创建 `ReplayRecorder`，`SketchCanvas.vue` 在笔画、橡皮、图形、图片、元素变换等操作完成后记录事件。
- 动作回放渲染：`src/recorder/player.ts` 的 `ReplayPlayer` 已经能把 `ReplayEvent` 渲染为逐步动画。

主要缺口是跨设备实时通信、会话配对、权限控制、断线恢复和并发编辑策略。

## 推荐 MVP 范围

第一版建议做”按笔画近实时同步”，而不是一开始就做”笔尖移动级实时同步”。

- 手机端：打开手写编辑器并进入”投屏/同步到 PC”模式。
- PC 端：打开同一个手写块并进入”观看模式”。
- 传输层：优先使用思源 Broadcast API（方案 C），无需用户手动配置网络。
- 同步粒度：一笔完成后发送一个完整 `ReplayEvent`，PC 端立即播放该笔画。
- 编辑权限：只允许手机端编辑，PC 端不允许修改画布、不参与保存。
- 保存路径：手机端继续使用现有 `useSaveManager` 保存完整 `SketchData` 和缩略图。

这样可以最大程度复用现有录制和回放体系，避免一开始改动 `canvasEngine` 的指针事件流。

## 网络方案

以下三个方案均已完成技术验证，按推荐优先级排列。

### 方案 C：思源 Broadcast API（✅ 推荐为主方案）

技术验证已通过，详见 `docs/tech-verification-results.md`。

原理：

- PC 端通过 `GET /es/broadcast/subscribe`（SSE）或 `GET /ws/broadcast`（WebSocket）订阅自定义频道。
- 手机端通过 `POST /api/broadcast/postMessage` 向同一频道发布 JSON 消息。
- 两端共享同一个思源内核，消息由内核在进程内转发。

验证数据：

| 指标 | PC 端 | 移动端 |
|------|-------|--------|
| postMessage 延迟 | 1ms | 17ms |
| publish 延迟 | 2ms | 14ms |
| WebSocket 最大消息 | 128 MiB | 128 MiB |

API 使用要点（源自 `kernel/api/broadcast.go`）：

- `postMessage` 使用 JSON（`channel` + `message`），比 `publish` 的 multipart/form-data 更简单，适合文本消息
- `getChannelInfo` 参数名为 `name`（与 `postMessage` 的 `channel` 不一致，需注意）
- SSE 事件类型 = 频道名，监听时用 `addEventListener(channelName, handler)` 而非 `onmessage`
- 已有其他插件（`snippets-plugin-sync`）在生产中使用，验证了可靠性

优点：

- 无需额外服务进程，复用思源内核能力
- 用户无需输入 IP 地址或手动配置网络
- 延迟低于局域网直连方案（14-18ms vs 33ms）
- 可通过思源官方中转或反向代理支持跨网络
- 思源内核已处理连接管理和重连

缺点：

- 依赖同一思源内核——两端必须连接同一个后端（主场景"手机远程访问 PC 思源"天然满足）
- 受限于思源 Broadcast API 的消息格式和上限
- 跨网络场景需要用户自行配置反向代理或使用思源官方同步

### 方案 A：同局域网直连（✅ 备选方案）

技术验证已通过，详见 `docs/tech-verification-results.md`。

网络要求：

- 手机和 PC 在同一个 Wi-Fi 或同一个可互通局域网。
- 手机能访问 PC 的局域网 IP 和插件监听端口，例如 `192.168.1.20:9527`。
- PC 防火墙允许该端口入站连接。
- 路由器没有开启 AP 隔离、客户端隔离、访客网络隔离。
- PC 端思源和插件保持运行，PC 不休眠。

验证数据：

| 指标 | PC 端 | 移动端（HarmonyOS） |
|------|-------|---------------------|
| HTTP 延迟 | 18ms | 57ms |
| WebSocket 握手 | 3ms | 19ms |
| 消息往返 | 10ms | 33ms |

技术要点：

- 最初使用手写 RFC 6455 实现 WebSocket 握手时浏览器端 1006 失败，换用 `ws` npm 包后问题消失——生产实现必须使用成熟的 WebSocket 库
- PC 端需要运行独立的 WebSocket 服务器进程

优点：

- 不依赖思源内核，可独立运行
- 适合未来扩展为非思源环境的手写同步工具
- 协议完全自定义，可针对笔迹数据优化

缺点：

- 用户需要手动输入 PC 的 IP 地址
- 需要在一端运行独立的 WebSocket 服务器
- 校园网、公司网、酒店网可能阻止设备互访
- 手机使用蜂窝网络时不可用

### 方案 B：公网中继服务

适合后续商业化或跨网络使用。

网络要求：

- 手机和 PC 都能访问同一个 HTTPS/WSS 服务。
- 服务端维护会话、鉴权、过期、消息转发。
- 所有连接使用 `wss://`。
- 会话 token 设置短过期时间，例如 10 分钟。
- 服务端不落盘手写内容，除非用户明确开启云端记录。

优点：

- 手机和 PC 不需要在同一网络。
- 用户体验更稳定，扫码即可连接。
- 可以支持多 PC 观看、多端旁听。

缺点：

- 需要维护服务端、证书、监控和可用性。
- 手写内容经过服务器，隐私、合规和安全要求更高。
- 会引入长期运维成本。

## 数据流设计

### 会话建立（基于 Broadcast API）

PC 端打开手写块时自动订阅 Broadcast 频道：

```ts
// 频道名 = sketch:${sketchId}:live
const channel = `sketch:${sketchId}:live`
// SSE 订阅
const es = new EventSource('/es/broadcast/subscribe')
es.addEventListener(channel, (e) => handleMessage(JSON.parse(e.data)))
// 或 WebSocket 订阅
const ws = new WebSocket(`/ws/broadcast?channel=${channel}`)
ws.onmessage = (e) => handleMessage(JSON.parse(e.data))
```

手机端连接后发送 hello：

```json
{
  "type": "client.hello",
  "clientId": "mobile-xxx",
  "sketchId": "sketch-xxx",
  "role": "writer",
  "protocolVersion": 1
}
```

PC 端校验后返回 ready：

```json
{
  "type": "server.ready",
  "sketchId": "sketch-xxx",
  "accepted": true,
  "protocolVersion": 1,
  "requiredSnapshot": true
}
```

与原先局域网直连方案相比，Broadcast API 方案省去了 `sessionId`、`token` 和二维码配对流程——两端天然在同一内核内，通过频道名（`sketch:${sketchId}:live`）即可关联。

### 初始快照

手机端发送当前完整 `SketchData`，PC 端用于建立观看基线：

```json
{
  "type": "sketch.snapshot",
  "sketchId": "sketch-xxx",
  "revision": 1,
  "data": {
    "version": 1,
    "template": "blank",
    "canvasWidth": 800,
    "canvasHeight": 1200,
    "strokes": [],
    "elements": [],
    "replayEvents": []
  }
}
```

PC 端处理逻辑：

- 校验 `sketchId` 与当前观看页一致。
- 调用类似 `restoreData(data)` 的只读恢复流程。
- 初始化本地 `revision`。
- 隐藏编辑工具，仅保留观看状态、断线状态和退出按钮。

### 按笔画事件同步

手机端每完成一个动作后发送现有 `ReplayEvent`：

```json
{
  "type": "sketch.event",
  "sketchId": "sketch-xxx",
  "revision": 2,
  "event": {
    "type": "stroke",
    "id": "re-xxx",
    "timestamp": 1791640000000,
    "stroke": {
      "id": "s1791640000000-1",
      "points": [
        { "x": 120, "y": 140, "pressure": 0.5, "timestamp": 1000 },
        { "x": 124, "y": 143, "pressure": 0.5, "timestamp": 1016 }
      ],
      "color": "#111827",
      "width": 2.4,
      "opacity": 0.96,
      "tool": "pen"
    }
  }
}
```

PC 端处理逻辑：

- 如果 `revision` 等于本地 `revision + 1`，立即应用。
- 如果 `revision` 跳号，暂停播放并请求新快照。
- 将事件追加到观看端的临时事件列表。
- 使用现有 `ReplayPlayer` 或更轻量的事件应用器绘制新事件。

### 断线恢复

Broadcast API 方案下，断线意味着 SSE/WebSocket 连接断开。思源内核已提供基础的连接管理，但插件层仍需处理：

当连接断开：

- PC 显示”连接已断开”状态。
- 手机端进入重连队列，最多缓存最近一段事件。
- 重连后手机发送 `client.resume`：

```json
{
  “type”: “client.resume”,
  “sketchId”: “sketch-xxx”,
  “lastKnownViewerRevision”: 12,
  “writerRevision”: 18
}
```

如果手机端仍有 `13-18` 的事件缓存，则补发事件；否则发送完整快照。

**Broadcast API 的优势**：如果两端只是短暂断开后重连，只需重新订阅频道（SSE 自动重连、WebSocket 需手动重连），无需重建会话或重新握手。

## 模块拆分建议

### 新增 `src/live/types.ts`

职责：

- 定义实时同步协议类型。
- 定义会话角色、消息类型、连接状态。
- 保持与 `ReplayEvent`、`SketchData` 的类型引用关系。

核心类型：

```ts
import type { ReplayEvent } from "@/recorder/types";
import type { SketchData } from "@/types/sketch";

export type LiveRole = "writer" | "viewer";

export type LiveConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

export interface LiveChannelInfo {
  sketchId: string;
  channel: string;
  protocolVersion: 1;
}

export type LiveMessage =
  | ClientHelloMessage
  | ServerReadyMessage
  | SketchSnapshotMessage
  | SketchEventMessage
  | ClientResumeMessage
  | ErrorMessage;

export interface ClientHelloMessage {
  type: "client.hello";
  clientId: string;
  sketchId: string;
  role: "writer";
  protocolVersion: 1;
}

export interface ServerReadyMessage {
  type: "server.ready";
  sketchId: string;
  accepted: boolean;
  protocolVersion: 1;
  requiredSnapshot: boolean;
}

export interface SketchSnapshotMessage {
  type: "sketch.snapshot";
  sketchId: string;
  revision: number;
  data: SketchData;
}

export interface SketchEventMessage {
  type: "sketch.event";
  sketchId: string;
  revision: number;
  event: ReplayEvent;
}

export interface ClientResumeMessage {
  type: "client.resume";
  sketchId: string;
  lastKnownViewerRevision: number;
  writerRevision: number;
}

export interface ErrorMessage {
  type: "error";
  sketchId?: string;
  code: "unauthorized" | "revision_mismatch" | "unsupported_protocol" | "invalid_message";
  message: string;
}
```

### 新增 `src/live/session.ts`

职责：

- 管理 Broadcast 频道订阅和发布。
- 校验消息是否属于当前 sketch。
- 管理 `revision`。
- 管理最近事件缓存，用于断线补发。

关键行为：

- `createLiveChannel(sketchId)` 返回频道名 `sketch:${sketchId}:live` 和频道信息。
- `acceptWriter(message)` 校验协议版本和角色。
- `nextRevision()` 单调递增。
- `recordEvent(message)` 只保留最近 N 条事件，例如 500 条。
- `canReplayFrom(revision)` 判断是否能补发事件。

### 新增 `src/live/transport.ts`

职责：

- 定义传输层接口。
- 屏蔽 Broadcast API（SSE/WebSocket）与直连 WebSocket 的差异。

接口建议：

```ts
import type { LiveMessage } from "./types";

export interface LiveTransport {
  start(): Promise<void>;
  stop(): Promise<void>;
  send(message: LiveMessage): void;
  onMessage(handler: (message: LiveMessage) => void): () => void;
  onClose(handler: () => void): () => void;
  onError(handler: (error: Error) => void): () => void;
}
```

实现方案：

- `BroadcastTransport`（主方案）：基于思源 Broadcast API，PC 端用 SSE 或 WebSocket 订阅，手机端用 `postMessage` 发布。
- `LanWebSocketTransport`（备选）：基于局域网直连 WebSocket，用于独立场景。

### 新增 `src/live/viewerApply.ts`

职责：

- 在 PC 观看端应用收到的快照和事件。
- 避免 PC 观看端污染真实编辑状态。
- 对缺失 revision、重复事件、未知事件做明确处理。

建议策略：

- `applySnapshot(data)` 重建观看画布。
- `applyReplayEvent(event)` 绘制新增动作。
- `handleRevisionMismatch()` 请求完整快照。
- `dispose()` 清理动画帧和缓存。

第一版可以复用 `ReplayPlayer` 的绘制能力，但需要避免每次新事件都重放全部历史。若性能不足，再把 `ReplayPlayer` 中的单事件渲染能力抽成共享渲染器。

### 修改 `src/editor/SketchCanvas.vue`

职责变化：

- 在现有 `recorder.record(event)` 之后，增加可选的实时事件回调。
- 保持原有录制逻辑不变。

建议新增 prop：

```ts
onLiveEvent?: (event: ReplayEvent) => void;
```

每个现有录制点在 `props.recorder.record(event)` 后调用：

```ts
props.onLiveEvent?.(event);
```

注意点：

- 第一版只发送完成后的事件，不发送 `pointermove`。
- 橡皮擦、图片、元素变换也使用同一事件出口。
- 不改变 `emit("stroke")` 和自动保存流程。

### 修改 `src/editor/SketchEditor.vue`

职责变化：

- 管理“开始手机投屏/观看模式”的 UI 状态。
- 持有 live session 或 live client。
- 向 `SketchCanvas` 传递 `onLiveEvent`。
- PC 观看模式下禁用编辑工具和保存。

建议新增状态：

```ts
const liveMode = ref<"off" | "writer" | "viewer">("off");
const liveConnectionState = ref<LiveConnectionState>("idle");
```

第一版 UI 可以放在更多菜单中：

- PC：`开始观看手机书写`
- 手机：`连接到 PC 展示`
- 连接中：显示会话状态和断开按钮

### 修改 `src/i18n/zh_CN.json` 和 `src/i18n/en_US.json`

新增文案：

- `liveStartViewer`
- `liveConnectWriter`
- `liveDisconnect`
- `liveConnected`
- `liveDisconnected`
- `liveConnectionFailed`
- `liveViewerReadOnly`

### 测试文件建议

新增单元测试：

- `src/live/session.test.ts`
- `src/live/types.test.ts`
- `src/live/viewerApply.test.ts`

修改或新增编辑器测试：

- 验证 `SketchCanvas.vue` 在完成一笔后调用 `onLiveEvent`。
- 验证 PC 观看模式不会触发保存。
- 验证 revision 跳号时触发快照请求。

## 分阶段实施计划

### 阶段 1：协议和会话基础

目标：

- 建立实时同步的类型和会话模型。
- 实现基于 Broadcast API 的传输层。
- 用单元测试验证频道管理、revision、事件缓存。

涉及文件：

- 新增 `src/live/types.ts`
- 新增 `src/live/session.ts`
- 新增 `src/live/transport.ts`（含 `BroadcastTransport` 实现）
- 新增 `src/live/session.test.ts`

验收标准：

- `pnpm test` 通过。
- 频道名按 `sketch:${sketchId}:live` 规则生成。
- revision 单调递增。
- 事件缓存能根据 revision 补发连续事件。
- BroadcastTransport 能通过思源 API 发送和接收消息。

### 阶段 2：画布事件出口

目标：

- 从 `SketchCanvas.vue` 暴露统一实时事件出口。
- 不改变现有保存、录制、回放行为。

涉及文件：

- 修改 `src/editor/SketchCanvas.vue`
- 新增或修改 `src/editor` 下对应测试

验收标准：

- 完成普通笔画后触发一次 live event。
- 完成橡皮擦、图形、图片插入、元素变换后也能触发对应事件。
- 未传入 live callback 时行为与当前一致。

### 阶段 3：PC 观看端应用器

目标：

- PC 端能从快照恢复观看画布。
- PC 端能按 revision 应用新事件。
- PC 端只读，不参与保存。

涉及文件：

- 新增 `src/live/viewerApply.ts`
- 修改 `src/editor/SketchEditor.vue`
- 新增 `src/live/viewerApply.test.ts`

验收标准：

- 快照可恢复为与手机当前画布一致的显示状态。
- 收到 `sketch.event` 后 PC 端展示新增动作。
- revision 跳号时进入等待快照状态。

### 阶段 4：端到端集成

目标：

- 手机端和 PC 端通过 Broadcast API 实现完整的实时同步流程。
- 支持断开、重连和错误提示。
- 移除技术验证阶段的测试入口，整合到正式 UI 中。

涉及文件：

- 修改 `src/editor/SketchEditor.vue`（正式 UI 入口）
- 修改 `src/i18n/zh_CN.json`
- 修改 `src/i18n/en_US.json`

验收标准：

- 手机端打开手写块 → 点击"投屏到 PC" → PC 端同一手写块自动进入观看模式。
- 手机完成一笔后 PC 端在 200ms 内展示。
- 断线后重连能补发缓存事件或重新发送快照。
- PC 观看端无法编辑、无法触发保存。

### 阶段 5：体验和兼容性打磨

目标：

- 优化连接 UI、错误文案和移动端体验。
- 增加手动验证清单。
- 明确不支持的网络环境。

涉及文件：

- 修改 `src/i18n/zh_CN.json`
- 修改 `src/i18n/en_US.json`
- 修改 `docs/manual-verification-checklist.md`
- 修改 README 中的功能说明

验收标准：

- 移动端按钮和提示不遮挡画布。
- PC 观看端明确显示只读状态。
- README 写清楚 Broadcast API 的前提条件（同一思源内核）。

## 第二阶段：笔尖移动级实时同步

当按笔画同步稳定后，再升级为书写中实时同步。

需要新增事件：

```ts
export type LiveStrokeStreamMessage =
  | LiveStrokeStartMessage
  | LiveStrokePointsMessage
  | LiveStrokeEndMessage;

export interface LiveStrokeStartMessage {
  type: "stroke.start";
  sketchId: string;
  strokeId: string;
  revision: number;
  strokeMeta: {
    color: string;
    width: number;
    opacity?: number;
    tool: "pen" | "highlighter" | "eraser";
    brushProfileId?: string;
  };
}

export interface LiveStrokePointsMessage {
  type: "stroke.points";
  sketchId: string;
  strokeId: string;
  points: Array<{ x: number; y: number; pressure: number; timestamp: number }>;
}

export interface LiveStrokeEndMessage {
  type: "stroke.end";
  sketchId: string;
  strokeId: string;
  revision: number;
}
```

发送策略：

- 手机端按 16ms 到 50ms 合并点位批次。
- 单批最多发送 16 到 32 个点。
- 网络拥塞时丢弃中间预览点，但必须保留最终完整 stroke。
- `stroke.end` 后仍发送完整 `ReplayEvent` 作为最终一致性事件。

PC 策略：

- `stroke.points` 只用于临时预览层。
- `stroke.end` 收到后清理临时层。
- 完整 `ReplayEvent` 到达后写入正式观看层。

这样可以兼顾跟手展示和最终一致性。

## 负面影响

### 性能

按笔画同步的性能风险较低。笔尖移动级同步会显著增加消息数量和重绘次数，手机端耗电、发热和 PC 端 canvas 重绘压力都会上升。

控制措施：

- 第一版按笔画发送。
- 第二版点位批量发送。
- PC 端使用临时预览层，不在每个点上重建完整画布。

### 存储体积

现有 `replayEvents` 已经与 `strokes`、`elements` 有一定重复。若把实时点流也落盘，会继续放大数据体积。

控制措施：

- 实时传输消息不落盘。
- 最终只保存现有 `SketchData`。
- 只保留短期重连缓存。

### 并发冲突

当前保存是完整 `SketchData` 写回，PC 和手机同时编辑会造成覆盖、撤销栈错乱和元素 ID 冲突。

控制措施：

- 第一版强制单写端。
- PC 观看端只读。
- 如果未来支持多写端，需要引入操作变换或 CRDT，成本远高于当前需求。

### 安全和隐私

手写内容可能包含隐私信息。Broadcast API 方案的数据流经思源内核，不经过第三方服务器，隐私风险较低。

控制措施：

- Broadcast API 天然在同一内核内，无需额外认证。
- 传输数据不落盘，仅在内存中转发。
- 如未来扩展方案 A（局域网直连），会话 token 需一次性、短过期。
- 如未来扩展方案 B（公网中继），必须使用 WSS，服务端不落盘。

### 网络兼容性

方案 C（Broadcast API）不存在网络兼容性问题——两端天然在同一思源内核内，无需关心局域网、防火墙或 AP 隔离。

如使用方案 A（局域网直连）作为备选，需要注意：

- 局域网直连在访客 Wi-Fi、校园网、公司网、酒店网中可能失败。
- UI 需明确提示网络要求，提供连接诊断。
- 后续提供公网中继或 VPN 文档作为高级方案。

### 图片和背景资源

笔画事件较小，但图片和自定义背景可能依赖资产路径。PC 端如果无法访问手机端刚插入的资源，会出现缺图。

控制措施：

- 第一版可以限制实时同步图片插入，仅在最终保存后刷新。
- 或在事件中携带图片资产可访问 URL。
- 大资源与笔迹事件分通道处理，避免阻塞手写流。

## 手动验证清单

MVP 完成后，需要至少验证以下场景：

- PC 端打开手写块，手机端打开同一手写块，两端自动建立 Broadcast 频道连接。
- 手机画普通笔画，PC 端在一笔结束后展示。
- 手机使用橡皮擦，PC 端展示擦除结果。
- 手机切换画笔颜色和宽度后书写，PC 端显示一致。
- 手机新增页面或扩展画布高度后，PC 端尺寸同步。
- PC 观看端无法编辑、无法触发保存。
- 手机端保存后，文档中的缩略图正常刷新。
- 手机端断网后 PC 端显示断开状态。
- 手机端重连后 PC 端能补发事件或恢复完整快照。
- 不同思源内核（如两台 PC 各自运行思源）下，Broadcast 频道不互通（预期行为）。
- 消息体超过 128 MiB 时的降级处理（应极少见，仅在大量图片插入时可能触发）。

## 推荐下一步

技术验证已完成，两个方案均通过。建议下一步：

1. 进入阶段 1，实现 `src/live/types.ts`、`src/live/session.ts` 和 `BroadcastTransport`。
2. 阶段 1 完成后，用单元测试验证频道消息收发和 revision 管理。
3. 阶段 2-3 并行推进画布事件出口和观看端应用器。
4. 阶段 4 做端到端集成测试——手机写一笔、PC 看到一笔。

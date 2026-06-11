# 移动端手写与 PC 实时展示方案

## 目标

在不依赖思源数据同步的前提下，实现“手机端书写，PC 端实时展示手机端笔记动作”的能力。第一阶段建议限定为：手机端作为唯一编辑端，PC 端进入只读观看模式，双方通过实时通信通道传输手写事件，最终保存仍由手机端沿用现有保存流程完成。

## 结论

该功能在现有架构下可行，但不应直接复用当前 `saveData`/`loadData` 机制作为实时同步通道。当前项目已经具备三个关键基础：

- 手写数据模型：`SketchData` 包含 `strokes`、`elements`、`replayEvents`，见 `src/types/sketch.ts`。
- 本地动作录制：`SketchEditor.vue` 创建 `ReplayRecorder`，`SketchCanvas.vue` 在笔画、橡皮、图形、图片、元素变换等操作完成后记录事件。
- 动作回放渲染：`src/recorder/player.ts` 的 `ReplayPlayer` 已经能把 `ReplayEvent` 渲染为逐步动画。

主要缺口是跨设备实时通信、会话配对、权限控制、断线恢复和并发编辑策略。

## 推荐 MVP 范围

第一版建议做“按笔画近实时同步”，而不是一开始就做“笔尖移动级实时同步”。

- 手机端：打开手写编辑器并进入“投屏/同步到 PC”模式。
- PC 端：打开同一个手写块并进入“观看模式”。
- 同步粒度：一笔完成后发送一个完整 `ReplayEvent`，PC 端立即播放该笔画。
- 编辑权限：只允许手机端编辑，PC 端不允许修改画布、不参与保存。
- 保存路径：手机端继续使用现有 `useSaveManager` 保存完整 `SketchData` 和缩略图。
- 网络假设：优先支持同一局域网内手机连接 PC。

这样可以最大程度复用现有录制和回放体系，避免一开始改动 `canvasEngine` 的指针事件流。

## 网络方案

### 方案 A：同局域网直连

推荐作为 MVP。

网络要求：

- 手机和 PC 在同一个 Wi-Fi 或同一个可互通局域网。
- 手机能访问 PC 的局域网 IP 和插件监听端口，例如 `192.168.1.20:28181`。
- PC 防火墙允许该端口入站连接。
- 路由器没有开启 AP 隔离、客户端隔离、访客网络隔离。
- PC 端思源和插件保持运行，PC 不休眠。

实现方式：

- PC 端作为会话主机，创建本地 WebSocket 或 SSE 服务。
- PC 端展示二维码，二维码内容包含 `host`、`port`、`sessionId`、一次性 `token`。
- 手机端扫码后连接 PC 端服务。
- 手机端发送 `hello`，PC 返回当前会话状态。
- 手机端发送初始快照和后续事件。

优点：

- 延迟低。
- 不经过第三方服务器，隐私风险较低。
- 适合课堂、会议、办公室、家庭网络。

缺点：

- 公司、校园、酒店、访客 Wi-Fi 经常会阻止设备互访。
- PC 防火墙和端口监听会增加用户配置成本。
- 手机使用蜂窝网络时不可用。

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

### 方案 C：思源 broadcast API

现有开发文档中可见思源内核存在广播相关路由：

- `GET /ws/broadcast`
- `GET /es/broadcast/subscribe`
- `POST /api/broadcast/publish`
- `POST /api/broadcast/postMessage`
- `POST /api/broadcast/getChannels`
- `POST /api/broadcast/getChannelInfo`

该路线值得调研，但不建议直接作为第一版承诺能力。原因是项目当前没有使用这些接口，跨设备、跨内核、移动端权限、认证和网络穿透行为都需要实测确认。

可验证路径：

- 在 PC 端打开广播订阅。
- 在手机端通过思源 API 发布消息。
- 验证同一账号不同设备、同一局域网不同设备、移动端原生环境下是否能互收。
- 验证消息延迟、最大消息体、断线重连和权限要求。

如果实测结果稳定，可以把它作为同局域网方案的备选传输层；如果只在同一内核或同一前端窗口内有效，则不能满足本功能。

## 数据流设计

### 会话建立

PC 端创建观看会话：

```json
{
  "type": "session.created",
  "sketchId": "sketch-xxx",
  "sessionId": "sess-xxx",
  "role": "viewer-host",
  "transport": "lan-websocket",
  "url": "ws://192.168.1.20:28181/sketch-live",
  "token": "one-time-token"
}
```

手机端扫码连接后发送：

```json
{
  "type": "client.hello",
  "clientId": "mobile-xxx",
  "sessionId": "sess-xxx",
  "token": "one-time-token",
  "role": "writer",
  "protocolVersion": 1
}
```

PC 端校验后返回：

```json
{
  "type": "server.ready",
  "sessionId": "sess-xxx",
  "accepted": true,
  "protocolVersion": 1,
  "requiredSnapshot": true
}
```

### 初始快照

手机端发送当前完整 `SketchData`，PC 端用于建立观看基线：

```json
{
  "type": "sketch.snapshot",
  "sessionId": "sess-xxx",
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
  "sessionId": "sess-xxx",
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

当连接断开：

- PC 显示“连接已断开”状态。
- 手机端进入重连队列，最多缓存最近一段事件。
- 重连后手机发送 `client.resume`：

```json
{
  "type": "client.resume",
  "sessionId": "sess-xxx",
  "sketchId": "sketch-xxx",
  "lastKnownViewerRevision": 12,
  "writerRevision": 18
}
```

如果手机端仍有 `13-18` 的事件缓存，则补发事件；否则发送完整快照。

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

export interface LiveSessionInfo {
  sketchId: string;
  sessionId: string;
  token: string;
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
  sessionId: string;
  token: string;
  role: "writer";
  protocolVersion: 1;
}

export interface ServerReadyMessage {
  type: "server.ready";
  sessionId: string;
  accepted: boolean;
  protocolVersion: 1;
  requiredSnapshot: boolean;
}

export interface SketchSnapshotMessage {
  type: "sketch.snapshot";
  sessionId: string;
  sketchId: string;
  revision: number;
  data: SketchData;
}

export interface SketchEventMessage {
  type: "sketch.event";
  sessionId: string;
  sketchId: string;
  revision: number;
  event: ReplayEvent;
}

export interface ClientResumeMessage {
  type: "client.resume";
  sessionId: string;
  sketchId: string;
  lastKnownViewerRevision: number;
  writerRevision: number;
}

export interface ErrorMessage {
  type: "error";
  sessionId?: string;
  code: "unauthorized" | "revision_mismatch" | "unsupported_protocol" | "invalid_message";
  message: string;
}
```

### 新增 `src/live/session.ts`

职责：

- 生成 `sessionId` 和一次性 token。
- 校验消息是否属于当前会话。
- 管理 `revision`。
- 管理最近事件缓存，用于断线补发。

关键行为：

- `createLiveSession(sketchId)` 返回会话信息。
- `acceptWriter(message)` 校验 token、协议版本和角色。
- `nextRevision()` 单调递增。
- `recordEvent(message)` 只保留最近 N 条事件，例如 500 条。
- `canReplayFrom(revision)` 判断是否能补发事件。

### 新增 `src/live/transport.ts`

职责：

- 定义传输层接口。
- 屏蔽 WebSocket、SSE、broadcast API 的差异。

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
- `liveScanQrCode`

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
- 不接入真实网络。
- 用单元测试验证 token、revision、事件缓存。

涉及文件：

- 新增 `src/live/types.ts`
- 新增 `src/live/session.ts`
- 新增 `src/live/session.test.ts`

验收标准：

- `pnpm test` 通过。
- 会话 token 校验失败会拒绝连接。
- revision 单调递增。
- 事件缓存能根据 revision 补发连续事件。

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

### 阶段 4：同局域网传输

目标：

- PC 端创建本地实时会话。
- 手机端扫码或输入地址连接。
- 支持断开、重连和错误提示。

涉及文件：

- 新增 `src/live/transport.ts`
- 新增 `src/live/lanTransport.ts`
- 修改 `src/editor/SketchEditor.vue`
- 修改 `src/index.ts` 或插件入口相关初始化逻辑

验收标准：

- 同一 Wi-Fi 下手机能连接 PC。
- 手机完成一笔后 PC 端能在 200ms 左右展示。
- PC 防火墙阻止连接时给出明确提示。
- 断线后重连能补发缓存事件或重新发送快照。

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
- README 写清楚同局域网、防火墙、AP 隔离限制。

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
  sessionId: string;
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
  sessionId: string;
  sketchId: string;
  strokeId: string;
  points: Array<{ x: number; y: number; pressure: number; timestamp: number }>;
}

export interface LiveStrokeEndMessage {
  type: "stroke.end";
  sessionId: string;
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

手写内容可能包含隐私信息。公网中继和局域网开放端口都需要安全边界。

控制措施：

- 会话 token 一次性、短过期。
- 默认只允许同局域网。
- 公网中继必须使用 WSS。
- 不在中继服务端落盘用户手写数据。

### 网络兼容性

局域网直连在访客 Wi-Fi、校园网、公司网、酒店网中可能失败。

控制措施：

- UI 明确提示网络要求。
- 提供连接诊断：IP、端口、连接失败原因。
- 后续提供公网中继或 VPN 文档作为高级方案。

### 图片和背景资源

笔画事件较小，但图片和自定义背景可能依赖资产路径。PC 端如果无法访问手机端刚插入的资源，会出现缺图。

控制措施：

- 第一版可以限制实时同步图片插入，仅在最终保存后刷新。
- 或在事件中携带图片资产可访问 URL。
- 大资源与笔迹事件分通道处理，避免阻塞手写流。

## 手动验证清单

同局域网 MVP 完成后，需要至少验证以下场景：

- PC 和手机在同一家庭 Wi-Fi 下连接成功。
- 手机画普通笔画，PC 端在一笔结束后展示。
- 手机使用橡皮擦，PC 端展示擦除结果。
- 手机切换画笔颜色和宽度后书写，PC 端显示一致。
- 手机新增页面或扩展画布高度后，PC 端尺寸同步。
- PC 观看端无法编辑、无法触发保存。
- 手机端保存后，文档中的缩略图正常刷新。
- PC 端断网后显示断开状态。
- PC 端重连后能补发事件或恢复完整快照。
- 手机和 PC 不在同一网络时，连接失败提示清晰。
- 路由器开启 AP 隔离时，连接失败提示清晰。

## 推荐下一步

先做两个技术验证：

1. 验证移动端插件环境是否允许连接 PC 局域网 WebSocket。
2. 验证思源 broadcast API 是否能跨设备传递插件自定义消息。

如果第一个验证通过，进入同局域网 MVP。若第一个失败但 broadcast 跨设备稳定，则优先评估 broadcast 方案。若二者都不稳定，则需要公网中继服务。

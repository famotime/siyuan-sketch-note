# 移动端手写实时同步设计文档

## 概述

手机端书写，PC 端实时展示。通过思源 Broadcast API 传输手写事件，MVP 只支持笔画、橡皮、图形同步。

## 架构

```
手机端 (Writer)                          PC 端 (Viewer)
┌─────────────────┐                    ┌─────────────────┐
│ SketchCanvas    │                    │ SketchCanvas     │
│   recorder.record()                   │   (只读模式)      │
│   ↓ onLiveEvent │                    │                  │
│ useLiveWriter   │                    │ useLiveViewer    │
│   ↓             │                    │   ↑              │
│ BroadcastTransport                   │ BroadcastTransport
│   POST postMessage ──→ 思源内核 ──→ SSE/WS subscribe
└─────────────────┘                    └─────────────────┘
```

## 模块

### 1. `src/live/types.ts` — 协议类型

- `LiveRole`: `"writer"` | `"viewer"`
- `LiveConnectionState`: idle/connecting/connected/reconnecting/disconnected/error
- `LiveMessage` 联合类型：client.hello / server.ready / sketch.snapshot / sketch.event / client.resume / error
- MVP 的 sketch.event 只包含 StrokeReplayEvent | EraseReplayEvent | ShapeReplayEvent

### 2. `src/live/transport.ts` — Broadcast 传输层

- Writer 端：`fetchSyncPost('/api/broadcast/postMessage', { channel, message })`
- Viewer 端：`EventSource('/es/broadcast/subscribe')`，SSE 自动重连
- 接口：`start()` / `stop()` / `send()` / `onMessage()` / `onClose()` / `onError()`

### 3. `src/live/session.ts` — 会话管理

- 频道名：`sketch:${sketchId}:live`
- revision 单调递增
- 最近事件缓存（500 条），用于断线补发

### 4. `src/live/viewerApply.ts` — 观看端渲染器

- 不复用 ReplayPlayer（它是全量重放设计）
- `applySnapshot(data)` → 从 SketchData 重建画布
- `applyEvent(event)` → 单事件追加渲染

### 5. SketchCanvas.vue — 事件出口

- 新增 prop：`onLiveEvent?: (event: ReplayEvent) => void`
- 每个 `recorder.record()` 后追加调用
- MVP 只对 stroke/erase/shape 触发

### 6. SketchEditor.vue — 集成

- 新增 `useLiveSession` composable
- `liveMode: ref<"off" | "writer" | "viewer">`
- 入口放在更多菜单

## 设计决策

- **不复用 ReplayPlayer**：viewer 需要追加渲染，不是全量重放
- **SSE 做 viewer 端**：自动重连，比 WS 简单
- **revision 跳号 → 请求快照**
- **toolSwitch 不同步**：viewer 只关心绘制结果

## MVP 事件范围

| 事件类型 | 同步 | 说明 |
|---------|------|------|
| stroke | ✅ | 笔画 |
| erase | ✅ | 橡皮擦除 |
| shape | ✅ | 图形 |
| text | ❌ | 后续 |
| image | ❌ | 后续 |
| imageTransform | ❌ | 后续 |
| elementTransform | ❌ | 后续 |
| toolSwitch | ❌ | 不需要同步 |

## 分阶段执行

1. types + session + transport + 测试
2. 画布事件出口
3. 观看端渲染器
4. 端到端集成 + UI
5. 打磨

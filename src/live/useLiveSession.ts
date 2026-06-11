import { ref, shallowRef, onUnmounted } from "vue";
import type { LiveConnectionState, LiveMessage, SketchEventMessage, SketchSnapshotMessage, ClientResumeMessage } from "./types";
import type { LiveSupportedEvent } from "./types";
import type { SketchData } from "@/types/sketch";
import type { ReplayEvent } from "@/recorder/types";
import type { createLiveChannel, createLiveSession } from "./session";
import { nextRevision, recordEvent, canReplayFrom, getReplayableEvents } from "./session";
import * as sessionModule from "./session";
import { BroadcastTransport } from "./transport";
import { createLogger } from "@/utils/logger";

const log = createLogger("live");

export interface UseLiveSessionOptions {
  /** sketchId 的 getter，支持响应式更新 */
  sketchId: string | (() => string);
  /** Writer 模式：手机端传入当前 SketchData 的 getter */
  getSnapshotData?: () => SketchData;
}

export function useLiveSession(options: UseLiveSessionOptions) {
  const { getSnapshotData } = options;
  const getSketchId = typeof options.sketchId === "function" ? options.sketchId : () => options.sketchId;

  const role = ref<"off" | "writer" | "viewer">("off");
  const connectionState = ref<LiveConnectionState>("idle");

  // 频道名和 session 在首次连接时惰性创建，确保拿到正确的 sketchId
  let channelInfo: ReturnType<typeof createLiveChannel> | null = null;
  let session: ReturnType<typeof createLiveSession> | null = null;

  function ensureSession() {
    const sid = getSketchId();
    if (!channelInfo || channelInfo.sketchId !== sid) {
      channelInfo = sessionModule.createLiveChannel(sid);
      session = sessionModule.createLiveSession(sid);
    }
  }

  function getChannel(): string {
    ensureSession();
    return channelInfo!.channel;
  }

  function getSid(): string {
    ensureSession();
    return channelInfo!.sketchId;
  }

  const transport = shallowRef<BroadcastTransport | null>(null);

  // ── 通用：安全 disconnect ──

  async function disconnect(): Promise<void> {
    if (transport.value) {
      try {
        await transport.value.stop();
      } catch (err) {
        log("disconnect error", err);
      }
      transport.value = null;
    }
    role.value = "off";
    connectionState.value = "idle";
    viewerRevision = 0;
  }

  // ── Writer 模式 ──

  async function startWriter(): Promise<void> {
    // 先断开旧连接，防止 EventSource 泄漏
    await disconnect();

    role.value = "writer";
    connectionState.value = "connecting";

    const t = new BroadcastTransport(getChannel());
    transport.value = t;

    t.onMessage((msg) => {
      if (msg.type === "client.resume") {
        const resumeMsg = msg as ClientResumeMessage;
        if (typeof resumeMsg.lastKnownViewerRevision === "number") {
          handleResumeRequest(resumeMsg).catch((err) => {
            log("handleResumeRequest error", err);
          });
        }
      }
    });

    t.onError(() => {
      connectionState.value = "error";
    });

    t.onClose(() => {
      if (role.value === "writer") {
        connectionState.value = "disconnected";
      }
    });

    await t.start();
    connectionState.value = "connected";

    const sid = getSid();
    await t.send({
      type: "client.hello",
      clientId: `writer-${Date.now()}`,
      sketchId: sid,
      role: "writer",
      protocolVersion: 1,
    });

    if (getSnapshotData) {
      await t.send({
        type: "sketch.snapshot",
        sketchId: sid,
        revision: 0,
        data: getSnapshotData(),
      });
    }
  }

  async function sendEvent(event: ReplayEvent): Promise<void> {
    if (role.value !== "writer" || !transport.value || !session) return;
    if (event.type !== "stroke" && event.type !== "erase" && event.type !== "shape") return;

    const rev = nextRevision(session);
    const msg: SketchEventMessage = {
      type: "sketch.event",
      sketchId: getSid(),
      revision: rev,
      event: event as LiveSupportedEvent,
    };
    recordEvent(session, msg);
    try {
      await transport.value.send(msg);
    } catch (err) {
      log("sendEvent error", err);
    }
  }

  async function handleResumeRequest(msg: ClientResumeMessage): Promise<void> {
    if (!transport.value || !session) return;
    if (canReplayFrom(session, msg.lastKnownViewerRevision)) {
      const events = getReplayableEvents(session, msg.lastKnownViewerRevision);
      for (const event of events) {
        await transport.value.send(event);
      }
    } else if (getSnapshotData) {
      await transport.value.send({
        type: "sketch.snapshot",
        sketchId: getSid(),
        revision: session.revision,
        data: getSnapshotData(),
      });
    }
  }

  // ── Viewer 模式 ──

  let onSnapshotCallback: ((data: SketchData) => void) | null = null;
  let onEventCallback: ((event: LiveSupportedEvent) => void) | null = null;

  function onSnapshot(cb: (data: SketchData) => void): () => void {
    onSnapshotCallback = cb;
    return () => { onSnapshotCallback = null; };
  }

  function onLiveEvent(cb: (event: LiveSupportedEvent) => void): () => void {
    onEventCallback = cb;
    return () => { onEventCallback = null; };
  }

  let viewerRevision = 0;

  async function startViewer(): Promise<void> {
    // 先断开旧连接
    await disconnect();

    role.value = "viewer";
    connectionState.value = "connecting";
    viewerRevision = 0;

    const t = new BroadcastTransport(getChannel());
    transport.value = t;

    t.onMessage((msg) => {
      handleViewerMessage(msg);
    });

    t.onError(() => {
      connectionState.value = "error";
    });

    t.onClose(() => {
      if (role.value === "viewer") {
        connectionState.value = "disconnected";
      }
    });

    await t.start();
    connectionState.value = "connected";
  }

  function handleViewerMessage(msg: LiveMessage): void {
    switch (msg.type) {
      case "sketch.snapshot":
        viewerRevision = (msg as SketchSnapshotMessage).revision;
        onSnapshotCallback?.((msg as SketchSnapshotMessage).data);
        break;

      case "sketch.event": {
        const eventMsg = msg as SketchEventMessage;
        if (eventMsg.revision === viewerRevision + 1) {
          viewerRevision = eventMsg.revision;
          onEventCallback?.(eventMsg.event);
        } else if (eventMsg.revision > viewerRevision + 1) {
          requestResume();
        }
        // 忽略重复的旧事件 (revision <= viewerRevision)
        break;
      }

      // client.hello 是 writer 发送的消息，viewer 不应响应
    }
  }

  async function requestResume(): Promise<void> {
    if (!transport.value || !session) return;
    connectionState.value = "reconnecting";
    try {
      await transport.value.send({
        type: "client.resume",
        sketchId: getSid(),
        lastKnownViewerRevision: viewerRevision,
        writerRevision: session.revision,
      });
    } catch (err) {
      log("requestResume error", err);
      connectionState.value = "error";
    }
  }

  // ── 生命周期 ──

  onUnmounted(() => {
    disconnect().catch(() => {});
  });

  return {
    role,
    connectionState,
    get channelInfo() { return channelInfo; },
    startWriter,
    startViewer,
    sendEvent,
    disconnect,
    onSnapshot,
    onLiveEvent,
  };
}

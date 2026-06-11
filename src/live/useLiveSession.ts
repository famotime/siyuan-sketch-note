import { ref, shallowRef, onUnmounted } from "vue";
import type { LiveConnectionState, LiveMessage, SketchEventMessage, SketchSnapshotMessage } from "./types";
import type { LiveSupportedEvent } from "./types";
import type { SketchData } from "@/types/sketch";
import type { ReplayEvent } from "@/recorder/types";
import { createLiveChannel, createLiveSession, nextRevision, recordEvent, canReplayFrom, getReplayableEvents } from "./session";
import { BroadcastTransport } from "./transport";

export interface UseLiveSessionOptions {
  sketchId: string;
  /** Writer 模式：手机端传入当前 SketchData 的 getter */
  getSnapshotData?: () => SketchData;
}

export function useLiveSession(options: UseLiveSessionOptions) {
  const { sketchId, getSnapshotData } = options;

  const role = ref<"off" | "writer" | "viewer">("off");
  const connectionState = ref<LiveConnectionState>("idle");
  const channelInfo = createLiveChannel(sketchId);
  const session = createLiveSession(sketchId);

  const transport = shallowRef<BroadcastTransport | null>(null);

  // ── Writer 模式 ──

  async function startWriter(): Promise<void> {
    role.value = "writer";
    connectionState.value = "connecting";

    const t = new BroadcastTransport(channelInfo.channel);
    transport.value = t;

    t.onMessage((msg) => {
      if (msg.type === "client.resume") {
        handleResumeRequest(msg as any);
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

    await t.send({
      type: "client.hello",
      clientId: `writer-${Date.now()}`,
      sketchId,
      role: "writer",
      protocolVersion: 1,
    });

    if (getSnapshotData) {
      await t.send({
        type: "sketch.snapshot",
        sketchId,
        revision: 0,
        data: getSnapshotData(),
      });
    }
  }

  async function sendEvent(event: ReplayEvent): Promise<void> {
    if (role.value !== "writer" || !transport.value) return;
    if (event.type !== "stroke" && event.type !== "erase" && event.type !== "shape") return;

    const rev = nextRevision(session);
    const msg: SketchEventMessage = {
      type: "sketch.event",
      sketchId,
      revision: rev,
      event: event as LiveSupportedEvent,
    };
    recordEvent(session, msg);
    await transport.value.send(msg);
  }

  async function handleResumeRequest(msg: { lastKnownViewerRevision: number; writerRevision: number }): Promise<void> {
    if (!transport.value) return;
    if (canReplayFrom(session, msg.lastKnownViewerRevision)) {
      const events = getReplayableEvents(session, msg.lastKnownViewerRevision);
      for (const event of events) {
        await transport.value.send(event);
      }
    } else if (getSnapshotData) {
      await transport.value.send({
        type: "sketch.snapshot",
        sketchId,
        revision: session.revision,
        data: getSnapshotData(),
      });
    }
  }

  // ── Viewer 模式 ──

  const onSnapshotCallback = ref<((data: SketchData) => void) | null>(null);
  const onEventCallback = ref<((event: LiveSupportedEvent) => void) | null>(null);

  function onSnapshot(cb: (data: SketchData) => void): () => void {
    onSnapshotCallback.value = cb;
    return () => { onSnapshotCallback.value = null; };
  }

  function onLiveEvent(cb: (event: LiveSupportedEvent) => void): () => void {
    onEventCallback.value = cb;
    return () => { onEventCallback.value = null; };
  }

  let viewerRevision = 0;

  async function startViewer(): Promise<void> {
    role.value = "viewer";
    connectionState.value = "connecting";
    viewerRevision = 0;

    const t = new BroadcastTransport(channelInfo.channel);
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
        onSnapshotCallback.value?.((msg as SketchSnapshotMessage).data);
        break;

      case "sketch.event": {
        const eventMsg = msg as SketchEventMessage;
        if (eventMsg.revision === viewerRevision + 1) {
          viewerRevision = eventMsg.revision;
          onEventCallback.value?.(eventMsg.event);
        } else if (eventMsg.revision > viewerRevision + 1) {
          requestResume();
        }
        break;
      }

      case "client.hello":
        if (transport.value) {
          transport.value.send({
            type: "server.ready",
            sketchId,
            accepted: true,
            protocolVersion: 1,
            requiredSnapshot: true,
          });
        }
        break;
    }
  }

  function requestResume(): void {
    if (!transport.value) return;
    connectionState.value = "reconnecting";
    transport.value.send({
      type: "client.resume",
      sketchId,
      lastKnownViewerRevision: viewerRevision,
      writerRevision: session.revision,
    });
  }

  // ── 通用 ──

  async function disconnect(): Promise<void> {
    if (transport.value) {
      await transport.value.stop();
      transport.value = null;
    }
    role.value = "off";
    connectionState.value = "idle";
    viewerRevision = 0;
  }

  onUnmounted(() => {
    disconnect();
  });

  return {
    role,
    connectionState,
    channelInfo,
    startWriter,
    startViewer,
    sendEvent,
    disconnect,
    onSnapshot,
    onLiveEvent,
  };
}

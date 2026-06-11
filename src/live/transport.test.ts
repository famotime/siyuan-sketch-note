import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("siyuan", () => ({
  fetchSyncPost: vi.fn(),
}));

import { fetchSyncPost } from "siyuan";
import { BroadcastTransport } from "./transport";
import type { LiveMessage } from "./types";

const mockFetchSyncPost = vi.mocked(fetchSyncPost);

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onopen: ((ev: Event) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  private listeners = new Map<string, ((ev: MessageEvent) => void)[]>();
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (ev: MessageEvent) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type)!.push(listener);
  }

  removeEventListener(type: string, listener: (ev: MessageEvent) => void) {
    const list = this.listeners.get(type);
    if (list) {
      const idx = list.indexOf(listener);
      if (idx >= 0) list.splice(idx, 1);
    }
  }

  close() {
    this.closed = true;
  }

  simulateMessage(channel: string, data: string) {
    const listeners = this.listeners.get(channel) ?? [];
    const event = new MessageEvent(channel, { data });
    for (const fn of listeners) fn(event);
  }
}

(globalThis as any).EventSource = MockEventSource;

describe("BroadcastTransport", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    mockFetchSyncPost.mockReset();
  });

  it("send 调用 postMessage API", async () => {
    mockFetchSyncPost.mockResolvedValue({ code: 0, data: null });
    const transport = new BroadcastTransport("sketch:sk-1:live");
    const msg: LiveMessage = {
      type: "client.hello",
      clientId: "mobile-1",
      sketchId: "sk-1",
      role: "writer",
      protocolVersion: 1,
    };
    await transport.send(msg);
    expect(mockFetchSyncPost).toHaveBeenCalledWith(
      "/api/broadcast/postMessage",
      {
        channel: "sketch:sk-1:live",
        message: JSON.stringify(msg),
      },
    );
  });

  it("start 创建 EventSource 并监听频道事件", async () => {
    mockFetchSyncPost.mockResolvedValue({ code: 0, data: null });
    const transport = new BroadcastTransport("sketch:sk-1:live");
    const received: LiveMessage[] = [];
    transport.onMessage((msg) => received.push(msg));

    await transport.start();
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].closed).toBe(false);

    const testMsg: LiveMessage = {
      type: "sketch.event",
      sketchId: "sk-1",
      revision: 1,
      event: { type: "stroke", id: "re-1", timestamp: 1000, stroke: { id: "s1", points: [], color: "#000", width: 2, tool: "pen" } },
    };
    MockEventSource.instances[0].simulateMessage(
      "sketch:sk-1:live",
      JSON.stringify(testMsg),
    );
    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("sketch.event");
  });

  it("stop 关闭 EventSource", async () => {
    const transport = new BroadcastTransport("sketch:sk-1:live");
    await transport.start();
    expect(MockEventSource.instances[0].closed).toBe(false);
    await transport.stop();
    expect(MockEventSource.instances[0].closed).toBe(true);
  });

  it("onError 回调在 SSE 错误时触发", async () => {
    const transport = new BroadcastTransport("sketch:sk-1:live");
    let errorReceived = false;
    transport.onError(() => { errorReceived = true; });
    await transport.start();
    MockEventSource.instances[0].onerror?.(new Event("error"));
    expect(errorReceived).toBe(true);
  });

  it("onClose 回调在 SSE 关闭时触发", async () => {
    const transport = new BroadcastTransport("sketch:sk-1:live");
    let closeReceived = false;
    transport.onClose(() => { closeReceived = true; });
    await transport.start();
    await transport.stop();
    expect(closeReceived).toBe(true);
  });
});

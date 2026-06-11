import { fetchSyncPost } from "siyuan";
import type { LiveMessage } from "./types";

export interface LiveTransport {
  start(): Promise<void>;
  stop(): Promise<void>;
  send(message: LiveMessage): Promise<void>;
  onMessage(handler: (message: LiveMessage) => void): () => void;
  onClose(handler: () => void): () => void;
  onError(handler: (error: Error) => void): () => void;
}

export class BroadcastTransport implements LiveTransport {
  private channel: string;
  private es: EventSource | null = null;
  private messageHandlers: Array<(msg: LiveMessage) => void> = [];
  private closeHandlers: Array<() => void> = [];
  private errorHandlers: Array<(err: Error) => void> = [];

  constructor(channel: string) {
    this.channel = channel;
  }

  async start(): Promise<void> {
    this.stopInternal();

    const url = `/es/broadcast/subscribe?channel=${encodeURIComponent(this.channel)}`;
    this.es = new EventSource(url);

    this.es.addEventListener(this.channel, (event: MessageEvent) => {
      this.handleRawMessage(event.data);
    });

    this.es.onmessage = (event) => {
      this.handleRawMessage(event.data);
    };

    this.es.onerror = () => {
      for (const handler of this.errorHandlers) {
        handler(new Error("SSE connection error"));
      }
    };
  }

  async stop(): Promise<void> {
    this.stopInternal();
    for (const handler of this.closeHandlers) {
      handler();
    }
  }

  async send(message: LiveMessage): Promise<void> {
    const result = await fetchSyncPost("/api/broadcast/postMessage", {
      channel: this.channel,
      message: JSON.stringify(message),
    });
    if (result.code !== 0) {
      throw new Error(`postMessage failed: ${result.msg ?? result.code}`);
    }
  }

  onMessage(handler: (message: LiveMessage) => void): () => void {
    this.messageHandlers.push(handler);
    return () => {
      const idx = this.messageHandlers.indexOf(handler);
      if (idx >= 0) this.messageHandlers.splice(idx, 1);
    };
  }

  onClose(handler: () => void): () => void {
    this.closeHandlers.push(handler);
    return () => {
      const idx = this.closeHandlers.indexOf(handler);
      if (idx >= 0) this.closeHandlers.splice(idx, 1);
    };
  }

  onError(handler: (error: Error) => void): () => void {
    this.errorHandlers.push(handler);
    return () => {
      const idx = this.errorHandlers.indexOf(handler);
      if (idx >= 0) this.errorHandlers.splice(idx, 1);
    };
  }

  private stopInternal(): void {
    if (this.es) {
      this.es.close();
      this.es = null;
    }
  }

  private handleRawMessage(data: string): void {
    try {
      const msg = JSON.parse(data) as LiveMessage;
      for (const handler of this.messageHandlers) {
        handler(msg);
      }
    } catch {
      // ignore unparseable messages
    }
  }
}

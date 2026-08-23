import type { Plugin } from "siyuan";

export interface LockResult {
  granted: boolean;
  generation?: number;
  holderEditorId?: string;
}

const LOCK_HEARTBEAT_INTERVAL_MS = 2000;
const LOCK_STALE_MS = 6000;

/**
 * 内存备用锁注册表（在无 Kernel RPC 环境或测试环境中作为 fallback）
 */
interface LocalLock {
  editorId: string;
  generation: number;
  lastHeartbeat: number;
}

const localLocks = new Map<string, LocalLock>();
let localGenerationCounter = 0;

/**
 * 跨窗口编辑排他锁 (Cross-Window Editor Lock)
 * 防止用户在思源笔记的多窗口（如悬浮窗、分屏、新窗口）同时编辑同一个手绘白板导致数据相互覆盖。
 */
export class EditorLock {
  private timer: number | null = null;

  private constructor(
    private readonly plugin: Plugin | null,
    private readonly filename: string,
    private readonly editorId: string,
    private readonly generation: number,
  ) {}

  getEditorId(): string {
    return this.editorId;
  }

  getGeneration(): number {
    return this.generation;
  }

  /**
   * 申请编辑排他锁
   */
  static async acquire(
    plugin: Plugin | null,
    filename: string,
    editorId: string,
  ): Promise<EditorLock | null> {
    const kernel = (plugin as any)?.kernel;
    if (kernel?.rpc?.call?.acquire) {
      try {
        const res: LockResult = await kernel.rpc.call.acquire(filename, editorId);
        if (!res?.granted) return null;
        return new EditorLock(plugin, filename, editorId, res.generation ?? 1);
      } catch {
        // Fallback to local memory lock
      }
    }

    // 本地内存/跨标签页容错锁逻辑
    const now = Date.now();
    const existing = localLocks.get(filename);
    if (existing && existing.editorId !== editorId && (now - existing.lastHeartbeat) <= LOCK_STALE_MS) {
      return null;
    }

    const generation = ++localGenerationCounter;
    localLocks.set(filename, { editorId, generation, lastHeartbeat: now });
    return new EditorLock(plugin, filename, editorId, generation);
  }

  /**
   * 开启定时心跳以保持锁有效
   */
  startHeartbeat(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => {
      const kernel = (this.plugin as any)?.kernel;
      if (kernel?.rpc?.notify?.heartbeat) {
        kernel.rpc.notify.heartbeat(this.filename, this.editorId, this.generation);
      } else {
        const existing = localLocks.get(this.filename);
        if (existing && existing.editorId === this.editorId && existing.generation === this.generation) {
          existing.lastHeartbeat = Date.now();
        }
      }
    }, LOCK_HEARTBEAT_INTERVAL_MS) as unknown as number;
  }

  /**
   * 释放排他锁
   */
  release(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }

    const kernel = (this.plugin as any)?.kernel;
    if (kernel?.rpc?.notify?.release) {
      kernel.rpc.notify.release(this.filename, this.editorId, this.generation);
    } else {
      const existing = localLocks.get(this.filename);
      if (existing && existing.editorId === this.editorId && existing.generation === this.generation) {
        localLocks.delete(this.filename);
      }
    }
  }
}

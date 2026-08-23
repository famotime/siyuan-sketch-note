import { describe, it, expect, vi } from "vitest";
import { EditorLock } from "./kernelLock";

describe("EditorLock", () => {
  it("acquires lock successfully for new whiteboard file", async () => {
    const lock = await EditorLock.acquire(null, "sketch-1.json", "editor-a");
    expect(lock).not.toBeNull();
    expect(lock?.getEditorId()).toBe("editor-a");
    lock?.release();
  });

  it("blocks another editor from acquiring the same active lock", async () => {
    const lock1 = await EditorLock.acquire(null, "sketch-concurrent.json", "editor-1");
    expect(lock1).not.toBeNull();

    const lock2 = await EditorLock.acquire(null, "sketch-concurrent.json", "editor-2");
    expect(lock2).toBeNull();

    // 释放后允许 editor-2 获取
    lock1?.release();
    const lock2Retry = await EditorLock.acquire(null, "sketch-concurrent.json", "editor-2");
    expect(lock2Retry).not.toBeNull();
    lock2Retry?.release();
  });

  it("allows the same editor to re-acquire (reclaim) its own lock", async () => {
    const lock1 = await EditorLock.acquire(null, "sketch-reclaim.json", "editor-same");
    expect(lock1).not.toBeNull();

    const lockReclaim = await EditorLock.acquire(null, "sketch-reclaim.json", "editor-same");
    expect(lockReclaim).not.toBeNull();
    lockReclaim?.release();
  });
});

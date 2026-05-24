import { describe, expect, it } from "vitest";
import { SaveQueue } from "./saveQueue";

describe("SaveQueue", () => {
  it("runs save jobs serially in request order", async () => {
    const queue = new SaveQueue();
    const events: string[] = [];
    let releaseFirst: (() => void) | undefined;

    const first = queue.enqueue(() => new Promise<boolean>((resolve) => {
      events.push("first:start");
      releaseFirst = () => {
        events.push("first:end");
        resolve(true);
      };
    }));

    const second = queue.enqueue(async () => {
      events.push("second:start");
      return true;
    });

    await Promise.resolve();
    expect(events).toEqual(["first:start"]);

    releaseFirst?.();
    await Promise.all([first, second]);

    expect(events).toEqual([
      "first:start",
      "first:end",
      "second:start",
    ]);
  });

  it("keeps running later jobs after a failed save", async () => {
    const queue = new SaveQueue();
    const events: string[] = [];

    await expect(queue.enqueue(async () => {
      events.push("failed:start");
      throw new Error("save failed");
    })).rejects.toThrow("save failed");

    await queue.enqueue(async () => {
      events.push("next:start");
      return true;
    });

    expect(events).toEqual(["failed:start", "next:start"]);
  });
});

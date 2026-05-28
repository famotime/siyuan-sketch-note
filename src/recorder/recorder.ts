import type { ReplayEvent } from "./types";

export class ReplayRecorder {
  private events: ReplayEvent[] = [];
  private suspended = false;

  constructor(initialEvents: ReplayEvent[] = []) {
    this.events = [...initialEvents];
  }

  record(event: ReplayEvent): void {
    if (this.suspended) return;
    this.events.push(event);
  }

  getEvents(): ReplayEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events = [];
  }

  setSuspended(suspended: boolean): void {
    this.suspended = suspended;
  }

  isSuspended(): boolean {
    return this.suspended;
  }
}

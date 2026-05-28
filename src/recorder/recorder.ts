import type { ReplayEvent, ReplayEventType, ReplayRecorderConfig } from "./types";
import { DEFAULT_RECORDER_CONFIG } from "./types";

export class ReplayRecorder {
  private events: ReplayEvent[] = [];
  private config: ReplayRecorderConfig;
  private suspended = false;

  constructor(config: Partial<ReplayRecorderConfig> = {}) {
    this.config = { ...DEFAULT_RECORDER_CONFIG, ...config };
  }

  record(event: ReplayEvent): void {
    if (this.suspended) return;
    if (!this.config[event.type]) return;
    this.events.push(event);
  }

  getEvents(): ReplayEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events = [];
  }

  setEnabled(type: ReplayEventType, enabled: boolean): void {
    this.config[type] = enabled;
  }

  isEnabled(type: ReplayEventType): boolean {
    return this.config[type];
  }

  getConfig(): ReplayRecorderConfig {
    return { ...this.config };
  }

  setSuspended(suspended: boolean): void {
    this.suspended = suspended;
  }

  isSuspended(): boolean {
    return this.suspended;
  }
}

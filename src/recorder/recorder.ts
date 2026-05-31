import type { ReplayEvent } from "./types";

export class ReplayRecorder {
  private events: ReplayEvent[] = [];
  private suspended = false;
  private undoStack: ReplayEvent[][] = [];
  private redoStack: ReplayEvent[][] = [];

  constructor(initialEvents: ReplayEvent[] = []) {
    this.events = [...initialEvents];
  }

  pushUndoSnapshot(): void {
    if (this.suspended) return;
    this.undoStack.push(JSON.parse(JSON.stringify(this.events)));
    this.redoStack = [];
  }

  undo(): boolean {
    if (this.undoStack.length === 0) return false;
    this.redoStack.push(JSON.parse(JSON.stringify(this.events)));
    this.events = this.undoStack.pop()!;
    return true;
  }

  redo(): boolean {
    if (this.redoStack.length === 0) return false;
    this.undoStack.push(JSON.parse(JSON.stringify(this.events)));
    this.events = this.redoStack.pop()!;
    return true;
  }

  clearHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
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

  truncateAt(index: number): void {
    this.events = this.events.slice(0, index);
  }

  setSuspended(suspended: boolean): void {
    this.suspended = suspended;
  }

  isSuspended(): boolean {
    return this.suspended;
  }
}

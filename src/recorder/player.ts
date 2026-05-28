import type { ReplayEvent, StrokeReplayEvent, ShapeReplayEvent } from "./types";
import type { Stroke, StrokePoint } from "@/types/sketch";
import { getPressureWidth, getSmoothedSegments } from "@/engine/strokeSmoothing";

export type PlaybackState = "idle" | "playing" | "paused";
export type PlaybackSpeed = 1 | 2 | 4;

const CHAR_DELAY_MS = 30;
const IMAGE_FADE_MS = 200;

export interface ReplayPlayerOptions {
  redrawBackground?: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void;
}

export class ReplayPlayer {
  private events: ReplayEvent[];
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private options: ReplayPlayerOptions;
  private state: PlaybackState = "idle";
  private speed: PlaybackSpeed = 1;
  private currentIndex = 0;
  private animFrameId: number | null = null;
  private lastFrameTime = 0;

  // Per-event animation state
  private strokeAnimIndex = 0;
  private textAnimIndex = 0;
  private textAnimTimer = 0;
  private imageAnimProgress = 0;

  // Completed strokes for erase visualization
  private completedStrokes: Map<string, Stroke> = new Map();

  onStateChange?: (state: PlaybackState) => void;
  onProgress?: (current: number, total: number) => void;
  onComplete?: () => void;

  constructor(events: ReplayEvent[], canvas: HTMLCanvasElement, options: ReplayPlayerOptions = {}) {
    this.events = events;
    this.canvas = canvas;
    this.options = options;
    this.ctx = canvas.getContext("2d")!;
  }

  getState(): PlaybackState { return this.state; }
  getProgress(): number { return this.events.length === 0 ? 0 : this.currentIndex / this.events.length; }
  getCurrentIndex(): number { return this.currentIndex; }
  getTotalEvents(): number { return this.events.length; }
  getSpeed(): PlaybackSpeed { return this.speed; }

  play(): void {
    if (this.state === "playing") return;
    if (this.currentIndex >= this.events.length) {
      this.currentIndex = 0;
      this.clearCanvas();
      this.completedStrokes.clear();
    }
    this.state = "playing";
    this.onStateChange?.("playing");
    this.lastFrameTime = performance.now();
    this.scheduleFrame();
  }

  pause(): void {
    if (this.state !== "playing") return;
    this.state = "paused";
    this.onStateChange?.("paused");
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  reset(): void {
    this.pause();
    this.state = "idle";
    this.currentIndex = 0;
    this.strokeAnimIndex = 0;
    this.textAnimIndex = 0;
    this.textAnimTimer = 0;
    this.imageAnimProgress = 0;
    this.completedStrokes.clear();
    this.clearCanvas();
    this.onStateChange?.("idle");
    this.onProgress?.(0, this.events.length);
  }

  setSpeed(speed: PlaybackSpeed): void { this.speed = speed; }

  goToEvent(index: number): void {
    const wasPlaying = this.state === "playing";
    if (wasPlaying) this.pause();

    this.clearCanvas();
    this.completedStrokes.clear();
    this.currentIndex = Math.max(0, Math.min(index, this.events.length));
    this.strokeAnimIndex = 0;
    this.textAnimIndex = 0;
    this.imageAnimProgress = 0;

    // Instantly render all events before currentIndex
    for (let i = 0; i < this.currentIndex; i++) {
      this.renderEventInstant(this.events[i]);
    }
    this.onProgress?.(this.currentIndex, this.events.length);
  }

  destroy(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private scheduleFrame(): void {
    this.animFrameId = requestAnimationFrame((time) => this.frame(time));
  }

  private frame(time: number): void {
    if (this.state !== "playing") return;
    if (this.currentIndex >= this.events.length) {
      this.state = "idle";
      this.onStateChange?.("idle");
      this.onComplete?.();
      return;
    }

    const event = this.events[this.currentIndex];
    const done = this.renderEventAnimated(event, time);

    if (done) {
      this.currentIndex++;
      this.strokeAnimIndex = 0;
      this.textAnimIndex = 0;
      this.textAnimTimer = 0;
      this.imageAnimProgress = 0;
      this.onProgress?.(this.currentIndex, this.events.length);
    }

    this.lastFrameTime = time;
    this.scheduleFrame();
  }

  private renderEventAnimated(event: ReplayEvent, _time: number): boolean {
    switch (event.type) {
      case "stroke":
      case "shape":
        return this.animateStroke(event);
      case "erase":
        this.applyErase(event.erasedIds);
        return true;
      case "text":
        return this.animateText(event.element.text, event.element);
      case "image":
        return this.animateImage(event.element);
      case "toolSwitch":
        return true;
    }
  }

  private animateStroke(event: StrokeReplayEvent | ShapeReplayEvent): boolean {
    const { stroke } = event;
    const pointsPerFrame = this.speed;
    const pts = stroke.points;

    if (this.strokeAnimIndex >= pts.length) {
      this.renderStrokeFull(stroke);
      this.completedStrokes.set(stroke.id, stroke);
      return true;
    }

    const end = Math.min(this.strokeAnimIndex + pointsPerFrame, pts.length);

    if (this.strokeAnimIndex === 0) {
      this.strokeAnimIndex = 1;
    }

    for (let i = Math.max(1, this.strokeAnimIndex); i < end; i++) {
      this.renderStrokeSegment(stroke, pts[i - 1], pts[i]);
    }
    this.strokeAnimIndex = end;

    if (this.strokeAnimIndex >= pts.length) {
      this.completedStrokes.set(stroke.id, stroke);
      return true;
    }
    return false;
  }

  private animateText(text: string, element: { bounds: { x: number; y: number; width: number; height: number }; style: { color: string; fontSize: number; fontFamily: string } }): boolean {
    if (this.speed >= 2) {
      this.renderTextFull(text, element);
      return true;
    }
    if (this.textAnimIndex >= text.length) return true;

    this.textAnimTimer += 16;
    if (this.textAnimTimer < CHAR_DELAY_MS) return false;

    this.textAnimTimer = 0;
    this.textAnimIndex++;
    const partial = text.slice(0, this.textAnimIndex);

    this.ctx.save();
    this.ctx.fillStyle = element.style.color;
    this.ctx.font = `${element.style.fontSize}px ${element.style.fontFamily}`;
    this.ctx.textBaseline = "top";
    this.ctx.clearRect(element.bounds.x - 2, element.bounds.y - 2, element.bounds.width + 4, element.bounds.height + 4);
    this.ctx.fillText(partial, element.bounds.x, element.bounds.y, element.bounds.width);
    this.ctx.restore();

    return this.textAnimIndex >= text.length;
  }

  private animateImage(element: { src: string; bounds: { x: number; y: number; width: number; height: number }; opacity?: number }): boolean {
    this.imageAnimProgress += 16 / IMAGE_FADE_MS;
    if (this.imageAnimProgress > 1) this.imageAnimProgress = 1;

    this.ctx.save();
    this.ctx.globalAlpha = (element.opacity ?? 1) * this.imageAnimProgress;
    this.ctx.fillStyle = "#f4f4f4";
    this.ctx.strokeStyle = "#c8c8c8";
    this.ctx.lineWidth = 1;
    this.ctx.fillRect(element.bounds.x, element.bounds.y, element.bounds.width, element.bounds.height);
    this.ctx.strokeRect(element.bounds.x, element.bounds.y, element.bounds.width, element.bounds.height);
    this.ctx.restore();

    return this.imageAnimProgress >= 1;
  }

  private applyErase(erasedIds: string[]): void {
    for (const id of erasedIds) this.completedStrokes.delete(id);
    this.fullRedraw();
  }

  private fullRedraw(): void {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
    for (const stroke of this.completedStrokes.values()) this.renderStrokeFull(stroke);
  }

  private renderEventInstant(event: ReplayEvent): void {
    switch (event.type) {
      case "stroke":
      case "shape":
        this.renderStrokeFull(event.stroke);
        this.completedStrokes.set(event.stroke.id, event.stroke);
        break;
      case "erase":
        this.applyErase(event.erasedIds);
        break;
      case "text":
        this.renderTextFull(event.element.text, event.element);
        break;
      case "image":
        this.ctx.save();
        this.ctx.globalAlpha = event.element.opacity ?? 1;
        this.ctx.fillStyle = "#f4f4f4";
        this.ctx.fillRect(event.element.bounds.x, event.element.bounds.y, event.element.bounds.width, event.element.bounds.height);
        this.ctx.restore();
        break;
      case "toolSwitch":
        break;
    }
  }

  private renderStrokeFull(stroke: Stroke): void {
    const { points, color, width, tool, isShape } = stroke;
    if (points.length < 2) return;

    this.ctx.save();
    if (tool === "eraser") {
      this.ctx.globalCompositeOperation = "destination-out";
      this.ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      this.ctx.globalAlpha = stroke.opacity ?? 1;
      this.ctx.globalCompositeOperation = "source-over";
      this.ctx.strokeStyle = color;
    }
    this.ctx.lineJoin = "round";
    this.ctx.lineCap = "round";

    const firstPressure = points[0].pressure;
    const allSame = points.every((p) => p.pressure === firstPressure);

    if (isShape) {
      this.ctx.lineWidth = getPressureWidth(width, firstPressure);
      this.ctx.beginPath();
      this.ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) this.ctx.lineTo(points[i].x, points[i].y);
      this.ctx.stroke();
    } else if (allSame) {
      this.ctx.lineWidth = getPressureWidth(width, firstPressure);
      this.ctx.beginPath();
      this.ctx.moveTo(points[0].x, points[0].y);
      for (const segment of getSmoothedSegments(points)) {
        this.ctx.quadraticCurveTo(segment.control.x, segment.control.y, segment.end.x, segment.end.y);
      }
      this.ctx.stroke();
    } else {
      const segments = getSmoothedSegments(points);
      let currentX = points[0].x;
      let currentY = points[0].y;
      for (const segment of segments) {
        this.ctx.lineWidth = getPressureWidth(width, segment.control.pressure);
        this.ctx.beginPath();
        this.ctx.moveTo(currentX, currentY);
        this.ctx.quadraticCurveTo(segment.control.x, segment.control.y, segment.end.x, segment.end.y);
        this.ctx.stroke();
        currentX = segment.end.x;
        currentY = segment.end.y;
      }
    }
    this.ctx.restore();
  }

  private renderStrokeSegment(stroke: Stroke, prev: StrokePoint, curr: StrokePoint): void {
    this.ctx.save();
    if (stroke.tool === "eraser") {
      this.ctx.globalCompositeOperation = "destination-out";
      this.ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      this.ctx.globalAlpha = stroke.opacity ?? 1;
      this.ctx.globalCompositeOperation = "source-over";
      this.ctx.strokeStyle = stroke.color;
    }
    this.ctx.lineWidth = getPressureWidth(stroke.width, curr.pressure);
    this.ctx.lineJoin = "round";
    this.ctx.lineCap = "round";
    this.ctx.beginPath();
    this.ctx.moveTo(prev.x, prev.y);
    this.ctx.lineTo(curr.x, curr.y);
    this.ctx.stroke();
    this.ctx.restore();
  }

  private renderTextFull(text: string, element: { bounds: { x: number; y: number; width: number }; style: { color: string; fontSize: number; fontFamily: string } }): void {
    this.ctx.save();
    this.ctx.fillStyle = element.style.color;
    this.ctx.font = `${element.style.fontSize}px ${element.style.fontFamily}`;
    this.ctx.textBaseline = "top";
    this.ctx.fillText(text, element.bounds.x, element.bounds.y, element.bounds.width);
    this.ctx.restore();
  }

  private clearCanvas(): void {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
    this.options.redrawBackground?.(this.ctx, this.canvas);
  }
}

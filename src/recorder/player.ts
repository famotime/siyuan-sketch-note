import type { ReplayEvent, StrokeReplayEvent, ShapeReplayEvent, ToolSwitchReplayEvent } from "./types";
import type { Stroke, StrokePoint } from "@/types/sketch";
import { getPressureWidth, getSmoothedSegments } from "@/engine/strokeSmoothing";

export type PlaybackState = "idle" | "playing" | "paused";
export type PlaybackSpeed = 1 | 2 | 4;

const CHAR_DELAY_MS = 30;
const IMAGE_FADE_MS = 200;
const TOOL_SWITCH_FADE_MS = 500;

export interface ReplayPlayerOptions {
  redrawBackground?: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void;
}

export class ReplayPlayer {
  private events: ReplayEvent[];
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private layerCanvas: HTMLCanvasElement | null;
  private layerCtx: CanvasRenderingContext2D | null;
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
  private toolSwitchProgress = 0;
  private toolSwitchLabel = "";

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
    this.layerCanvas = this.createLayerCanvas();
    this.layerCtx = this.layerCanvas?.getContext("2d") ?? null;
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
    this.toolSwitchProgress = 0;
    this.toolSwitchLabel = "";
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
    this.toolSwitchProgress = 0;
    this.toolSwitchLabel = "";

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
      this.toolSwitchProgress = 0;
      this.toolSwitchLabel = "";
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
        return this.animateToolSwitch(event);
    }
  }

  private animateStroke(event: StrokeReplayEvent | ShapeReplayEvent): boolean {
    const { stroke } = event;
    const pointsPerFrame = this.speed;
    const pts = stroke.points;

    if (this.strokeAnimIndex >= pts.length) {
      this.renderStrokeFull(stroke);
      this.presentLayer();
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
    this.presentLayer();
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
      this.presentLayer();
      return true;
    }
    if (this.textAnimIndex >= text.length) return true;

    this.textAnimTimer += 16;
    if (this.textAnimTimer < CHAR_DELAY_MS) return false;

    this.textAnimTimer = 0;
    this.textAnimIndex++;
    const partial = text.slice(0, this.textAnimIndex);

    const ctx = this.getDrawingContext();
    ctx.save();
    ctx.fillStyle = element.style.color;
    ctx.font = `${element.style.fontSize}px ${element.style.fontFamily}`;
    ctx.textBaseline = "top";
    ctx.fillText(partial, element.bounds.x, element.bounds.y, element.bounds.width);
    ctx.restore();
    this.presentLayer();

    return this.textAnimIndex >= text.length;
  }

  private animateImage(element: { src: string; bounds: { x: number; y: number; width: number; height: number }; opacity?: number }): boolean {
    this.imageAnimProgress += 16 / IMAGE_FADE_MS;
    if (this.imageAnimProgress > 1) this.imageAnimProgress = 1;

    const ctx = this.getDrawingContext();
    ctx.save();
    ctx.globalAlpha = (element.opacity ?? 1) * this.imageAnimProgress;
    ctx.fillStyle = "#f4f4f4";
    ctx.strokeStyle = "#c8c8c8";
    ctx.lineWidth = 1;
    ctx.fillRect(element.bounds.x, element.bounds.y, element.bounds.width, element.bounds.height);
    ctx.strokeRect(element.bounds.x, element.bounds.y, element.bounds.width, element.bounds.height);
    ctx.restore();
    this.presentLayer();

    return this.imageAnimProgress >= 1;
  }

  private animateToolSwitch(event: ToolSwitchReplayEvent): boolean {
    if (this.toolSwitchProgress === 0) {
      this.toolSwitchLabel = this.getToolDisplayName(event.tool);
    }
    this.toolSwitchProgress += 16 / TOOL_SWITCH_FADE_MS;
    if (this.toolSwitchProgress > 1) this.toolSwitchProgress = 1;

    const alpha = 1 - this.toolSwitchProgress;
    const ctx = this.getDrawingContext();
    const dpr = this.getCanvasScale();
    const w = this.canvas.width / dpr;
    ctx.save();
    ctx.globalAlpha = alpha * 0.85;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const textW = ctx.measureText(this.toolSwitchLabel).width + 24;
    const x = (w - textW) / 2;
    ctx.beginPath();
    ctx.roundRect(x, 8, textW, 28, 6);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(this.toolSwitchLabel, w / 2, 12);
    ctx.restore();
    this.presentLayer();

    return this.toolSwitchProgress >= 1;
  }

  private getToolDisplayName(tool: string): string {
    const names: Record<string, string> = {
      pen: "Pen",
      highlighter: "Highlighter",
      eraser: "Eraser",
      lasso: "Lasso",
      line: "Line",
      arrow: "Arrow",
      rectangle: "Rectangle",
      triangle: "Triangle",
      ellipse: "Ellipse",
      text: "Text",
      image: "Image",
    };
    return names[tool] ?? tool;
  }

  private applyErase(erasedIds: string[]): void {
    for (const id of erasedIds) this.completedStrokes.delete(id);
    this.fullRedraw();
  }

  private fullRedraw(): void {
    if (this.layerCtx) {
      this.clearLayer();
      for (const stroke of this.completedStrokes.values()) this.renderStrokeFull(stroke);
      this.presentLayer();
      return;
    }

    this.clearCanvas();
    for (const stroke of this.completedStrokes.values()) this.renderStrokeFull(stroke);
  }

  private renderEventInstant(event: ReplayEvent): void {
    switch (event.type) {
      case "stroke":
      case "shape":
        this.renderStrokeFull(event.stroke);
        this.presentLayer();
        this.completedStrokes.set(event.stroke.id, event.stroke);
        break;
      case "erase":
        this.applyErase(event.erasedIds);
        break;
      case "text":
        this.renderTextFull(event.element.text, event.element);
        this.presentLayer();
        break;
      case "image":
        {
          const ctx = this.getDrawingContext();
          ctx.save();
          ctx.globalAlpha = event.element.opacity ?? 1;
          ctx.fillStyle = "#f4f4f4";
          ctx.fillRect(event.element.bounds.x, event.element.bounds.y, event.element.bounds.width, event.element.bounds.height);
          ctx.restore();
          this.presentLayer();
        }
        break;
      case "toolSwitch":
        break;
    }
  }

  private renderStrokeFull(stroke: Stroke): void {
    const { points, color, width, tool, isShape } = stroke;
    if (points.length < 2) return;
    if (tool === "eraser" && !this.layerCtx) return;

    const ctx = this.getDrawingContext();
    ctx.save();
    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalAlpha = stroke.opacity ?? 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
    }
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const firstPressure = points[0].pressure;
    const allSame = points.every((p) => p.pressure === firstPressure);

    if (isShape) {
      ctx.lineWidth = getPressureWidth(width, firstPressure);
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.stroke();
    } else if (allSame) {
      ctx.lineWidth = getPressureWidth(width, firstPressure);
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (const segment of getSmoothedSegments(points)) {
        ctx.quadraticCurveTo(segment.control.x, segment.control.y, segment.end.x, segment.end.y);
      }
      ctx.stroke();
    } else {
      const segments = getSmoothedSegments(points);
      let currentX = points[0].x;
      let currentY = points[0].y;
      for (const segment of segments) {
        ctx.lineWidth = getPressureWidth(width, segment.control.pressure);
        ctx.beginPath();
        ctx.moveTo(currentX, currentY);
        ctx.quadraticCurveTo(segment.control.x, segment.control.y, segment.end.x, segment.end.y);
        ctx.stroke();
        currentX = segment.end.x;
        currentY = segment.end.y;
      }
    }
    ctx.restore();
  }

  private renderStrokeSegment(stroke: Stroke, prev: StrokePoint, curr: StrokePoint): void {
    if (stroke.tool === "eraser" && !this.layerCtx) return;

    const ctx = this.getDrawingContext();
    ctx.save();
    if (stroke.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalAlpha = stroke.opacity ?? 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = stroke.color;
    }
    ctx.lineWidth = getPressureWidth(stroke.width, curr.pressure);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.stroke();
    ctx.restore();
  }

  private renderTextFull(text: string, element: { bounds: { x: number; y: number; width: number }; style: { color: string; fontSize: number; fontFamily: string } }): void {
    const ctx = this.getDrawingContext();
    ctx.save();
    ctx.fillStyle = element.style.color;
    ctx.font = `${element.style.fontSize}px ${element.style.fontFamily}`;
    ctx.textBaseline = "top";
    ctx.fillText(text, element.bounds.x, element.bounds.y, element.bounds.width);
    ctx.restore();
  }

  private clearCanvas(): void {
    this.clearLayer();
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
    this.options.redrawBackground?.(this.ctx, this.canvas);
  }

  private getDrawingContext(): CanvasRenderingContext2D {
    return this.layerCtx ?? this.ctx;
  }

  private createLayerCanvas(): HTMLCanvasElement | null {
    if (typeof document === "undefined") return null;
    const layer = document.createElement("canvas");
    layer.width = this.canvas.width;
    layer.height = this.canvas.height;
    const dpr = this.getCanvasScale();
    layer.getContext("2d")?.scale(dpr, dpr);
    return layer;
  }

  private clearLayer(): void {
    if (!this.layerCtx || !this.layerCanvas) return;
    this.layerCtx.save();
    this.layerCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.layerCtx.clearRect(0, 0, this.layerCanvas.width, this.layerCanvas.height);
    this.layerCtx.restore();
  }

  private presentLayer(): void {
    if (!this.layerCanvas) return;

    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
    this.options.redrawBackground?.(this.ctx, this.canvas);

    const dpr = this.getCanvasScale();
    this.ctx.save();
    this.ctx.drawImage(this.layerCanvas, 0, 0, this.canvas.width / dpr, this.canvas.height / dpr);
    this.ctx.restore();
  }

  private getCanvasScale(): number {
    const cssWidth = Number.parseFloat(this.canvas.style.width);
    if (Number.isFinite(cssWidth) && cssWidth > 0) return this.canvas.width / cssWidth;
    if (typeof window !== "undefined" && window.devicePixelRatio) return window.devicePixelRatio;
    return 1;
  }
}

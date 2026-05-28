import type { ReplayEvent, StrokeReplayEvent, ShapeReplayEvent, ToolSwitchReplayEvent, ImageTransformReplayEvent } from "./types";
import type { Stroke, StrokePoint } from "@/types/sketch";
import type { ImageElement } from "@/elements/image";
import { getPressureWidth, getSmoothedSegments } from "@/engine/strokeSmoothing";

export type PlaybackState = "idle" | "playing" | "paused";
export type PlaybackSpeed = 1 | 2 | 4;

const CHAR_DELAY_MS = 30;
const IMAGE_FADE_MS = 200;
const IMAGE_TRANSFORM_MS = 300;
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

  // Image state tracking and caching
  private imageStates: Map<string, ImageElement> = new Map();
  private imageCache: Map<string, HTMLImageElement> = new Map();
  private imageTransformAnim: {
    elementId: string;
    op: string;
    fromBounds: { x: number; y: number; width: number; height: number };
    toBounds: { x: number; y: number; width: number; height: number };
    fromRotation: number;
    toRotation: number;
    fromOpacity: number;
    toOpacity: number;
    points: Array<{ x: number; y: number }>;
    pointIndex: number;
    progress: number;
  } | null = null;

  private imageDeleteAnim: { elementId: string; progress: number } | null = null;

  onStateChange?: (state: PlaybackState) => void;
  onProgress?: (current: number, total: number) => void;
  onComplete?: () => void;
  onToolSwitch?: (tool: string) => void;

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
      this.imageStates.clear();
    }
    this.preloadAllImages();
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
    this.imageStates.clear();
    this.imageTransformAnim = null;
    this.imageDeleteAnim = null;
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
    this.imageStates.clear();
    this.imageTransformAnim = null;
    this.imageDeleteAnim = null;
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
        return this.animateImageInsert(event.element);
      case "imageTransform":
        return this.animateImageTransform(event);
      case "imageDelete":
        return this.animateImageDeleteEvent(event.elementId);
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

  private animateImageInsert(element: ImageElement): boolean {
    if (this.imageAnimProgress === 0) {
      this.imageStates.set(element.id, element);
      this.loadImage(element.src);
    }
    this.imageAnimProgress += 16 / IMAGE_FADE_MS;
    if (this.imageAnimProgress > 1) this.imageAnimProgress = 1;

    this.drawImageWithTransform(element, this.imageAnimProgress);
    this.presentLayer();

    if (this.imageAnimProgress >= 1) {
      return true;
    }
    return false;
  }

  private animateImageTransform(event: ImageTransformReplayEvent): boolean {
    const current = this.imageStates.get(event.elementId);
    if (!current) {
      this.imageStates.set(event.elementId, event.finalElement);
      return true;
    }

    if (!this.imageTransformAnim) {
      this.imageTransformAnim = {
        elementId: event.elementId,
        op: event.op,
        fromBounds: { ...current.bounds },
        toBounds: { ...event.finalElement.bounds },
        fromRotation: current.transform?.rotation ?? 0,
        toRotation: event.finalElement.transform?.rotation ?? 0,
        fromOpacity: current.opacity ?? 1,
        toOpacity: event.finalElement.opacity ?? 1,
        points: event.points?.map((p) => ({ x: p.x, y: p.y })) ?? [],
        pointIndex: 0,
        progress: 0,
      };
    }

    const anim = this.imageTransformAnim;
    anim.progress += 16 / IMAGE_TRANSFORM_MS;
    if (anim.progress > 1) anim.progress = 1;

    const t = anim.progress;
    const lerpedElement: ImageElement = {
      ...current,
      bounds: {
        x: anim.fromBounds.x + (anim.toBounds.x - anim.fromBounds.x) * t,
        y: anim.fromBounds.y + (anim.toBounds.y - anim.fromBounds.y) * t,
        width: anim.fromBounds.width + (anim.toBounds.width - anim.fromBounds.width) * t,
        height: anim.fromBounds.height + (anim.toBounds.height - anim.fromBounds.height) * t,
      },
      opacity: anim.fromOpacity + (anim.toOpacity - anim.fromOpacity) * t,
      transform: {
        ...(current.transform ?? { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }),
        rotation: anim.fromRotation + (anim.toRotation - anim.fromRotation) * t,
      },
    };

    this.drawImageWithTransform(lerpedElement, 1);
    this.presentLayer();

    if (anim.progress >= 1) {
      this.imageStates.set(event.elementId, event.finalElement);
      this.imageTransformAnim = null;
      return true;
    }
    return false;
  }

  private animateImageDeleteEvent(elementId: string): boolean {
    const element = this.imageStates.get(elementId);
    if (!element) return true;

    if (!this.imageDeleteAnim) {
      this.imageDeleteAnim = { elementId, progress: 0 };
    }

    this.imageDeleteAnim.progress += 16 / IMAGE_FADE_MS;
    if (this.imageDeleteAnim.progress > 1) this.imageDeleteAnim.progress = 1;

    this.drawImageWithTransform(element, 1 - this.imageDeleteAnim.progress);
    this.presentLayer();

    if (this.imageDeleteAnim.progress >= 1) {
      this.imageStates.delete(elementId);
      this.imageDeleteAnim = null;
      return true;
    }
    return false;
  }

  private animateToolSwitch(event: ToolSwitchReplayEvent): boolean {
    if (this.toolSwitchProgress === 0) {
      this.onToolSwitch?.(event.tool);
    }
    this.toolSwitchProgress += 16 / TOOL_SWITCH_FADE_MS;
    if (this.toolSwitchProgress > 1) this.toolSwitchProgress = 1;
    return this.toolSwitchProgress >= 1;
  }

  private preloadAllImages(): void {
    for (const event of this.events) {
      if (event.type === "image") {
        this.loadImage(event.element.src);
      } else if (event.type === "imageTransform") {
        this.loadImage(event.finalElement.src);
      }
    }
  }

  private loadImage(src: string): void {
    if (this.imageCache.has(src)) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    this.imageCache.set(src, img);
  }

  private drawImageWithTransform(element: ImageElement, alpha: number): void {
    const img = this.imageCache.get(element.src);
    const ctx = this.getDrawingContext();
    const cx = element.bounds.x + element.bounds.width / 2;
    const cy = element.bounds.y + element.bounds.height / 2;
    const rotation = element.transform?.rotation ?? 0;

    ctx.save();
    ctx.globalAlpha = (element.opacity ?? 1) * alpha;

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.translate(cx, cy);
      if (rotation) ctx.rotate(rotation);
      ctx.drawImage(
        img,
        -element.bounds.width / 2,
        -element.bounds.height / 2,
        element.bounds.width,
        element.bounds.height,
      );
    } else {
      ctx.fillStyle = "#f4f4f4";
      ctx.strokeStyle = "#c8c8c8";
      ctx.lineWidth = 1;
      ctx.translate(cx, cy);
      if (rotation) ctx.rotate(rotation);
      ctx.fillRect(-element.bounds.width / 2, -element.bounds.height / 2, element.bounds.width, element.bounds.height);
      ctx.strokeRect(-element.bounds.width / 2, -element.bounds.height / 2, element.bounds.width, element.bounds.height);
    }
    ctx.restore();
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
      for (const element of this.imageStates.values()) this.drawImageWithTransform(element, 1);
      this.presentLayer();
      return;
    }

    this.clearCanvas();
    for (const stroke of this.completedStrokes.values()) this.renderStrokeFull(stroke);
    for (const element of this.imageStates.values()) this.drawImageWithTransform(element, 1);
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
        this.imageStates.set(event.element.id, event.element);
        this.loadImage(event.element.src);
        this.drawImageWithTransform(event.element, 1);
        this.presentLayer();
        break;
      case "imageTransform":
        this.imageStates.set(event.elementId, event.finalElement);
        this.loadImage(event.finalElement.src);
        this.drawImageWithTransform(event.finalElement, 1);
        this.presentLayer();
        break;
      case "imageDelete":
        this.imageStates.delete(event.elementId);
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

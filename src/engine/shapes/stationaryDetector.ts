import type { StrokePoint } from "@/types/sketch";

export interface StationaryDetectorOptions {
  holdTimeMs: number;       // 停顿触发时间 (默认 400ms)
  maxMoveTolerance: number; // 停顿位移容差 (默认 12px)
  maxSpeed: number;         // 停顿最大允许瞬时速度 (像素/毫秒，默认 0.05)
}

export const DEFAULT_STATIONARY_OPTIONS: StationaryDetectorOptions = {
  holdTimeMs: 400,
  maxMoveTolerance: 12,
  maxSpeed: 0.05,
};

/**
 * 笔末停顿检测器 (Stationary Detector)
 * 监控手写笔在运笔末端的停留静止状态，用于触发 Hold-to-Shape（停顿几何图形识别与规整）。
 */
export class StationaryDetector {
  private timer: number | null = null;
  private anchorPoint: StrokePoint | null = null;
  private lastPoint: StrokePoint | null = null;
  private isTriggered = false;

  constructor(
    private options: StationaryDetectorOptions = DEFAULT_STATIONARY_OPTIONS,
    private onStationary: (lastPoint: StrokePoint) => void = () => {},
  ) {}

  setOptions(options: Partial<StationaryDetectorOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * 运笔移动时更新点位
   */
  update(point: StrokePoint): void {
    if (this.isTriggered) return;

    const now = point.timestamp || performance.now();

    if (!this.anchorPoint) {
      this.anchorPoint = point;
      this.lastPoint = point;
      this.startTimer(point);
      return;
    }

    const distFromAnchor = Math.hypot(point.x - this.anchorPoint.x, point.y - this.anchorPoint.y);

    // 计算与上一帧的速度
    const dt = this.lastPoint ? Math.max(1, now - this.lastPoint.timestamp) : 16;
    const stepDist = this.lastPoint ? Math.hypot(point.x - this.lastPoint.x, point.y - this.lastPoint.y) : 0;
    const speed = stepDist / dt;

    this.lastPoint = point;

    // 如果超出了位移容差或速度过快，重置锚点与计时器
    if (distFromAnchor > this.options.maxMoveTolerance || speed > this.options.maxSpeed) {
      this.anchorPoint = point;
      this.startTimer(point);
    }
  }

  private startTimer(point: StrokePoint): void {
    this.cancelTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      this.isTriggered = true;
      this.onStationary(point);
    }, this.options.holdTimeMs) as unknown as number;
  }

  cancelTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * 重置状态（落笔或抬笔时调用）
   */
  reset(): void {
    this.cancelTimer();
    this.anchorPoint = null;
    this.lastPoint = null;
    this.isTriggered = false;
  }

  getTriggered(): boolean {
    return this.isTriggered;
  }
}

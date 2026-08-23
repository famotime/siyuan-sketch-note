/**
 * 压感指数移动平均 (EMA) 低通滤波器
 * 用于滤除触控笔硬件在快速运笔或微小压力变化时的瞬时阶跃噪声，
 * 产生平滑、自然的笔画线条粗细过渡与笔锋感。
 */
export class PressureFilter {
  private smoothedPressure: number | null = null;
  private alpha: number;

  /**
   * @param alpha 平滑系数 (0 < alpha <= 1)。值越小越平滑抗抖，值越大响应越灵敏。默认 0.35
   */
  constructor(alpha: number = 0.35) {
    this.alpha = Math.max(0.01, Math.min(1.0, alpha));
  }

  /**
   * 过滤输入压感并返回平滑后的压感值 (0.0 ~ 1.0)
   */
  filter(rawPressure: number): number {
    const clamped = Math.max(0, Math.min(1, Number.isFinite(rawPressure) ? rawPressure : 0.5));
    if (this.smoothedPressure === null) {
      this.smoothedPressure = clamped;
      return clamped;
    }
    this.smoothedPressure = this.smoothedPressure + this.alpha * (clamped - this.smoothedPressure);
    return this.smoothedPressure;
  }

  /**
   * 获取当前平滑压感值
   */
  getCurrent(): number {
    return this.smoothedPressure ?? 0.5;
  }

  /**
   * 重置滤波器状态（落笔或抬笔时调用）
   */
  reset(): void {
    this.smoothedPressure = null;
  }
}

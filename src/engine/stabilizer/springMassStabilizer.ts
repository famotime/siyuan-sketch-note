import type { StrokePoint } from "@/types/sketch";

export interface StabilizerOptions {
  mass: number;                // 质点质量 (0.1 ~ 2.0)
  springConstant: number;      // 弹性系数 (10 ~ 500)
  frictionCoefficient: number; // 摩擦阻尼系数 (0.0 ~ 2.0)
  maxPointDist: number;        // 最大细分步长 (1 ~ 50px)
  inertiaFraction: number;     // 惯性比例 (0.0 ~ 1.0)
  velocityDecayFactor: number; // 速度衰减 (0.0 ~ 1.0)
  minSimilarityToFinalize: number; // 收笔对齐阈值
}

export type StabilizerMode = "none" | "smooth" | "calligraphy" | "custom";

export const DEFAULT_STABILIZER_OPTIONS: Record<StabilizerMode, StabilizerOptions> = {
  none: {
    mass: 0.1,
    springConstant: 500,
    frictionCoefficient: 0.0,
    maxPointDist: 100,
    inertiaFraction: 0.0,
    velocityDecayFactor: 0.0,
    minSimilarityToFinalize: 0.0,
  },
  smooth: {
    mass: 0.35,
    springConstant: 130.0,
    frictionCoefficient: 0.28,
    maxPointDist: 8.0,
    inertiaFraction: 0.72,
    velocityDecayFactor: 0.1,
    minSimilarityToFinalize: 0.0,
  },
  calligraphy: {
    mass: 0.65,
    springConstant: 95.0,
    frictionCoefficient: 0.35,
    maxPointDist: 6.0,
    inertiaFraction: 0.85,
    velocityDecayFactor: 0.12,
    minSimilarityToFinalize: -0.2,
  },
  custom: {
    mass: 0.4,
    springConstant: 120.0,
    frictionCoefficient: 0.3,
    maxPointDist: 8.0,
    inertiaFraction: 0.75,
    velocityDecayFactor: 0.1,
    minSimilarityToFinalize: 0.0,
  },
};

/**
 * 物理弹簧-质量-阻尼输入稳定器 (Spring-Mass-Damper Stabilizer)
 *
 * 核心算法推导：
 * 1. 将笔尖真实坐标视为目标吸引源 P_target；
 * 2. 将实际渲染笔画点视为拥有质量 m 的虚拟质点 P_stroke；
 * 3. 弹簧力 F_spring = k * (P_target - P_stroke)；
 * 4. 摩擦阻尼力 F_friction = -mu * m * g * (v / |v|)；
 * 5. 加速度 a = (F_spring + F_friction) / m；
 * 6. 速度更新 v = v * (1 - decay) + a * dt，结合惯性比例插值；
 * 7. 自适应时间步细分 (Sub-stepping) 杜绝大跨度折线。
 */
export class SpringMassStabilizer {
  private strokePoint: { x: number; y: number };
  private targetPoint: { x: number; y: number };
  private velocity = { x: 0, y: 0 };
  private lastTime = 0;
  private currentPressure = 0.5;
  private targetPressure = 0.5;

  constructor(
    startPoint: { x: number; y: number; pressure?: number },
    private options: StabilizerOptions = DEFAULT_STABILIZER_OPTIONS.smooth,
    startTime: number = performance.now(),
  ) {
    this.strokePoint = { x: startPoint.x, y: startPoint.y };
    this.targetPoint = { x: startPoint.x, y: startPoint.y };
    this.lastTime = startTime;
    this.currentPressure = startPoint.pressure ?? 0.5;
    this.targetPressure = startPoint.pressure ?? 0.5;
  }

  setOptions(options: StabilizerOptions): void {
    this.options = { ...options };
  }

  getOptions(): StabilizerOptions {
    return { ...this.options };
  }

  /**
   * 更新真实目标点
   */
  setTarget(point: { x: number; y: number; pressure?: number }): void {
    this.targetPoint = { x: point.x, y: point.y };
    if (typeof point.pressure === "number") {
      this.targetPressure = point.pressure;
    }
  }

  getCurrentStrokePoint(): { x: number; y: number; pressure: number } {
    return {
      x: this.strokePoint.x,
      y: this.strokePoint.y,
      pressure: this.currentPressure,
    };
  }

  /**
   * 物理时间步进更新，返回本次步进生成的细分点序列
   */
  step(nowTime: number): StrokePoint[] {
    const deltaTimeMs = Math.min(32, Math.max(1, nowTime - this.lastTime));
    this.lastTime = nowTime;

    const dx = this.targetPoint.x - this.strokePoint.x;
    const dy = this.targetPoint.y - this.strokePoint.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 0.001) {
      return [];
    }

    // 自适应时间步细分 (Sub-stepping)
    const maxDist = Math.max(1, this.options.maxPointDist);
    const parts = Math.min(10, Math.max(1, Math.ceil(dist / maxDist)));
    const subDt = (deltaTimeMs / parts) / 1000;

    const generated: StrokePoint[] = [];

    for (let i = 0; i < parts; i++) {
      const curDx = this.targetPoint.x - this.strokePoint.x;
      const curDy = this.targetPoint.y - this.strokePoint.y;
      const curDist = Math.hypot(curDx, curDy);

      // 弹簧拉力
      const fSpringX = curDx * this.options.springConstant;
      const fSpringY = curDy * this.options.springConstant;

      // 动摩擦力
      const vLen = Math.hypot(this.velocity.x, this.velocity.y);
      const normalForce = this.options.mass * 9.8;
      const fFrictionX = vLen > 0.0001 ? -(this.velocity.x / vLen) * this.options.frictionCoefficient * normalForce : 0;
      const fFrictionY = vLen > 0.0001 ? -(this.velocity.y / vLen) * this.options.frictionCoefficient * normalForce : 0;

      // 牛顿第二定律加速度
      const ax = (fSpringX + fFrictionX) / Math.max(0.01, this.options.mass);
      const ay = (fSpringY + fFrictionY) / Math.max(0.01, this.options.mass);

      // 弹簧速度
      const springVx = this.velocity.x * (1 - this.options.velocityDecayFactor) + ax * subDt;
      const springVy = this.velocity.y * (1 - this.options.velocityDecayFactor) + ay * subDt;
      const springSpeed = Math.hypot(springVx, springVy);

      // 目标方向速度
      const targetDirX = curDist > 0.0001 ? (curDx / curDist) * springSpeed : 0;
      const targetDirY = curDist > 0.0001 ? (curDy / curDist) * springSpeed : 0;

      // 惯性混合速度
      const inertia = Math.max(0, Math.min(1, this.options.inertiaFraction));
      this.velocity.x = targetDirX * (1 - inertia) + springVx * inertia;
      this.velocity.y = targetDirY * (1 - inertia) + springVy * inertia;

      // 质点位移
      this.strokePoint.x += this.velocity.x * subDt;
      this.strokePoint.y += this.velocity.y * subDt;

      // 压感同步插值
      this.currentPressure += (this.targetPressure - this.currentPressure) * (1 / parts);

      generated.push({
        x: this.strokePoint.x,
        y: this.strokePoint.y,
        pressure: this.currentPressure,
        timestamp: nowTime,
      });
    }

    return generated;
  }

  /**
   * 抬笔完成笔画：判断收尾相似度并对齐终点
   */
  finish(nowTime: number = performance.now()): StrokePoint[] {
    const toTargetX = this.targetPoint.x - this.strokePoint.x;
    const toTargetY = this.targetPoint.y - this.strokePoint.y;
    const dist = Math.hypot(toTargetX, toTargetY);

    const extra: StrokePoint[] = [];

    // 若接近终点或速度朝向终点，则对齐至真实落点
    const dot = this.velocity.x * toTargetX + this.velocity.y * toTargetY;
    if (dist < 12 || dot > this.options.minSimilarityToFinalize) {
      this.strokePoint.x = this.targetPoint.x;
      this.strokePoint.y = this.targetPoint.y;
      this.currentPressure = this.targetPressure;
      extra.push({
        x: this.strokePoint.x,
        y: this.strokePoint.y,
        pressure: this.currentPressure,
        timestamp: nowTime,
      });
    }

    return extra;
  }
}

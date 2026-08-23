import type { StrokePoint } from "@/types/sketch";

export interface StabilizerOptions {
  mass: number; // 质点质量 (0.1 ~ 2.0)
  springConstant: number; // 弹性系数 (10 ~ 500)
  frictionCoefficient: number; // 摩擦阻尼系数 (0.0 ~ 2.0)
  maxPointDist: number; // 最大细分步长 (1 ~ 50px)
  inertiaFraction: number; // 惯性比例 (0.0 ~ 1.0)
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
    mass: 0.28,
    springConstant: 160.0,
    frictionCoefficient: 0.22,
    maxPointDist: 8.0,
    inertiaFraction: 0.65,
    velocityDecayFactor: 0.08,
    minSimilarityToFinalize: 0.0,
  },
  calligraphy: {
    mass: 0.48,
    springConstant: 120.0,
    frictionCoefficient: 0.28,
    maxPointDist: 6.0,
    inertiaFraction: 0.76,
    velocityDecayFactor: 0.10,
    minSimilarityToFinalize: -0.2,
  },
  custom: {
    mass: 0.32,
    springConstant: 150.0,
    frictionCoefficient: 0.24,
    maxPointDist: 8.0,
    inertiaFraction: 0.68,
    velocityDecayFactor: 0.08,
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

      // 速度/距离自适应响应因子 (0 < adaptiveRatio <= 1.0)
      // 当距离较小 (微移慢写，curDist < 3px) 时保持 100% 平滑抗抖惯性；
      // 当快速划动 (curDist 增大到 10px 以上) 时，平滑降低惯性与有效质量，大幅增强弹簧响应拉力以贴合笔尖
      const adaptiveRatio = curDist <= 3
        ? 1.0
        : Math.max(0.08, 1 / (1 + ((curDist - 3) / 10.0) ** 1.6));

      const effectiveSpringK = this.options.springConstant * (1.0 + (1.0 - adaptiveRatio) * 2.5);
      const effectiveMass = Math.max(0.01, this.options.mass * (0.25 + 0.75 * adaptiveRatio));
      const effectiveFriction = this.options.frictionCoefficient * (0.3 + 0.7 * adaptiveRatio);
      const effectiveInertia = Math.max(0, Math.min(1, this.options.inertiaFraction * adaptiveRatio));
      const effectiveDecay = this.options.velocityDecayFactor * adaptiveRatio;

      // 弹簧拉力
      const fSpringX = curDx * effectiveSpringK;
      const fSpringY = curDy * effectiveSpringK;

      // 动摩擦力
      const vLen = Math.hypot(this.velocity.x, this.velocity.y);
      const normalForce = effectiveMass * 9.8;
      const fFrictionX = vLen > 0.0001 ? -(this.velocity.x / vLen) * effectiveFriction * normalForce : 0;
      const fFrictionY = vLen > 0.0001 ? -(this.velocity.y / vLen) * effectiveFriction * normalForce : 0;

      // 牛顿第二定律加速度
      const ax = (fSpringX + fFrictionX) / effectiveMass;
      const ay = (fSpringY + fFrictionY) / effectiveMass;

      // 弹簧速度
      const springVx = this.velocity.x * (1 - effectiveDecay) + ax * subDt;
      const springVy = this.velocity.y * (1 - effectiveDecay) + ay * subDt;
      const springSpeed = Math.hypot(springVx, springVy);

      // 目标方向速度
      const targetDirX = curDist > 0.0001 ? (curDx / curDist) * springSpeed : 0;
      const targetDirY = curDist > 0.0001 ? (curDy / curDist) * springSpeed : 0;

      // 惯性混合速度
      this.velocity.x = targetDirX * (1 - effectiveInertia) + springVx * effectiveInertia;
      this.velocity.y = targetDirY * (1 - effectiveInertia) + springVy * effectiveInertia;

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

import type { StrokePoint } from "@/types/sketch";

export type RecognizedShapeType = "line" | "rectangle" | "ellipse" | "triangle" | "arrow";

export interface RecognizedShape {
  type: RecognizedShapeType;
  confidence: number;
  points: StrokePoint[];
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function makePoint(x: number, y: number, pressure: number = 0.5, timestamp: number = Date.now()): StrokePoint {
  return { x, y, pressure, timestamp };
}

/**
 * 生成正规化几何点序列
 */
export function generateLinePoints(start: StrokePoint, end: StrokePoint): StrokePoint[] {
  return [
    makePoint(start.x, start.y, start.pressure),
    makePoint(end.x, end.y, end.pressure),
  ];
}

export function generateRectanglePoints(start: StrokePoint, end: StrokePoint): StrokePoint[] {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  const p = (start.pressure + end.pressure) / 2;

  return [
    makePoint(minX, minY, p),
    makePoint(maxX, minY, p),
    makePoint(maxX, maxY, p),
    makePoint(minX, maxY, p),
    makePoint(minX, minY, p),
  ];
}

export function generateTrianglePoints(start: StrokePoint, end: StrokePoint): StrokePoint[] {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  const p = (start.pressure + end.pressure) / 2;

  return [
    makePoint((minX + maxX) / 2, minY, p),
    makePoint(maxX, maxY, p),
    makePoint(minX, maxY, p),
    makePoint((minX + maxX) / 2, minY, p),
  ];
}

export function generateEllipsePoints(start: StrokePoint, end: StrokePoint, segments = 36): StrokePoint[] {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  const rx = (maxX - minX) / 2;
  const ry = (maxY - minY) / 2;
  const cx = minX + rx;
  const cy = minY + ry;
  const p = (start.pressure + end.pressure) / 2;

  const points: StrokePoint[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(makePoint(cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry, p));
  }
  return points;
}

export function generateArrowPoints(start: StrokePoint, end: StrokePoint): StrokePoint[] {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const len = Math.hypot(end.x - start.x, end.y - start.y);
  const headLen = Math.max(12, Math.min(28, len * 0.25));
  const wingAngle = Math.PI / 7;
  const p = (start.pressure + end.pressure) / 2;

  const leftX = end.x - Math.cos(angle - wingAngle) * headLen;
  const leftY = end.y - Math.sin(angle - wingAngle) * headLen;
  const rightX = end.x - Math.cos(angle + wingAngle) * headLen;
  const rightY = end.y - Math.sin(angle + wingAngle) * headLen;

  return [
    makePoint(start.x, start.y, p),
    makePoint(end.x, end.y, p),
    makePoint(leftX, leftY, p),
    makePoint(end.x, end.y, p),
    makePoint(rightX, rightY, p),
    makePoint(end.x, end.y, p),
  ];
}

/**
 * 道格拉斯-普克 (Ramer-Douglas-Peucker) 曲线折线化算法
 */
export function douglasPeucker(points: StrokePoint[], epsilon: number): StrokePoint[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let index = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], start, end);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, index + 1), epsilon);
    const right = douglasPeucker(points.slice(index), epsilon);
    return left.slice(0, left.length - 1).concat(right);
  } else {
    return [start, end];
  }
}

function perpendicularDistance(point: StrokePoint, lineStart: StrokePoint, lineEnd: StrokePoint): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distance(point, lineStart);

  const t = Math.max(0, Math.min(1, ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lenSq));
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;
  return Math.hypot(point.x - projX, point.y - projY);
}

/**
 * 智能手绘形状识别器
 */
export function recognizeDrawnShape(points: StrokePoint[]): RecognizedShape | null {
  if (points.length < 5) return null;

  const start = points[0];
  const end = points[points.length - 1];
  const totalLength = points.reduce((acc, pt, i) => i === 0 ? 0 : acc + distance(points[i - 1], pt), 0);
  const chordLength = distance(start, end);

  // 计算外接包围盒
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const boxWidth = maxX - minX;
  const boxHeight = maxY - minY;
  const diag = Math.hypot(boxWidth, boxHeight);

  if (diag < 10) return null;

  // 1. 直线判定：弦长与总路径长度比接近 1
  if (chordLength / totalLength > 0.88) {
    const linePoints = generateLinePoints(start, end);
    return {
      type: "line",
      confidence: chordLength / totalLength,
      points: linePoints,
    };
  }

  // 2. 闭合判定：首尾距离小于包围盒对角线的 25%
  const isClosed = chordLength < diag * 0.25;

  if (isClosed) {
    // 简化折线提取角点
    const simplified = douglasPeucker(points, diag * 0.07);
    const cornerCount = simplified.length - 1;

    // 2.1 三角形判定 (3 个主要顶点)
    if (cornerCount === 3) {
      const triPoints = generateTrianglePoints(
        makePoint(minX, minY, start.pressure),
        makePoint(maxX, maxY, end.pressure),
      );
      return {
        type: "triangle",
        confidence: 0.85,
        points: triPoints,
      };
    }

    // 2.2 矩形判定 (4 个主要顶点)
    if (cornerCount === 4) {
      const rectPoints = generateRectanglePoints(
        makePoint(minX, minY, start.pressure),
        makePoint(maxX, maxY, end.pressure),
      );
      return {
        type: "rectangle",
        confidence: 0.85,
        points: rectPoints,
      };
    }

    // 2.3 椭圆 / 圆形判定 (圆心与半径方差低)
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const radii = points.map((p) => Math.hypot(p.x - centerX, p.y - centerY));
    const avgRadius = radii.reduce((a, b) => a + b, 0) / radii.length;
    const variance = radii.reduce((acc, r) => acc + Math.pow(r - avgRadius, 2), 0) / radii.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev / avgRadius < 0.35) {
      const ellipsePoints = generateEllipsePoints(
        makePoint(minX, minY, start.pressure),
        makePoint(maxX, maxY, end.pressure),
      );
      return {
        type: "ellipse",
        confidence: Math.max(0.7, 1 - stdDev / avgRadius),
        points: ellipsePoints,
      };
    }
  }

  // 3. 严格单向箭头判定：必须满足主干近似直线且末端存在明显回折翼翅
  if (!isClosed && points.length >= 8) {
    const mainLength = Math.floor(points.length * 0.8);
    const mainPoints = points.slice(0, mainLength);
    const mainStart = mainPoints[0];
    const mainEnd = mainPoints[mainPoints.length - 1];
    const mainTotalLen = mainPoints.reduce((acc, pt, i) => i === 0 ? 0 : acc + distance(mainPoints[i - 1], pt), 0);
    const mainChordLen = distance(mainStart, mainEnd);

    // 主干自身必须高度接近直线 (弦长比 > 0.88)
    if (mainChordLen / Math.max(1, mainTotalLen) > 0.88 && mainChordLen > 24) {
      const tipPoint = points[points.length - 1];
      const wingDist = distance(mainEnd, tipPoint);

      // 翅膀长度应为适中比例 (主干长度的 10% ~ 35%)
      if (wingDist > 8 && wingDist < mainChordLen * 0.4) {
        // 主干向量与翅膀折回向量夹角必须形成锐角折角
        const mainDx = mainEnd.x - mainStart.x;
        const mainDy = mainEnd.y - mainStart.y;
        const wingDx = tipPoint.x - mainEnd.x;
        const wingDy = tipPoint.y - mainEnd.y;
        const dot = (mainDx * wingDx + mainDy * wingDy) / (Math.hypot(mainDx, mainDy) * Math.hypot(wingDx, wingDy));

        // 夹角余弦为负 (说明朝向反方向折回，形成类似矢状结构)
        if (dot < -0.3) {
          const arrowPoints = generateArrowPoints(mainStart, mainEnd);
          return {
            type: "arrow",
            confidence: 0.88,
            points: arrowPoints,
          };
        }
      }
    }
  }

  return null;
}

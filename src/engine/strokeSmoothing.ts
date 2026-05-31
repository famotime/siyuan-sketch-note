import type { StrokePoint } from "@/types/sketch";
import type { PenSubtype, HighlighterSubtype } from "@/types/sketch";

export interface SmoothedSegment {
  control: StrokePoint;
  end: Pick<StrokePoint, "x" | "y">;
}

function distance(a: StrokePoint, b: StrokePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function filterStrokePointsByDistance(
  points: StrokePoint[],
  minDistance: number,
): StrokePoint[] {
  if (points.length <= 2) return points;

  const filtered: StrokePoint[] = [points[0]];
  let lastKept = points[0];

  for (let i = 1; i < points.length - 1; i++) {
    if (distance(lastKept, points[i]) >= minDistance) {
      filtered.push(points[i]);
      lastKept = points[i];
    }
  }

  const last = points[points.length - 1];
  if (filtered[filtered.length - 1] !== last) {
    filtered.push(last);
  }

  return filtered;
}

export function getSmoothedSegments(points: StrokePoint[]): SmoothedSegment[] {
  if (points.length < 2) return [];
  if (points.length === 2) {
    return [{
      control: points[0],
      end: points[1],
    }];
  }

  const segments: SmoothedSegment[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    segments.push({
      control: current,
      end: {
        x: (current.x + next.x) / 2,
        y: (current.y + next.y) / 2,
      },
    });
  }

  segments.push({
    control: points[points.length - 1],
    end: points[points.length - 1],
  });

  return segments;
}

export function getPressureWidth(baseWidth: number, pressure: number): number {
  const normalizedPressure = Math.min(1, Math.max(0, Number.isFinite(pressure) ? pressure : 0.5));
  const scale = 0.5 + normalizedPressure;
  return baseWidth * scale;
}

function sigmoid(t: number): number {
  return 1 / (1 + Math.exp(-10 * (t - 0.5)));
}

export function getPenSubtypePressureWidth(
  baseWidth: number,
  pressure: number,
  penSubtype: PenSubtype | undefined,
): number {
  const p = Math.min(1, Math.max(0, Number.isFinite(pressure) ? pressure : 0.5));
  let multiplier: number;
  switch (penSubtype) {
    case "pencil":
      multiplier = 0.7 + p * 0.5;
      break;
    case "fountain":
      multiplier = 0.5 + sigmoid(p) * 1.5;
      break;
    case "brush":
      multiplier = 0.3 + sigmoid(p) * 2.2;
      break;
    case "ballpoint":
    default:
      multiplier = 0.9 + p * 0.2;
      break;
  }
  return baseWidth * multiplier;
}

export function getPenSubtypeOpacityMultiplier(
  pressure: number,
  penSubtype: PenSubtype | undefined,
): number {
  const p = Math.min(1, Math.max(0, Number.isFinite(pressure) ? pressure : 0.5));
  switch (penSubtype) {
    case "pencil":
      return 0.8 + p * 0.2;
    case "brush":
      return 0.85 + p * 0.15;
    case "fountain":
      return 0.9 + p * 0.1;
    case "ballpoint":
    default:
      return 1;
  }
}

export function getHighlighterSubtypeLineCap(
  subtype: HighlighterSubtype | undefined,
): CanvasLineCap {
  return subtype === "square" ? "butt" : "round";
}

export function getSquareHighlighterWidthMultiplier(
  angle: number,
): number {
  const absAngle = Math.abs(angle);
  const normalized = absAngle / (Math.PI / 2);
  return 0.4 + (1 - normalized) * 0.6;
}

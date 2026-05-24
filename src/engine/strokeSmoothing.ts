import type { StrokePoint } from "@/types/sketch";

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

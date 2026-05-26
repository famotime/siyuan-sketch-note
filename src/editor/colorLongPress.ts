export interface PointerPoint {
  x: number;
  y: number;
}

export const COLOR_LONG_PRESS_CANCEL_DISTANCE = 10;

export function shouldCancelColorLongPress(
  start: PointerPoint,
  current: PointerPoint,
  threshold = COLOR_LONG_PRESS_CANCEL_DISTANCE,
): boolean {
  return Math.hypot(current.x - start.x, current.y - start.y) > threshold;
}

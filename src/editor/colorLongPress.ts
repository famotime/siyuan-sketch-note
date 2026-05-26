export interface PointerPoint {
  x: number;
  y: number;
}

export interface ColorLongPressState {
  didLongPressDelete: boolean;
}

export const COLOR_LONG_PRESS_CANCEL_DISTANCE = 10;

export function createColorLongPressState(): ColorLongPressState {
  return {
    didLongPressDelete: false,
  };
}

export function shouldCancelColorLongPress(
  start: PointerPoint,
  current: PointerPoint,
  threshold = COLOR_LONG_PRESS_CANCEL_DISTANCE,
): boolean {
  return Math.hypot(current.x - start.x, current.y - start.y) > threshold;
}

export function shouldSwallowColorClick(state: ColorLongPressState): boolean {
  if (!state.didLongPressDelete) return false;
  state.didLongPressDelete = false;
  return true;
}

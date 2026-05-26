import { describe, expect, it } from 'vitest';
import { createColorLongPressState, shouldCancelColorLongPress, shouldSwallowColorClick } from './colorLongPress';

describe('floating toolbar color long press', () => {
  it('keeps the delete timer alive for small finger jitter', () => {
    expect(shouldCancelColorLongPress({ x: 100, y: 100 }, { x: 105, y: 106 })).toBe(false);
  });

  it('cancels the delete timer when the user scrolls or drags away', () => {
    expect(shouldCancelColorLongPress({ x: 100, y: 100 }, { x: 112, y: 100 })).toBe(true);
    expect(shouldCancelColorLongPress({ x: 100, y: 100 }, { x: 100, y: 113 })).toBe(true);
  });

  it('swallows the synthetic click after a long-press delete', () => {
    const state = createColorLongPressState();
    state.didLongPressDelete = true;

    expect(shouldSwallowColorClick(state)).toBe(true);
    expect(state.didLongPressDelete).toBe(false);
    expect(shouldSwallowColorClick(state)).toBe(false);
  });
});

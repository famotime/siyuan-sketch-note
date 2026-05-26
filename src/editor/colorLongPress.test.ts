import { describe, expect, it } from 'vitest';
import { shouldCancelColorLongPress } from './colorLongPress';

describe('floating toolbar color long press', () => {
  it('keeps the delete timer alive for small finger jitter', () => {
    expect(shouldCancelColorLongPress({ x: 100, y: 100 }, { x: 105, y: 106 })).toBe(false);
  });

  it('cancels the delete timer when the user scrolls or drags away', () => {
    expect(shouldCancelColorLongPress({ x: 100, y: 100 }, { x: 112, y: 100 })).toBe(true);
    expect(shouldCancelColorLongPress({ x: 100, y: 100 }, { x: 100, y: 113 })).toBe(true);
  });
});

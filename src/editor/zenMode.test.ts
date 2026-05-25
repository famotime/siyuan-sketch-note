import { describe, expect, it } from 'vitest';
import { clampZenTogglePosition, createZenToggleState } from './zenMode';

describe('zen mode model', () => {
  it('describes the toolbar button for entering and leaving distraction-free writing', () => {
    expect(createZenToggleState(false)).toEqual({
      ariaLabelKey: 'enterZenMode',
      icon: 'Lock',
      isPressed: false,
      titleKey: 'enterZenMode',
    });

    expect(createZenToggleState(true)).toEqual({
      ariaLabelKey: 'exitZenMode',
      icon: 'Unlock',
      isPressed: true,
      titleKey: 'exitZenMode',
    });
  });

  it('keeps the floating zen toggle fully inside the editor bounds', () => {
    expect(clampZenTogglePosition({ left: -20, top: 4 }, { width: 320, height: 240, size: 52, margin: 10 })).toEqual({
      left: 10,
      top: 10,
    });
    expect(clampZenTogglePosition({ left: 400, top: 300 }, { width: 320, height: 240, size: 52, margin: 10 })).toEqual({
      left: 258,
      top: 178,
    });
  });
});

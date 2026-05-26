import { describe, expect, it } from 'vitest';
import { clampSpectrumPoint, hexToHsv, hsvToHex } from './colorPickerModel';

describe('color picker model', () => {
  it('converts between hex colors and hsv values for inline spectrum picking', () => {
    expect(hexToHsv('#ff0000')).toEqual({ hue: 0, saturation: 100, value: 100 });
    expect(hexToHsv('#00ff00')).toEqual({ hue: 120, saturation: 100, value: 100 });
    expect(hexToHsv('#336699')).toEqual({ hue: 210, saturation: 67, value: 60 });

    expect(hsvToHex({ hue: 210, saturation: 67, value: 60 })).toBe('#326699');
    expect(hsvToHex({ hue: 360, saturation: 100, value: 100 })).toBe('#ff0000');
  });

  it('maps pointer coordinates to clamped saturation and value percentages', () => {
    expect(clampSpectrumPoint({ x: 50, y: 25 }, { width: 200, height: 100 })).toEqual({
      saturation: 25,
      value: 75,
    });
    expect(clampSpectrumPoint({ x: -10, y: 130 }, { width: 200, height: 100 })).toEqual({
      saturation: 0,
      value: 0,
    });
    expect(clampSpectrumPoint({ x: 260, y: -30 }, { width: 200, height: 100 })).toEqual({
      saturation: 100,
      value: 100,
    });
  });
});

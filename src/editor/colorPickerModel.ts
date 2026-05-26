export interface HsvColor {
  hue: number;
  saturation: number;
  value: number;
}

export interface SpectrumPoint {
  x: number;
  y: number;
}

export interface SpectrumSize {
  height: number;
  width: number;
}

export interface SpectrumSelection {
  saturation: number;
  value: number;
}

export function hexToHsv(hex: string): HsvColor {
  const normalized = normalizeHex(hex);
  const red = Number.parseInt(normalized.slice(1, 3), 16) / 255;
  const green = Number.parseInt(normalized.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(normalized.slice(5, 7), 16) / 255;

  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === red) {
      hue = 60 * (((green - blue) / delta) % 6);
    } else if (max === green) {
      hue = 60 * ((blue - red) / delta + 2);
    } else {
      hue = 60 * ((red - green) / delta + 4);
    }
  }

  if (hue < 0) hue += 360;

  return {
    hue: Math.round(hue),
    saturation: max === 0 ? 0 : Math.round((delta / max) * 100),
    value: Math.round(max * 100),
  };
}

export function hsvToHex(color: HsvColor): string {
  const hue = (((color.hue % 360) + 360) % 360) / 60;
  const saturation = clampPercent(color.saturation) / 100;
  const value = clampPercent(color.value) / 100;
  const chroma = value * saturation;
  const x = chroma * (1 - Math.abs((hue % 2) - 1));
  const match = value - chroma;

  let red = 0;
  let green = 0;
  let blue = 0;

  if (hue >= 0 && hue < 1) {
    red = chroma;
    green = x;
  } else if (hue >= 1 && hue < 2) {
    red = x;
    green = chroma;
  } else if (hue >= 2 && hue < 3) {
    green = chroma;
    blue = x;
  } else if (hue >= 3 && hue < 4) {
    green = x;
    blue = chroma;
  } else if (hue >= 4 && hue < 5) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  return `#${toHexByte(red + match)}${toHexByte(green + match)}${toHexByte(blue + match)}`;
}

export function clampSpectrumPoint(point: SpectrumPoint, size: SpectrumSize): SpectrumSelection {
  const width = Math.max(1, size.width);
  const height = Math.max(1, size.height);
  const x = Math.min(Math.max(point.x, 0), width);
  const y = Math.min(Math.max(point.y, 0), height);

  return {
    saturation: Math.round((x / width) * 100),
    value: Math.round((1 - y / height) * 100),
  };
}

function normalizeHex(hex: string): string {
  const value = hex.trim();
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toLowerCase();
  }
  return '#000000';
}

function clampPercent(value: number): number {
  return Math.min(Math.max(value, 0), 100);
}

function toHexByte(value: number): string {
  return Math.round(value * 255).toString(16).padStart(2, '0');
}

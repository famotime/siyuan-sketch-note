import { PRESET_COLORS } from "@/types/sketch";

export const MAX_RECENT_COLORS = 10;

function normalizeHexColor(color: string): string | null {
  const trimmed = color.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(trimmed) ? trimmed : null;
}

export function normalizeRecentColors(input?: readonly string[]): string[] {
  const seen = new Set<string>();
  const colors = [...(input ?? []), ...PRESET_COLORS]
    .map(normalizeHexColor)
    .filter((color): color is string => Boolean(color))
    .filter((color) => {
      if (seen.has(color)) return false;
      seen.add(color);
      return true;
    });

  return colors.slice(0, MAX_RECENT_COLORS);
}

export function addRecentColor(input: readonly string[], color: string): string[] {
  const normalized = normalizeHexColor(color);
  if (!normalized) return normalizeRecentColors(input);
  return normalizeRecentColors([
    normalized,
    ...input.filter((item) => normalizeHexColor(item) !== normalized),
  ]);
}

export function appendRecentColor(input: readonly string[], color: string): string[] {
  const normalized = normalizeHexColor(color);
  if (!normalized) return [...input];
  // 滤除重复颜色，保证不重复
  const filtered = input.filter((item) => normalizeHexColor(item) !== normalized);
  // 新颜色追加在末尾（后端）
  const result = [...filtered, normalized];
  // 若超出最大限制，则从首部（最旧的颜色）截断，推动现有颜色往前滚
  if (result.length > MAX_RECENT_COLORS) {
    return result.slice(result.length - MAX_RECENT_COLORS);
  }
  return result;
}

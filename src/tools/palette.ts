import { HIGHLIGHTER_PRESET_COLORS, PRESET_COLORS } from "@/types/sketch";

export const MAX_RECENT_COLORS = 10;
export const FAVORITE_COLOR_SLOTS = 7;

export interface ToolColorPalettes {
  pen: string[];
  highlighter: string[];
}

export interface ToolFavoriteColors {
  pen: (string | null)[];
  highlighter: (string | null)[];
}

function normalizeHexColor(color: string): string | null {
  const trimmed = color.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(trimmed) ? trimmed : null;
}

function normalizeColorPalette(input: readonly string[] | undefined, defaults: readonly string[]): string[] {
  const seen = new Set<string>();
  const colors = [...(input ?? []), ...defaults]
    .map(normalizeHexColor)
    .filter((color): color is string => Boolean(color))
    .filter((color) => {
      if (seen.has(color)) return false;
      seen.add(color);
      return true;
    });

  return colors.slice(0, MAX_RECENT_COLORS);
}

export function normalizeRecentColors(input?: readonly string[]): string[] {
  return normalizeColorPalette(input, PRESET_COLORS);
}

export function normalizeHighlighterRecentColors(input?: readonly string[]): string[] {
  return normalizeColorPalette(input, HIGHLIGHTER_PRESET_COLORS);
}

export function normalizeToolColorPalettes(input?: Partial<ToolColorPalettes>): ToolColorPalettes {
  return {
    pen: normalizeRecentColors(input?.pen),
    highlighter: normalizeHighlighterRecentColors(input?.highlighter),
  };
}

export function normalizeFavoriteColors(input?: readonly (string | null | undefined)[]): (string | null)[] {
  return Array.from({ length: FAVORITE_COLOR_SLOTS }, (_, index) => {
    const color = input?.[index];
    return typeof color === "string" ? normalizeHexColor(color) : null;
  });
}

export function normalizeToolFavoriteColors(input?: Partial<ToolFavoriteColors>): ToolFavoriteColors {
  return {
    pen: normalizeFavoriteColors(input?.pen),
    highlighter: normalizeFavoriteColors(input?.highlighter),
  };
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

export function setFavoriteColorAt(input: readonly (string | null)[], index: number, color: string): (string | null)[] {
  const normalized = normalizeHexColor(color);
  const next = normalizeFavoriteColors(input);
  if (!normalized || index < 0 || index >= FAVORITE_COLOR_SLOTS) return next;

  next[index] = normalized;
  return next;
}

export function deleteFavoriteColorAt(input: readonly (string | null)[], index: number): (string | null)[] {
  const next = normalizeFavoriteColors(input);
  if (index < 0 || index >= FAVORITE_COLOR_SLOTS) return next;
  next[index] = null;
  return next;
}

export function appendToolColor(
  palettes: ToolColorPalettes,
  tool: keyof ToolColorPalettes,
  color: string,
): ToolColorPalettes {
  return {
    ...palettes,
    [tool]: appendRecentColor(palettes[tool], color),
  };
}

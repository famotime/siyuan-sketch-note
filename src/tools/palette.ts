import { PRESET_COLORS } from "@/types/sketch";

export const MAX_RECENT_COLORS = 6;

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

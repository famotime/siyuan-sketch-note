import { ref, nextTick, onMounted, onUnmounted, watch } from "vue";
import type { Ref } from "vue";
import { createLogger } from "@/utils/logger";

export function parseCssColor(color: string): [number, number, number] | null {
  const rgbMatch = color.match(/rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/i);
  if (rgbMatch) {
    return [
      clampColorChannel(Number(rgbMatch[1])),
      clampColorChannel(Number(rgbMatch[2])),
      clampColorChannel(Number(rgbMatch[3])),
    ];
  }
  const hexMatch = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!hexMatch) return null;
  const hex = hexMatch[1];
  if (hex.length === 3) {
    return [
      Number.parseInt(`${hex[0]}${hex[0]}`, 16),
      Number.parseInt(`${hex[1]}${hex[1]}`, 16),
      Number.parseInt(`${hex[2]}${hex[2]}`, 16),
    ];
  }
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

export function getColorLuminance([redChannel, greenChannel, blueChannel]: [number, number, number]): number {
  const [red, green, blue] = [redChannel, greenChannel, blueChannel].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function clampColorChannel(value: number): number {
  return Math.max(0, Math.min(255, value));
}

export function resolveThemeModeFromColor(color: string): 'light' | 'dark' | null {
  if (!color || color === "transparent" || color === "rgba(0, 0, 0, 0)") return null;
  const rgb = parseCssColor(color);
  if (!rgb) return null;
  const luminance = getColorLuminance(rgb);
  return luminance < 0.5 ? 'dark' : 'light';
}

export function useThemeDetection(ctx: {
  editorRootRef: Ref<HTMLDivElement | undefined>;
  themeMode: Ref<'light' | 'dark'>;
}) {
  const effectiveThemeMode = ref<'light' | 'dark'>(ctx.themeMode.value);
  let themeProbeTimer: ReturnType<typeof setInterval> | null = null;
  let lastEditorThemeDiagnosticKey = "";
  const logger = createLogger(["Theme", "Editor"]);

  function resolveEditorBackgroundThemeMode(): 'light' | 'dark' | null {
    if (!ctx.editorRootRef.value) return null;
    return resolveThemeModeFromColor(getComputedStyle(ctx.editorRootRef.value).backgroundColor);
  }

  function syncEffectiveThemeMode() {
    const resolved = resolveEditorBackgroundThemeMode();
    effectiveThemeMode.value = resolved ?? ctx.themeMode.value;
    nextTick(logEditorThemeDiagnostics);
  }

  function logEditorThemeDiagnostics() {
    if (!ctx.editorRootRef.value) return;
    const style = getComputedStyle(ctx.editorRootRef.value);
    const diagnostics = {
      propThemeMode: ctx.themeMode.value,
      effectiveThemeMode: effectiveThemeMode.value,
      className: ctx.editorRootRef.value.className,
      toolbarSurface: style.getPropertyValue("--sketch-toolbar-surface").trim(),
      toolbarText: style.getPropertyValue("--sketch-toolbar-text").trim(),
      toolbarBorder: style.getPropertyValue("--sketch-toolbar-border").trim(),
      toolbarHoverBg: style.getPropertyValue("--sketch-toolbar-hover-bg").trim(),
      background: style.backgroundColor,
    };
    const key = JSON.stringify(diagnostics);
    if (key === lastEditorThemeDiagnosticKey) return;
    lastEditorThemeDiagnosticKey = key;
    logger.info(diagnostics);
  }

  onMounted(() => {
    syncEffectiveThemeMode();
    themeProbeTimer = setInterval(syncEffectiveThemeMode, 250);
    nextTick(logEditorThemeDiagnostics);
  });

  onUnmounted(() => {
    if (themeProbeTimer) clearInterval(themeProbeTimer);
  });

  watch(
    () => ctx.themeMode.value,
    () => {
      effectiveThemeMode.value = ctx.themeMode.value;
      syncEffectiveThemeMode();
      nextTick(logEditorThemeDiagnostics);
    },
  );

  return { effectiveThemeMode, syncEffectiveThemeMode };
}

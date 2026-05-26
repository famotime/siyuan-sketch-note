<template>
  <SketchEditor
    v-if="editorVisible"
    :blockId="editorBlockId"
    :initialData="editorData"
    :i18n="pluginI18n"
    :saveData="pluginSaveData"
    :themeMode="themeMode"
    @close="closeEditor"
  />
</template>

<script lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from "vue";
import { showMessage } from "siyuan";
import { loadSketchData } from "@/storage";
import { normalizeEditorI18n } from "@/i18n/editorI18n";
import SketchEditor from "@/editor/SketchEditor.vue";

const editorVisible = ref(false);
const editorBlockId = ref("");
const editorData = ref<any>(null);
const pluginI18n = ref<Record<string, string>>({});
const pluginSaveData = ref<(key: string, data: any) => Promise<void>>(async () => {});
const themeMode = ref<"light" | "dark">(resolveSiyuanThemeMode());
let themeObserver: MutationObserver | null = null;
let themeSyncTimer: number | null = null;
let lastThemeDiagnosticKey = "";

let loadDataFn: (key: string) => Promise<any> = async () => null;

function parseThemeMode(value: unknown): "light" | "dark" | null {
  if (value === 0 || value === "0" || value === "light") return "light";
  if (value === 1 || value === "1" || value === "dark") return "dark";
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase();
  if (normalized.includes("light")) return "light";
  if (normalized.includes("dark")) return "dark";
  return null;
}

function resolveDocumentThemeMode(): "light" | "dark" | null {
  const signals = [
    document.documentElement.className,
    document.body.className,
    document.documentElement.getAttribute("data-theme"),
    document.documentElement.getAttribute("data-theme-mode"),
    document.body.getAttribute("data-theme"),
    document.body.getAttribute("data-theme-mode"),
  ].map(parseThemeMode);
  return signals.includes("dark")
    ? "dark"
    : signals.includes("light")
      ? "light"
      : null;
}

function resolveCssVariableThemeMode(): "light" | "dark" | null {
  const background = getComputedStyle(document.body).getPropertyValue("--b3-theme-background")
    || getComputedStyle(document.documentElement).getPropertyValue("--b3-theme-background");
  const luminance = getColorLuminance(background.trim());
  if (luminance === null) return null;
  return luminance < 0.5 ? "dark" : "light";
}

function resolveComputedBackgroundThemeMode(): "light" | "dark" | null {
  const bodyBackground = getComputedStyle(document.body).backgroundColor;
  const bodyMode = resolveThemeModeFromColor(bodyBackground);
  if (bodyMode) return bodyMode;
  const htmlBackground = getComputedStyle(document.documentElement).backgroundColor;
  return resolveThemeModeFromColor(htmlBackground);
}

function resolveThemeModeFromColor(color: string): "light" | "dark" | null {
  if (!color || color === "transparent" || color === "rgba(0, 0, 0, 0)") return null;
  const luminance = getColorLuminance(color);
  if (luminance === null) return null;
  return luminance < 0.5 ? "dark" : "light";
}

function getColorLuminance(color: string): number | null {
  const rgb = parseCssColor(color);
  if (!rgb) return null;
  const [red, green, blue] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function parseCssColor(color: string): [number, number, number] | null {
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

function clampColorChannel(value: number): number {
  return Math.max(0, Math.min(255, value));
}

function collectThemeDiagnostics() {
  const siyuanMode = (globalThis as any).window?.siyuan?.config?.appearance?.mode
    ?? (globalThis as any).siyuan?.config?.appearance?.mode;
  const matchMediaLight = window.matchMedia?.("(prefers-color-scheme: light)").matches ?? null;
  const bodyBackgroundColor = getComputedStyle(document.body).backgroundColor;
  const htmlBackgroundColor = getComputedStyle(document.documentElement).backgroundColor;
  const cssBackground = getComputedStyle(document.body).getPropertyValue("--b3-theme-background")
    || getComputedStyle(document.documentElement).getPropertyValue("--b3-theme-background");

  return {
    htmlClass: document.documentElement.className,
    bodyClass: document.body.className,
    htmlTheme: document.documentElement.getAttribute("data-theme"),
    htmlThemeMode: document.documentElement.getAttribute("data-theme-mode"),
    bodyTheme: document.body.getAttribute("data-theme"),
    bodyThemeMode: document.body.getAttribute("data-theme-mode"),
    siyuanMode,
    bodyBackgroundColor,
    htmlBackgroundColor,
    computedBackgroundMode: resolveComputedBackgroundThemeMode(),
    cssBackground: cssBackground.trim(),
    cssMode: resolveCssVariableThemeMode(),
    documentMode: resolveDocumentThemeMode(),
    configMode: resolveSiyuanConfigThemeMode(),
    matchMediaLight,
  };
}

function resolveSiyuanConfigThemeMode(): "light" | "dark" | null {
  const mode = (globalThis as any).window?.siyuan?.config?.appearance?.mode
    ?? (globalThis as any).siyuan?.config?.appearance?.mode;
  return parseThemeMode(mode);
}

function resolveSiyuanThemeMode(): "light" | "dark" {
  const computedBackgroundMode = resolveComputedBackgroundThemeMode();
  if (computedBackgroundMode) return computedBackgroundMode;
  const cssVariableMode = resolveCssVariableThemeMode();
  if (cssVariableMode) return cssVariableMode;
  const liveDocumentMode = resolveDocumentThemeMode();
  if (liveDocumentMode) return liveDocumentMode;
  const configMode = resolveSiyuanConfigThemeMode();
  if (configMode) return configMode;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function syncThemeMode() {
  const nextThemeMode = resolveSiyuanThemeMode();
  themeMode.value = nextThemeMode;
  logThemeDiagnostics(nextThemeMode);
}

function logThemeDiagnostics(resolvedMode: "light" | "dark") {
  const diagnostics = {
    ...collectThemeDiagnostics(),
    resolvedMode,
  };
  const key = JSON.stringify(diagnostics);
  if (key === lastThemeDiagnosticKey) return;
  lastThemeDiagnosticKey = key;
  console.info("[Sketch Note][Theme]", diagnostics);
}

onMounted(() => {
  syncThemeMode();
  themeObserver = new MutationObserver(syncThemeMode);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-theme-mode", "class"] });
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ["data-theme", "data-theme-mode", "class"] });
  window.matchMedia?.("(prefers-color-scheme: light)").addEventListener?.("change", syncThemeMode);
  themeSyncTimer = window.setInterval(syncThemeMode, 500);
});

onUnmounted(() => {
  themeObserver?.disconnect();
  themeObserver = null;
  window.matchMedia?.("(prefers-color-scheme: light)").removeEventListener?.("change", syncThemeMode);
  if (themeSyncTimer !== null) {
    window.clearInterval(themeSyncTimer);
    themeSyncTimer = null;
  }
});

export function setI18n(i18n: Record<string, string>) {
  pluginI18n.value = normalizeEditorI18n(i18n);
}

export function setSaveDataFn(fn: (key: string, data: any) => Promise<void>) {
  pluginSaveData.value = fn;
}

export function setLoadDataFn(fn: (key: string) => Promise<any>) {
  loadDataFn = fn;
}

export async function openSketchEditor(blockId: string) {
  editorBlockId.value = blockId;
  try {
    editorData.value = await loadSketchData(loadDataFn, blockId);
  } catch (e) {
    console.error("[Sketch Note] Failed to load sketch data:", e);
    showMessage(`Sketch Note: ${pluginI18n.value.loadFailed || "Data load failed"}`, 5000, "error");
    editorData.value = null;
  }
  editorVisible.value = true;
}

function closeEditor() {
  const savedBlockId = editorBlockId.value;
  editorVisible.value = false;
  editorBlockId.value = "";
  editorData.value = null;

  // Refresh the sketch-note image in the document to show updated content
  refreshSketchImage(savedBlockId);
}

/**
 * Force-refresh the displayed image for a sketch block.
 * Uses nextTick + setTimeout to wait for Vue DOM update, then
 * force-fetches to bust HTTP cache and updates both data-src and src.
 */
function refreshSketchImage(blockId: string) {
  const pattern = `sketch-note-${blockId}.png`;

  // Wait for Vue DOM update (editor overlay removal) to complete
  nextTick(() => {
    setTimeout(() => {
      const imgs = document.querySelectorAll("img");
      let found = false;
      imgs.forEach((img) => {
        const dataSrc = img.getAttribute("data-src") || "";
        if (dataSrc.includes(pattern)) {
          found = true;
          const baseSrc = dataSrc.split("?")[0];
          const bustSrc = `${baseSrc}?t=${Date.now()}`;

          // Force browser HTTP cache refresh (like excalidraw approach)
          fetch(baseSrc, { cache: "reload" }).then(() => {
            img.setAttribute("data-src", bustSrc);
            img.src = bustSrc;
          }).catch(() => {
            // Still update src even if fetch fails
            img.setAttribute("data-src", bustSrc);
            img.src = bustSrc;
          });
        }
      });
      if (!found) {
        console.warn(`[Sketch Note] refreshSketchImage: no img found for pattern "${pattern}"`);
      }
    }, 100);
  });
}

export default {
  components: { SketchEditor },
  setup() {
    return {
      editorVisible,
      editorBlockId,
      editorData,
      pluginI18n,
      pluginSaveData,
      themeMode,
      closeEditor,
    };
  },
};
</script>

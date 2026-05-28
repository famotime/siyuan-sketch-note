<template>
  <SketchEditor
    v-if="editorVisible"
    :blockId="editorBlockId"
    :initialData="editorData"
    :i18n="pluginI18n"
    :saveData="pluginSaveData"
    :themeMode="themeMode"
    :replayRecordConfig="replayRecordConfig"
    :hideReplayControls="hideReplayControls"
    @close="closeEditor"
  />
</template>

<script lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from "vue";
import { showMessage } from "siyuan";
import { loadSketchData } from "@/storage";
import { normalizeEditorI18n } from "@/i18n/editorI18n";
import SketchEditor from "@/editor/SketchEditor.vue";
import { parseCssColor, getColorLuminance as getLuminance, resolveThemeModeFromColor as resolveColorTheme } from "@/composables/useThemeDetection";
import { createLogger } from "@/utils/logger";
import type { ReplayRecorderConfig } from "@/recorder/types";
import { DEFAULT_RECORDER_CONFIG } from "@/recorder/types";

const editorVisible = ref(false);
const editorBlockId = ref("");
const editorData = ref<any>(null);
const pluginI18n = ref<Record<string, string>>({});
const pluginSaveData = ref<(key: string, data: any) => Promise<void>>(async () => {});
const themeMode = ref<"light" | "dark">(resolveSiyuanThemeMode());
const replayRecordConfig = ref<ReplayRecorderConfig>({ ...DEFAULT_RECORDER_CONFIG });
const hideReplayControls = ref(false);
let themeObserver: MutationObserver | null = null;
let themeSyncTimer: number | null = null;
let lastThemeDiagnosticKey = "";
const themeLogger = createLogger("Theme");

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
  const rgb = parseCssColor(background.trim());
  if (!rgb) return null;
  const luminance = getLuminance(rgb);
  return luminance < 0.5 ? "dark" : "light";
}

function resolveComputedBackgroundThemeMode(): "light" | "dark" | null {
  const bodyBackground = getComputedStyle(document.body).backgroundColor;
  const bodyMode = resolveColorTheme(bodyBackground);
  if (bodyMode) return bodyMode;
  const htmlBackground = getComputedStyle(document.documentElement).backgroundColor;
  return resolveColorTheme(htmlBackground);
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
  themeLogger.info(diagnostics);
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

export function setReplayRecordConfig(config?: Partial<ReplayRecorderConfig>) {
  replayRecordConfig.value = { ...DEFAULT_RECORDER_CONFIG, ...config };
}

export function setHideReplayControls(value: boolean) {
  hideReplayControls.value = value;
}

export async function openSketchEditor(blockId: string) {
  editorBlockId.value = blockId;
  try {
    editorData.value = await loadSketchData(loadDataFn, blockId);
  } catch (e) {
    createLogger().error("Failed to load sketch data:", e);
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
        createLogger().warn(`refreshSketchImage: no img found for pattern "${pattern}"`);
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
      replayRecordConfig,
      hideReplayControls,
      closeEditor,
    };
  },
};
</script>

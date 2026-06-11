<template>
  <div class="sketch-editor__row sketch-editor__row--topbar">
    <button
      class="sketch-btn sketch-btn--back"
      :title="t('back')"
      :aria-label="t('back')"
      @click="$emit('back')"
    >
      <IconParkIcon name="ArrowLeft" />
    </button>
    <span
      v-if="recovered"
      class="sketch-recovery"
    >{{ t("dataRecovered") }}</span>

    <button
      v-if="!hiddenTopbarKeys.has('undo')"
      class="sketch-btn sketch-btn--action"
      :disabled="!canUndo"
      :title="t('undo')"
      @click="$emit('undo')"
    >
      <IconParkIcon name="Undo" />
    </button>
    <button
      v-if="!hiddenTopbarKeys.has('redo')"
      class="sketch-btn sketch-btn--action"
      :disabled="!canRedo"
      :title="t('redo')"
      @click="$emit('redo')"
    >
      <IconParkIcon name="Redo" />
    </button>
    <button
      v-if="showReplay && !hiddenTopbarKeys.has('replay')"
      class="sketch-btn sketch-btn--action"
      :title="t('replay')"
      @click="$emit('replay')"
    >
      <IconParkIcon name="Play" />
    </button>
    <span class="sketch-spacer" />
    <span class="sketch-sep" />
    <button
      v-if="!hiddenTopbarKeys.has('insertImage')"
      class="sketch-btn sketch-btn--add-image"
      :title="t('image')"
      :aria-label="t('image')"
      data-replay-target="topbar-image"
      @click="$emit('insertImage')"
    >
      <IconParkIcon name="Plus" />
    </button>
    <button
      v-if="!hiddenTopbarKeys.has('zenMode')"
      class="sketch-btn sketch-btn--zen"
      :aria-label="t(zenToggleState.ariaLabelKey)"
      :aria-pressed="zenToggleState.isPressed"
      :title="t(zenToggleState.titleKey)"
      @click="$emit('toggleZenMode')"
    >
      <IconParkIcon :name="zenToggleState.icon" />
    </button>
    <div
      v-if="!hiddenTopbarKeys.has('moreMenu')"
      ref="moreWrapRef"
      class="sketch-more-wrap"
    >
      <button
        class="sketch-btn sketch-btn--more"
        :class="{ 'sketch-btn--more-on': moreOpen }"
        :title="t('more')"
        @click="moreOpen = !moreOpen"
      >
        <IconParkIcon name="MoreFour" />
      </button>
      <div
        v-if="moreOpen"
        class="sketch-more-popover"
      >
        <div
          class="sketch-more-row sketch-more-row--action"
          @click="$emit('clear'); moreOpen = false"
        >
          <span class="sketch-more-label">{{ t("clear") }}</span>
          <IconParkIcon name="Clear" />
        </div>
        <div
          class="sketch-more-row sketch-more-row--action"
          @click="openExportDialog"
        >
          <span class="sketch-more-label">{{ t("export") }}</span>
          <IconParkIcon name="ArrowRight" />
        </div>
        <div
          class="sketch-more-row sketch-more-row--action"
          @click="$emit('importSketch'); moreOpen = false"
        >
          <span class="sketch-more-label">{{ t("importSketch") }}</span>
          <IconParkIcon name="Download" />
        </div>
        <div
          class="sketch-more-row sketch-more-row--action"
          @click="onCleanupInvalidSketchesClick"
        >
          <span class="sketch-more-label">{{ t("cleanupInvalidSketches") }}</span>
          <IconParkIcon name="Delete" />
        </div>
        <div
          v-if="liveMode !== 'off'"
          class="sketch-more-row sketch-more-row--action"
          @click="$emit('liveDisconnect'); moreOpen = false"
        >
          <span class="sketch-more-label">{{ t("liveDisconnect") }}</span>
          <IconParkIcon name="SmartOptimization" />
        </div>
        <div
          v-else-if="liveAvailable"
          class="sketch-more-row sketch-more-row--action"
          @click="$emit('liveStart'); moreOpen = false"
        >
          <span class="sketch-more-label">{{ liveStartLabel ?? t("liveStartViewer") }}</span>
          <IconParkIcon name="SmartOptimization" />
        </div>
        <div class="sketch-more-divider" />
        <label class="sketch-more-row sketch-more-row--select">
          <span class="sketch-more-label">{{ t("noteBackground") }}</span>
          <select
            class="sketch-select sketch-select--menu"
            :value="templateId"
            @change="$emit('update:templateId', ($event.target as HTMLSelectElement).value)"
          >
            <option
              v-for="tpl in templates"
              :key="tpl.id"
              :value="tpl.id"
            >
              {{ t(tpl.nameKey) }}
            </option>
          </select>
        </label>
        <label
          v-if="backgroundFit"
          class="sketch-more-row sketch-more-row--select"
        >
          <span class="sketch-more-label">{{ t("backgroundFit") }}</span>
          <select
            class="sketch-select sketch-select--menu"
            :value="backgroundFit"
            @change="$emit('backgroundFitChange', ($event.target as HTMLSelectElement).value)"
          >
            <option value="cover">{{ t("backgroundFitCover") }}</option>
            <option value="contain">{{ t("backgroundFitContain") }}</option>
            <option value="stretch">{{ t("backgroundFitStretch") }}</option>
          </select>
        </label>
        <label class="sketch-more-row">
          <span class="sketch-more-label">{{ t("stylusOnly") }}</span>
          <span
            class="sketch-toggle"
            :class="{ 'sketch-toggle--on': stylusOnly }"
            @click="$emit('toggleStylusOnly')"
          >
            <span class="sketch-toggle__knob" />
          </span>
        </label>
        <label class="sketch-more-row">
          <span class="sketch-more-label">{{ t("enablePressure") }}</span>
          <span
            class="sketch-toggle"
            :class="{ 'sketch-toggle--on': enablePressure }"
            @click="$emit('togglePressure')"
          >
            <span class="sketch-toggle__knob" />
          </span>
        </label>
      </div>
    </div>
    <Teleport to="body">
      <div
        v-if="exportDialogOpen"
        class="sketch-export-dialog"
        :class="{
          'sketch-export-dialog--theme-light': themeMode === 'light',
          'sketch-export-dialog--theme-dark': themeMode === 'dark',
        }"
        role="dialog"
        aria-modal="true"
        :aria-label="t('export')"
        @click.self="closeExportDialog"
      >
        <div class="sketch-export-dialog__panel">
          <div class="sketch-export-dialog__header">
            <strong class="sketch-export-dialog__title">{{ t("export") }}</strong>
            <button
              class="sketch-export-dialog__close"
              type="button"
              :aria-label="t('cancel')"
              @click="closeExportDialog"
            >
              ×
            </button>
          </div>
          <div class="sketch-export-dialog__section">
            <span class="sketch-export-dialog__label">{{ t("exportFormat") }}</span>
            <div class="sketch-export-format">
              <label
                class="sketch-export-format__option"
                :class="{ 'sketch-export-format__option--active': exportFormat === 'png' }"
                >
                <IconParkIcon name="AddPic" />
                <input
                  v-model="exportFormat"
                  type="radio"
                  value="png"
                >
                <span>PNG</span>
              </label>
              <label
                class="sketch-export-format__option"
                :class="{ 'sketch-export-format__option--active': exportFormat === 'pdf' }"
                >
                <IconParkIcon name="BookOpen" />
                <input
                  v-model="exportFormat"
                  type="radio"
                  value="pdf"
                >
                <span>PDF</span>
              </label>
            </div>
          </div>
          <label class="sketch-export-dialog__row">
            <span class="sketch-export-dialog__label">{{ t("exportBackground") }}</span>
            <span
              class="sketch-toggle"
              :class="{ 'sketch-toggle--on': exportIncludeBackground }"
              @click="$emit('toggleExportBackground')"
            >
              <span class="sketch-toggle__knob" />
            </span>
          </label>
          <label class="sketch-export-dialog__row">
            <span class="sketch-export-dialog__label">{{ t("exportSketchData") }}</span>
            <span
              class="sketch-toggle"
              :class="{ 'sketch-toggle--on': exportIncludeSketchData }"
              @click="$emit('toggleExportSketchData')"
            >
              <span class="sketch-toggle__knob" />
            </span>
          </label>
          <div class="sketch-export-dialog__actions">
            <button
              class="sketch-export-dialog__button sketch-export-dialog__button--ghost"
              type="button"
              @click="closeExportDialog"
            >
              {{ t("cancel") }}
            </button>
            <button
              class="sketch-export-dialog__button sketch-export-dialog__button--primary"
              type="button"
              @click="confirmExport"
            >
              {{ t("confirm") }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import type { PageOverviewItem } from "@/pages/model";
import type { Template } from "@/template";
import { createLogger } from "@/utils/logger";
import IconParkIcon from "./IconParkIcon.vue";
import { createZenToggleState } from "./zenMode";

defineProps<{
  backgroundFit?: string;
  canRedo: boolean;
  canUndo: boolean;
  exportIncludeBackground: boolean;
  exportIncludeSketchData: boolean;
  hiddenTopbarKeys: Set<string>;
  ocrState: "idle" | "recognizing" | "completed" | "error";
  pageOverview: PageOverviewItem[];
  pageState: { current: number; total: number };
  recovered: boolean;
  searchResultCount: number;
  showReplay: boolean;
  stylusOnly: boolean;
  enablePressure: boolean;
  templateId: string;
  themeMode: 'light' | 'dark';
  templates: Template[];
  t: (key: string) => string;
  liveMode?: "off" | "writer" | "viewer";
  liveAvailable?: boolean;
  liveStartLabel?: string;
}>();

const emit = defineEmits<{
  (e: "back"): void;
  (e: "backgroundFitChange", value: string): void;
  (e: "clear"): void;
  (e: "export", format: "png" | "pdf"): void;
  (e: "replay"): void;
  (e: "insertImage"): void;
  (e: "importSketch"): void;
  (e: "cleanup-invalid-sketches"): void;
  (e: "toggleStylusOnly"): void;
  (e: "togglePressure"): void;
  (e: "toggleExportBackground"): void;
  (e: "toggleExportSketchData"): void;
  (e: "toggleZenMode"): void;
  (e: "undo"): void;
  (e: "redo"): void;
  (e: "update:templateId", value: string): void;
  (e: "liveStart"): void;
  (e: "liveDisconnect"): void;
}>();

const zenToggleState = computed(() => createZenToggleState(false));

const moreOpen = ref(false);
const exportDialogOpen = ref(false);
const exportFormat = ref<"png" | "pdf">("png");
const moreWrapRef = ref<HTMLDivElement>();
const logger = createLogger(["EditorTopBar", "Cleanup"]);

function openExportDialog() {
  moreOpen.value = false;
  exportDialogOpen.value = true;
}

function closeExportDialog() {
  exportDialogOpen.value = false;
}

function confirmExport() {
  emit("export", exportFormat.value);
  closeExportDialog();
}

function onCleanupInvalidSketchesClick() {
  logger.info("cleanup menu item clicked");
  emit("cleanup-invalid-sketches");
  moreOpen.value = false;
}

function onDocClick(e: MouseEvent) {
  if (moreOpen.value && moreWrapRef.value && !moreWrapRef.value.contains(e.target as Node)) {
    moreOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener("mousedown", onDocClick);
  document.addEventListener("pointerdown", onCanvasPointerDown as EventListener);
});
onUnmounted(() => {
  document.removeEventListener("mousedown", onDocClick);
  document.removeEventListener("pointerdown", onCanvasPointerDown as EventListener);
});

function onCanvasPointerDown(e: PointerEvent) {
  if (!moreOpen.value) return;
  const canvas = (e.target as HTMLElement)?.closest?.("canvas");
  if (canvas) moreOpen.value = false;
}
</script>

<style scoped>
.sketch-editor__row {
  --sketch-more-popover-surface: var(--b3-menu-background, var(--sketch-toolbar-popover-surface));
  --sketch-more-option-surface: var(--b3-theme-surface, var(--sketch-more-popover-surface));
  --sketch-more-option-text: var(--b3-theme-on-surface, var(--sketch-toolbar-strong-text));
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  width: 100%;
}

/* ── 统一的悬浮顶栏按钮 ── */
.sketch-btn {
  background: var(--sketch-toolbar-control-bg) !important;
  border: 1px solid var(--sketch-toolbar-control-border) !important;
  color: var(--sketch-toolbar-text) !important;
  border-radius: 8px;
  padding: 4px 10px;
  cursor: pointer;
  font-size: 13px;
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
  user-select: none;
  box-sizing: border-box;
}
.sketch-btn:hover {
  background: var(--sketch-toolbar-hover-bg) !important;
  border-color: var(--sketch-toolbar-hover-border) !important;
  color: var(--sketch-toolbar-strong-text) !important;
  transform: scale(1.03);
}
.sketch-btn:active {
  transform: scale(0.96);
}

@keyframes sketch-replay-click {
  0% { transform: scale(1); }
  40% { transform: scale(0.85); }
  100% { transform: scale(1); }
}

.sketch-btn--replay-click {
  animation: sketch-replay-click 250ms cubic-bezier(0.25, 0.8, 0.25, 1);
}

.sketch-btn--back {
  background: var(--sketch-toolbar-control-border) !important;
  border-color: var(--sketch-toolbar-border) !important;
  font-weight: 500;
}

.sketch-btn--zen {
  min-width: 30px;
  width: 30px;
  padding: 4px 0;
}

.sketch-btn--add-image {
  min-width: 30px;
  width: 30px;
  padding: 4px 0;
  font-size: 15px;
}

/* ── 下拉选择菜单 ── */
.sketch-select {
  color-scheme: light dark;
  background: var(--sketch-toolbar-control-bg) !important;
  border: 1px solid var(--sketch-toolbar-control-border) !important;
  color: var(--sketch-toolbar-text) !important;
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 13px;
  min-height: 30px;
  outline: none;
  cursor: pointer;
  transition: all 0.2s ease;
  box-sizing: border-box;
}
.sketch-select:hover {
  background: var(--sketch-toolbar-border) !important;
  border-color: var(--sketch-toolbar-hover-border) !important;
  color: var(--sketch-toolbar-strong-text) !important;
}
.sketch-select option {
  background-color: var(--sketch-more-option-surface);
  color: var(--sketch-more-option-text);
}
.sketch-select--menu option {
  background-color: var(--sketch-more-option-surface);
  color: var(--sketch-more-option-text);
}

/* 恢复损坏提示 */
.sketch-recovery {
  color: #f39c12;
  font-size: 11px;
  white-space: nowrap;
  font-weight: 500;
  text-shadow: 0 0 4px rgba(243, 156, 18, 0.2);
}

.sketch-sep {
  width: 1px;
  height: 20px;
  background: var(--sketch-toolbar-border);
  margin: 0 4px;
  flex-shrink: 0;
}

.sketch-spacer {
  flex: 1;
}

/* ── 更多按钮 ── */
.sketch-more-wrap {
  position: relative;
}
.sketch-btn--more {
  background: var(--sketch-toolbar-control-bg) !important;
  border-color: var(--sketch-toolbar-separator) !important;
  padding: 3px 8px;
}
.sketch-btn--more :deep(.sketch-icon) {
  font-size: 16px;
}
.sketch-btn--more-on {
  background: var(--sketch-toolbar-hover-border) !important;
  border-color: var(--b3-theme-primary) !important;
  color: var(--sketch-toolbar-strong-text) !important;
}

/* ── 更多弹出菜单 ── */
.sketch-more-popover {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 180px;
  background-color: var(--sketch-more-popover-surface);
  backdrop-filter: blur(14px) saturate(160%);
  -webkit-backdrop-filter: blur(14px) saturate(160%);
  border: 1px solid var(--sketch-toolbar-border);
  border-radius: 12px;
  padding: 6px 0;
  box-shadow: var(--sketch-toolbar-shadow);
  z-index: 1100;
  animation: sketch-pop-in 0.15s ease-out;
}
@keyframes sketch-pop-in {
  from { opacity: 0; transform: translateY(-4px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* ── 菜单行 ── */
.sketch-more-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 14px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease;
}
.sketch-more-row--select {
  align-items: flex-start;
  flex-direction: column;
  gap: 6px;
  cursor: default;
}
.sketch-more-row:hover {
  background: var(--sketch-toolbar-control-bg);
}
.sketch-more-label {
  font-size: 13px;
  color: var(--sketch-toolbar-text);
}
.sketch-select--menu {
  width: 100%;
}

.sketch-more-row--action {
  padding: 6px 14px;
  border-radius: 0;
}
.sketch-more-row--action:hover {
  color: var(--sketch-toolbar-strong-text);
}
.sketch-more-divider {
  height: 1px;
  background: var(--sketch-toolbar-control-border);
  margin: 2px 0;
}

.sketch-export-dialog {
  --sketch-export-dialog-panel: rgba(28, 28, 30, 0.98);
  --sketch-export-dialog-text: rgba(255, 255, 255, 0.88);
  --sketch-export-dialog-strong-text: #fff;
  --sketch-more-popover-surface: var(--b3-menu-background, var(--sketch-toolbar-popover-surface, rgba(28, 28, 30, 0.95)));
  --sketch-toolbar-active-text: #fff;
  --sketch-toolbar-border: rgba(255, 255, 255, 0.12);
  --sketch-toolbar-control-bg: rgba(255, 255, 255, 0.05);
  --sketch-toolbar-control-border: rgba(255, 255, 255, 0.08);
  --sketch-toolbar-hover-bg: rgba(255, 255, 255, 0.15);
  --sketch-toolbar-shadow: 0 10px 30px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.12);
  --sketch-toolbar-strong-text: #fff;
  --sketch-toolbar-text: rgba(255, 255, 255, 0.8);
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.24);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  box-sizing: border-box;
}

@media (prefers-color-scheme: light) {
  .sketch-export-dialog {
    --sketch-export-dialog-panel: rgba(255, 255, 255, 0.98);
    --sketch-export-dialog-text: rgba(15, 23, 42, 0.78);
    --sketch-export-dialog-strong-text: rgba(15, 23, 42, 0.94);
    --sketch-toolbar-border: rgba(15, 23, 42, 0.1);
    --sketch-toolbar-control-bg: rgba(15, 23, 42, 0.045);
    --sketch-toolbar-control-border: rgba(15, 23, 42, 0.08);
    --sketch-toolbar-hover-bg: rgba(15, 23, 42, 0.09);
    --sketch-toolbar-shadow: 0 12px 32px rgba(15, 23, 42, 0.12), 0 2px 8px rgba(15, 23, 42, 0.06);
  }
}

:global(html[data-theme="light"]) .sketch-export-dialog,
:global(html[data-theme-mode="light"]) .sketch-export-dialog,
:global(body[data-theme="light"]) .sketch-export-dialog,
.sketch-export-dialog--theme-light {
  --sketch-export-dialog-panel: rgba(255, 255, 255, 0.98);
  --sketch-export-dialog-text: rgba(15, 23, 42, 0.78);
  --sketch-export-dialog-strong-text: rgba(15, 23, 42, 0.94);
  --sketch-toolbar-border: rgba(15, 23, 42, 0.1);
  --sketch-toolbar-control-bg: rgba(15, 23, 42, 0.045);
  --sketch-toolbar-control-border: rgba(15, 23, 42, 0.08);
  --sketch-toolbar-hover-bg: rgba(15, 23, 42, 0.09);
  --sketch-toolbar-shadow: 0 12px 32px rgba(15, 23, 42, 0.12), 0 2px 8px rgba(15, 23, 42, 0.06);
}

:global(html[data-theme="dark"]) .sketch-export-dialog,
:global(html[data-theme-mode="dark"]) .sketch-export-dialog,
:global(body[data-theme="dark"]) .sketch-export-dialog,
.sketch-export-dialog--theme-dark {
  --sketch-export-dialog-panel: rgba(28, 28, 30, 0.98);
  --sketch-export-dialog-text: rgba(255, 255, 255, 0.88);
  --sketch-export-dialog-strong-text: #fff;
  --sketch-toolbar-border: rgba(255, 255, 255, 0.12);
  --sketch-toolbar-control-bg: rgba(255, 255, 255, 0.05);
  --sketch-toolbar-control-border: rgba(255, 255, 255, 0.08);
  --sketch-toolbar-hover-bg: rgba(255, 255, 255, 0.15);
  --sketch-toolbar-shadow: 0 10px 30px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.12);
}

.sketch-export-dialog__panel {
  width: min(340px, 100%);
  border: 1px solid var(--sketch-toolbar-border);
  border-radius: 12px;
  background: var(--sketch-export-dialog-panel);
  box-shadow: var(--sketch-toolbar-shadow);
  padding: 14px;
  color: var(--sketch-export-dialog-text);
  box-sizing: border-box;
}

.sketch-export-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.sketch-export-dialog__title {
  font-size: 15px;
  color: var(--sketch-export-dialog-strong-text);
}

.sketch-export-dialog__close {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--sketch-toolbar-control-border);
  border-radius: 8px;
  background: var(--sketch-toolbar-control-bg);
  color: var(--sketch-export-dialog-text);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
}

.sketch-export-dialog__close:hover {
  background: var(--sketch-toolbar-hover-bg);
  color: var(--sketch-export-dialog-strong-text);
}

.sketch-export-dialog__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.sketch-export-dialog__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
}

.sketch-export-dialog__label {
  font-size: 13px;
  color: var(--sketch-export-dialog-text);
}

.sketch-export-format {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.sketch-export-format__option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 34px;
  border: 1px solid var(--sketch-toolbar-control-border);
  border-radius: 8px;
  background: var(--sketch-toolbar-control-bg);
  color: var(--sketch-export-dialog-text);
  cursor: pointer;
  font-size: 13px;
}

.sketch-export-format__option :deep(.sketch-icon) {
  color: currentColor;
  font-size: 16px;
}

.sketch-export-format__option input {
  margin: 0;
}

.sketch-export-format__option--active {
  border-color: var(--b3-theme-primary);
  color: var(--sketch-export-dialog-strong-text);
}

.sketch-export-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.sketch-export-dialog__button {
  min-height: 32px;
  padding: 0 14px;
  border: 1px solid var(--sketch-toolbar-control-border);
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
}

.sketch-export-dialog__button--ghost {
  background: var(--sketch-toolbar-control-bg);
  color: var(--sketch-export-dialog-text);
}

.sketch-export-dialog__button--primary {
  border-color: transparent;
  background: var(--b3-theme-primary);
  color: var(--sketch-export-dialog-strong-text);
}

/* ── iOS 风格 Toggle 开关 ── */
.sketch-toggle {
  position: relative;
  width: 40px;
  height: 24px;
  border-radius: 12px;
  background: var(--sketch-toolbar-hover-bg);
  border: 1px solid var(--sketch-toolbar-control-border);
  cursor: pointer;
  transition: background 0.25s ease, border-color 0.25s ease;
  flex-shrink: 0;
}
.sketch-toggle--on {
  background: var(--b3-theme-primary);
  border-color: transparent;
}
.sketch-toggle__knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--sketch-toolbar-strong-text);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  transition: transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.sketch-toggle--on .sketch-toggle__knob {
  transform: translateX(16px);
}
</style>

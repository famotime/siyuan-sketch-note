<template>
  <div class="sketch-editor__row">
    <button class="sketch-btn sketch-btn--back" @click="$emit('back')">← {{ t("back") }}</button>
    <select class="sketch-select" :value="templateId" @change="$emit('update:templateId', ($event.target as HTMLSelectElement).value)">
      <option v-for="tpl in templates" :key="tpl.id" :value="tpl.id">{{ t(tpl.nameKey) }}</option>
    </select>
    <select
      v-if="backgroundFit"
      class="sketch-select"
      :value="backgroundFit"
      @change="$emit('backgroundFitChange', ($event.target as HTMLSelectElement).value)"
    >
      <option value="cover">{{ t("backgroundFitCover") }}</option>
      <option value="contain">{{ t("backgroundFitContain") }}</option>
      <option value="stretch">{{ t("backgroundFitStretch") }}</option>
    </select>
    <span class="sketch-editor__title">{{ t("sketchNote") }}</span>
    <span v-if="recovered" class="sketch-recovery">{{ t("dataRecovered") }}</span>

    <div v-if="false" class="sketch-pages">
      <button class="sketch-btn sketch-btn--page" :disabled="pageState.current <= 1" @click="$emit('previousPage')">‹</button>
      <button class="sketch-btn sketch-btn--page-label" @click="$emit('goToPage', pageState.current - 1)">
        {{ t("page") }} {{ pageState.current }} / {{ pageState.total }}
      </button>
      <div class="sketch-page-overview" :aria-label="t('pageOverview')">
        <button
          v-for="page in pageOverview"
          :key="page.id"
          class="sketch-page-overview__item"
          :class="{
            'sketch-page-overview__item--active': page.isActive,
            'sketch-page-overview__item--filled': page.hasContent,
          }"
          :title="`${t('page')} ${page.pageNumber}`"
          @click="$emit('goToPage', page.pageNumber - 1)"
        >
          {{ page.pageNumber }}
        </button>
      </div>
      <button class="sketch-btn sketch-btn--page" :disabled="pageState.current >= pageState.total" @click="$emit('nextPage')">›</button>
      <button class="sketch-btn sketch-btn--page-add" @click="$emit('addPage')">+ {{ t("addPage") }}</button>
      <button class="sketch-btn sketch-btn--page-add" @click="$emit('duplicatePage')">⧉ {{ t("duplicatePage") }}</button>
      <button class="sketch-btn sketch-btn--page-add" :disabled="pageState.total <= 1" @click="$emit('deletePage')">⌫ {{ t("deletePage") }}</button>
    </div>

    <span class="sketch-spacer" />
    <button
      v-if="false"
      class="sketch-btn sketch-btn--action"
      :disabled="ocrState === 'recognizing'"
      @click="$emit('recognize')"
    >
      {{ ocrState === "recognizing" ? t("ocrRecognizing") : t("ocrRecognize") }}
    </button>
    <div v-if="false" class="sketch-search" :class="{ 'sketch-search--open': searchOpen }">
      <button
        class="sketch-btn sketch-btn--toggle"
        :class="{ 'sketch-btn--toggle-on': searchOpen }"
        @click="toggleSearch"
      >
        {{ t("search") }}
      </button>
      <div v-if="searchOpen" class="sketch-search__bar">
        <input
          ref="searchInputRef"
          class="sketch-search__input"
          :placeholder="t('searchPlaceholder')"
          :value="searchQuery"
          @input="onSearchInput"
          @keydown.enter="$emit('searchNext')"
          @keydown.escape="onClearSearch"
        >
        <span v-if="searchQuery" class="sketch-search__count">
          {{ searchResultCount > 0 ? `${searchResultCount}` : t("noResults") }}
        </span>
        <button v-if="searchQuery && searchResultCount > 0" class="sketch-btn sketch-btn--page" @click="$emit('searchPrev')">&#8249;</button>
        <button v-if="searchQuery && searchResultCount > 0" class="sketch-btn sketch-btn--page" @click="$emit('searchNext')">&#8250;</button>
        <button v-if="searchQuery" class="sketch-btn sketch-btn--page" @click="onClearSearch">&#x2715;</button>
      </div>
    </div>
    <button class="sketch-btn sketch-btn--toggle" :class="{ 'sketch-btn--toggle-on': autoSave }" @click="$emit('toggleAutoSave')">
      {{ autoSave ? "ON" : "OFF" }} {{ t("autoSave") }}
    </button>
    <button class="sketch-btn sketch-btn--toggle" :class="{ 'sketch-btn--toggle-on': stylusOnly }" @click="$emit('toggleStylusOnly')">
      {{ stylusOnly ? "ON" : "OFF" }} {{ t("stylusOnly") }}
    </button>
    <button class="sketch-btn sketch-btn--toggle" :class="{ 'sketch-btn--toggle-on': enablePressure }" @click="$emit('togglePressure')">
      {{ enablePressure ? "ON" : "OFF" }} {{ t("enablePressure") }}
    </button>
    <button v-if="false" class="sketch-btn sketch-btn--toggle" :class="{ 'sketch-btn--toggle-on': exportIncludeBackground }" @click="$emit('toggleExportBackground')">
      {{ exportIncludeBackground ? "ON" : "OFF" }} {{ t("exportBackground") }}
    </button>
    <span class="sketch-status" :class="`sketch-status--${saveStatus}`">{{ statusLabel }}</span>
    <button class="sketch-btn sketch-btn--save" :disabled="saveStatus === 'saving'" @click="$emit('save')">{{ t("save") }}</button>
    <button v-if="false" class="sketch-btn sketch-btn--action" @click="$emit('exportPng')">⇩ {{ t("exportPng") }}</button>
    <button v-if="false" class="sketch-btn sketch-btn--action" @click="$emit('exportPdf')">⇩ {{ t("exportPdf") }}</button>
    <button v-if="false" class="sketch-btn sketch-btn--action" @click="$emit('exportJson')">⇩ {{ t("exportJson") }}</button>
    <button v-if="false" class="sketch-btn sketch-btn--action" @click="$emit('importJson')">⇧ {{ t("importJson") }}</button>
    <button v-if="false" class="sketch-btn sketch-btn--action" @click="$emit('importBackground')">▧ {{ t("importBackground") }}</button>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from "vue";
import type { PageOverviewItem } from "@/pages/model";
import type { Template } from "@/template";
import type { SaveStatus } from "@/storage/saveStatus";

const props = defineProps<{
  autoSave: boolean;
  backgroundFit?: string;
  exportIncludeBackground: boolean;
  ocrState: "idle" | "recognizing" | "completed" | "error";
  pageOverview: PageOverviewItem[];
  pageState: { current: number; total: number };
  recovered: boolean;
  saveStatus: SaveStatus;
  searchResultCount: number;
  statusLabel: string;
  stylusOnly: boolean;
  enablePressure: boolean;
  templateId: string;
  templates: Template[];
  t: (key: string) => string;
}>();

const emit = defineEmits<{
  (e: "addPage"): void;
  (e: "back"): void;
  (e: "backgroundFitChange", value: string): void;
  (e: "clearSearch"): void;
  (e: "deletePage"): void;
  (e: "duplicatePage"): void;
  (e: "exportJson"): void;
  (e: "exportPdf"): void;
  (e: "exportPng"): void;
  (e: "goToPage", index: number): void;
  (e: "importBackground"): void;
  (e: "importJson"): void;
  (e: "nextPage"): void;
  (e: "previousPage"): void;
  (e: "recognize"): void;
  (e: "save"): void;
  (e: "search", query: string): void;
  (e: "searchNext"): void;
  (e: "searchPrev"): void;
  (e: "toggleAutoSave"): void;
  (e: "toggleExportBackground"): void;
  (e: "toggleStylusOnly"): void;
  (e: "togglePressure"): void;
  (e: "update:templateId", value: string): void;
}>();

const searchOpen = ref(false);
const searchQuery = ref("");
const searchInputRef = ref<HTMLInputElement>();

function toggleSearch() {
  searchOpen.value = !searchOpen.value;
  if (searchOpen.value) {
    nextTick(() => searchInputRef.value?.focus());
  } else {
    onClearSearch();
  }
}

function onSearchInput(e: Event) {
  searchQuery.value = (e.target as HTMLInputElement).value;
  emit("search", searchQuery.value);
}

function onClearSearch() {
  searchQuery.value = "";
  searchOpen.value = false;
  emit("clearSearch");
}
</script>

<style scoped>
.sketch-editor__row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  width: 100%;
}

/* ── 统一的悬浮顶栏按钮 ── */
.sketch-btn {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  color: rgba(255, 255, 255, 0.8) !important;
  border-radius: 8px;
  padding: 5px 12px;
  cursor: pointer;
  font-size: 13px;
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
  user-select: none;
  box-sizing: border-box;
}
.sketch-btn:hover {
  background: rgba(255, 255, 255, 0.15) !important;
  border-color: rgba(255, 255, 255, 0.18) !important;
  color: #fff !important;
  transform: scale(1.03);
}
.sketch-btn:active {
  transform: scale(0.96);
}

.sketch-btn--back {
  background: rgba(255, 255, 255, 0.08) !important;
  border-color: rgba(255, 255, 255, 0.12) !important;
  font-weight: 500;
}

/* ── Toggle 开关按钮样式 ── */
.sketch-btn--toggle {
  color: rgba(255, 255, 255, 0.65) !important;
}
.sketch-btn--toggle-on {
  background: rgba(255, 255, 255, 0.18) !important;
  border-color: var(--b3-theme-primary) !important;
  color: #fff !important;
  box-shadow: 0 0 8px rgba(var(--b3-theme-primary-rgb), 0.15);
}

/* ── 手动保存主按钮 ── */
.sketch-btn--save {
  background: var(--b3-theme-primary) !important;
  border-color: transparent !important;
  color: #fff !important;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}
.sketch-btn--save:hover {
  background: var(--b3-theme-primary) !important;
  opacity: 0.92;
  box-shadow: 0 4px 16px rgba(var(--b3-theme-primary-rgb), 0.3);
  transform: scale(1.03);
}
.sketch-btn--save:active {
  transform: scale(0.96);
}
.sketch-btn--save:disabled {
  opacity: 0.4 !important;
  transform: none !important;
  cursor: not-allowed;
}

/* ── 下拉选择菜单 ── */
.sketch-select {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  color: rgba(255, 255, 255, 0.8) !important;
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 13px;
  min-height: 32px;
  outline: none;
  cursor: pointer;
  transition: all 0.2s ease;
  box-sizing: border-box;
}
.sketch-select:hover {
  background: rgba(255, 255, 255, 0.12) !important;
  border-color: rgba(255, 255, 255, 0.18) !important;
  color: #fff !important;
}
.sketch-select option {
  background: #1c1c1e;
  color: #fff;
}

/* ── 标题样式 ── */
.sketch-editor__title {
  font-weight: 600;
  font-size: 14px;
  color: #fff;
  letter-spacing: 0.5px;
  text-shadow: 0 2px 4px rgba(0,0,0,0.15);
  margin-left: 4px;
}

/* ── 柔光霓虹色状态指示 ── */
.sketch-status {
  font-size: 11px;
  font-weight: 500;
  width: 96px; /* 固定宽度，坚如磐石，彻底杜绝按钮移位跳动 */
  height: 24px;
  text-align: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-sizing: border-box;
  flex-shrink: 0; /* 禁止弹性收缩 */
}
.sketch-status--saved  { color: #2ecc71; border-color: rgba(46, 204, 113, 0.2); background: rgba(46, 204, 113, 0.05); }
.sketch-status--saving { color: rgba(255, 255, 255, 0.5); }
.sketch-status--error  { color: #e74c3c; border-color: rgba(231, 76, 60, 0.2); background: rgba(231, 76, 60, 0.05); }
.sketch-status--dirty  { color: #f39c12; border-color: rgba(243, 156, 18, 0.2); background: rgba(243, 156, 18, 0.05); }

/* 恢复损坏提示 */
.sketch-recovery {
  color: #f39c12;
  font-size: 11px;
  white-space: nowrap;
  font-weight: 500;
  text-shadow: 0 0 4px rgba(243, 156, 18, 0.2);
}

.sketch-spacer {
  flex: 1;
}
</style>

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
      <button class="sketch-btn sketch-btn--page-add" :disabled="pageState.total <= 1" @click="$emit('deletePage')">
        <IconParkIcon name="Delete" /> {{ t("deletePage") }}
      </button>
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
    <span class="sketch-sep" />
    <button class="sketch-btn sketch-btn--action" :disabled="!canUndo" :title="t('undo')" @click="$emit('undo')">
      <IconParkIcon name="Undo" />
    </button>
    <button class="sketch-btn sketch-btn--action" :disabled="!canRedo" :title="t('redo')" @click="$emit('redo')">
      <IconParkIcon name="Redo" />
    </button>
    <button class="sketch-btn sketch-btn--action" :title="t('clear')" @click="$emit('clear')">
      <IconParkIcon name="Clear" />
    </button>
    <span class="sketch-sep" />
    <div class="sketch-more-wrap" ref="moreWrapRef">
      <button class="sketch-btn sketch-btn--more" :class="{ 'sketch-btn--more-on': moreOpen }" :title="t('settings')" @click="moreOpen = !moreOpen">
        <IconParkIcon name="MoreFour" />
      </button>
      <div v-if="moreOpen" class="sketch-more-popover">
        <label class="sketch-more-row">
          <span class="sketch-more-label">{{ t("stylusOnly") }}</span>
          <span class="sketch-toggle" :class="{ 'sketch-toggle--on': stylusOnly }" @click="$emit('toggleStylusOnly')">
            <span class="sketch-toggle__knob" />
          </span>
        </label>
        <label class="sketch-more-row">
          <span class="sketch-more-label">{{ t("enablePressure") }}</span>
          <span class="sketch-toggle" :class="{ 'sketch-toggle--on': enablePressure }" @click="$emit('togglePressure')">
            <span class="sketch-toggle__knob" />
          </span>
        </label>
      </div>
    </div>
    <button v-if="false" class="sketch-btn sketch-btn--action" @click="$emit('exportPng')">⇩ {{ t("exportPng") }}</button>
    <button v-if="false" class="sketch-btn sketch-btn--action" @click="$emit('exportPdf')">⇩ {{ t("exportPdf") }}</button>
    <button v-if="false" class="sketch-btn sketch-btn--action" @click="$emit('exportJson')">⇩ {{ t("exportJson") }}</button>
    <button v-if="false" class="sketch-btn sketch-btn--action" @click="$emit('importJson')">⇧ {{ t("importJson") }}</button>
    <button v-if="false" class="sketch-btn sketch-btn--action" @click="$emit('importBackground')">
      <IconParkIcon name="AddPic" /> {{ t("importBackground") }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from "vue";
import type { PageOverviewItem } from "@/pages/model";
import type { Template } from "@/template";
import IconParkIcon from "./IconParkIcon.vue";

const props = defineProps<{
  backgroundFit?: string;
  canRedo: boolean;
  canUndo: boolean;
  exportIncludeBackground: boolean;
  ocrState: "idle" | "recognizing" | "completed" | "error";
  pageOverview: PageOverviewItem[];
  pageState: { current: number; total: number };
  recovered: boolean;
  searchResultCount: number;
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
  (e: "clear"): void;
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
  (e: "redo"): void;
  (e: "search", query: string): void;
  (e: "searchNext"): void;
  (e: "searchPrev"): void;
  (e: "toggleExportBackground"): void;
  (e: "toggleStylusOnly"): void;
  (e: "togglePressure"): void;
  (e: "undo"): void;
  (e: "update:templateId", value: string): void;
}>();

const searchOpen = ref(false);
const searchQuery = ref("");
const searchInputRef = ref<HTMLInputElement>();
const moreOpen = ref(false);
const moreWrapRef = ref<HTMLDivElement>();

function onDocClick(e: MouseEvent) {
  if (moreOpen.value && moreWrapRef.value && !moreWrapRef.value.contains(e.target as Node)) {
    moreOpen.value = false;
  }
}

onMounted(() => document.addEventListener("mousedown", onDocClick));
onUnmounted(() => document.removeEventListener("mousedown", onDocClick));

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
  gap: 8px;
  min-height: 36px;
  width: 100%;
}

/* ── 统一的悬浮顶栏按钮 ── */
.sketch-btn {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  color: rgba(255, 255, 255, 0.8) !important;
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

/* ── 下拉选择菜单 ── */
.sketch-select {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  color: rgba(255, 255, 255, 0.8) !important;
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
  background: rgba(255, 255, 255, 0.12) !important;
  border-color: rgba(255, 255, 255, 0.18) !important;
  color: #fff !important;
}
.sketch-select option {
  background: #1c1c1e;
  color: #fff;
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
  background: rgba(255, 255, 255, 0.12);
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
  background: rgba(255, 255, 255, 0.06) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
  font-size: 18px;
  letter-spacing: 2px;
  padding: 3px 8px;
  min-width: 30px;
}
.sketch-btn--more-on {
  background: rgba(255, 255, 255, 0.18) !important;
  border-color: var(--b3-theme-primary) !important;
  color: #fff !important;
}

/* ── 更多弹出菜单 ── */
.sketch-more-popover {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 180px;
  background: rgba(28, 28, 30, 0.95);
  backdrop-filter: blur(14px) saturate(160%);
  -webkit-backdrop-filter: blur(14px) saturate(160%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 6px 0;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35), 0 2px 8px rgba(0, 0, 0, 0.15);
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
  padding: 8px 14px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease;
}
.sketch-more-row:hover {
  background: rgba(255, 255, 255, 0.06);
}
.sketch-more-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
}

/* ── iOS 风格 Toggle 开关 ── */
.sketch-toggle {
  position: relative;
  width: 40px;
  height: 24px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.08);
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
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  transition: transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.sketch-toggle--on .sketch-toggle__knob {
  transform: translateX(16px);
}
</style>

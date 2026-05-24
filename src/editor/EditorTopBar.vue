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
.sketch-search {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.sketch-search--open {
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  padding: 2px 6px;
}
.sketch-search__bar {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.sketch-search__input {
  width: 160px;
  padding: 3px 8px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  font-size: 13px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
}
.sketch-search__count {
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
  white-space: nowrap;
  min-width: 24px;
  text-align: center;
}
</style>

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

    <div class="sketch-pages">
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
    <button class="sketch-btn sketch-btn--toggle" :class="{ 'sketch-btn--toggle-on': autoSave }" @click="$emit('toggleAutoSave')">
      {{ autoSave ? "ON" : "OFF" }} {{ t("autoSave") }}
    </button>
    <button class="sketch-btn sketch-btn--toggle" :class="{ 'sketch-btn--toggle-on': stylusOnly }" @click="$emit('toggleStylusOnly')">
      {{ stylusOnly ? "ON" : "OFF" }} {{ t("stylusOnly") }}
    </button>
    <button class="sketch-btn sketch-btn--toggle" :class="{ 'sketch-btn--toggle-on': exportIncludeBackground }" @click="$emit('toggleExportBackground')">
      {{ exportIncludeBackground ? "ON" : "OFF" }} {{ t("exportBackground") }}
    </button>
    <span class="sketch-status" :class="`sketch-status--${saveStatus}`">{{ statusLabel }}</span>
    <button class="sketch-btn sketch-btn--save" :disabled="saveStatus === 'saving'" @click="$emit('save')">{{ t("save") }}</button>
    <button class="sketch-btn sketch-btn--action" @click="$emit('exportPng')">⇩ {{ t("exportPng") }}</button>
    <button class="sketch-btn sketch-btn--action" @click="$emit('exportPdf')">⇩ {{ t("exportPdf") }}</button>
    <button class="sketch-btn sketch-btn--action" @click="$emit('exportJson')">⇩ {{ t("exportJson") }}</button>
    <button class="sketch-btn sketch-btn--action" @click="$emit('importJson')">⇧ {{ t("importJson") }}</button>
    <button class="sketch-btn sketch-btn--action" @click="$emit('importBackground')">▧ {{ t("importBackground") }}</button>
  </div>
</template>

<script setup lang="ts">
import type { PageOverviewItem } from "@/pages/model";
import type { Template } from "@/template";
import type { SaveStatus } from "@/storage/saveStatus";

defineProps<{
  autoSave: boolean;
  backgroundFit?: string;
  exportIncludeBackground: boolean;
  pageOverview: PageOverviewItem[];
  pageState: { current: number; total: number };
  recovered: boolean;
  saveStatus: SaveStatus;
  statusLabel: string;
  stylusOnly: boolean;
  templateId: string;
  templates: Template[];
  t: (key: string) => string;
}>();

defineEmits<{
  (e: "addPage"): void;
  (e: "back"): void;
  (e: "backgroundFitChange", value: string): void;
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
  (e: "save"): void;
  (e: "toggleAutoSave"): void;
  (e: "toggleExportBackground"): void;
  (e: "toggleStylusOnly"): void;
  (e: "update:templateId", value: string): void;
}>();
</script>

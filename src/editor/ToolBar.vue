<template>
  <div class="sketch-editor__row sketch-editor__row--tools">
    <div class="sketch-colors" :aria-label="t('colorPalette')">
      <button
        v-for="c in colors"
        :key="c"
        class="sketch-color"
        :class="{ 'sketch-color--active': activeTool !== 'eraser' && activePreset.color === c }"
        :style="{ backgroundColor: c }"
        :title="c"
        @click="$emit('selectColor', c)"
      />
      <label class="sketch-color-picker" :title="t('addColor')">
        +
        <input type="color" :value="activePreset.color" @input="$emit('selectCustomColor', ($event.target as HTMLInputElement).value)">
      </label>
    </div>
    <span class="sketch-sep" />
    <button
      v-for="button in toolButtons"
      :key="button.tool"
      class="sketch-btn sketch-btn--tool sketch-btn--icon-tool"
      :class="{ 'sketch-btn--tool-active': activeTool === button.tool }"
      :title="t(button.labelKey)"
      :aria-label="t(button.labelKey)"
      @click="$emit('selectTool', button.tool)"
    >
      <span class="sketch-btn__icon" aria-hidden="true">{{ button.icon }}</span>
      <span class="sketch-btn__label">{{ t(button.labelKey) }}</span>
    </button>
    <ToolOptionsPopover
      :lassoMode="lassoMode"
      :preset="activePreset"
      :t="t"
      :visibility="toolOptionsVisibility"
      @update:lassoMode="$emit('update:lassoMode', $event)"
      @updatePreset="$emit('updatePreset', $event)"
    />
    <span class="sketch-sep" />
    <button class="sketch-btn sketch-btn--action" :disabled="activeTool !== 'lasso'" @click="$emit('recolorSelection')">🎨 {{ t("recolor") }}</button>
    <button class="sketch-btn sketch-btn--action" :disabled="activeTool !== 'lasso'" @click="$emit('duplicateSelection')">⧉ {{ t("duplicateSelection") }}</button>
    <button class="sketch-btn sketch-btn--action" :disabled="activeTool !== 'lasso'" @click="$emit('deleteSelection')">⌫ {{ t("deleteSelection") }}</button>
    <span class="sketch-sep" />
    <button class="sketch-btn sketch-btn--action" :disabled="!canUndo" @click="$emit('undo')">↩ {{ t("undo") }}</button>
    <button class="sketch-btn sketch-btn--action" :disabled="!canRedo" @click="$emit('redo')">↪ {{ t("redo") }}</button>
    <button class="sketch-btn sketch-btn--action" @click="$emit('clear')">⌧ {{ t("clear") }}</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ToolPreset } from "@/types/sketch";
import type { EditorTool } from "./tools";
import { createEditorToolButtons, getToolOptionsVisibility } from "./toolbarModel";
import ToolOptionsPopover from "./ToolOptionsPopover.vue";

const props = defineProps<{
  activePreset: ToolPreset;
  activeTool: EditorTool;
  canRedo: boolean;
  canUndo: boolean;
  colors: readonly string[];
  lassoMode: "freehand" | "box";
  t: (key: string) => string;
}>();

defineEmits<{
  (e: "clear"): void;
  (e: "deleteSelection"): void;
  (e: "duplicateSelection"): void;
  (e: "recolorSelection"): void;
  (e: "redo"): void;
  (e: "selectColor", color: string): void;
  (e: "selectCustomColor", color: string): void;
  (e: "selectTool", tool: EditorTool): void;
  (e: "undo"): void;
  (e: "update:lassoMode", value: "freehand" | "box"): void;
  (e: "updatePreset", patch: Partial<Omit<ToolPreset, "tool">>): void;
}>();

const toolButtons = createEditorToolButtons();
const toolOptionsVisibility = computed(() => getToolOptionsVisibility(props.activeTool));
</script>

<template>
  <div class="sketch-toolbar">
    <div class="sketch-toolbar__colors">
      <button
        v-for="c in colors"
        :key="c"
        class="sketch-toolbar__color-btn"
        :class="{ 'sketch-toolbar__color-btn--active': modelColor === c && modelTool === 'pen' }"
        :style="{ backgroundColor: c }"
        @click="selectColor(c)"
      />
    </div>
    <div class="sketch-toolbar__separator" />
    <button
      class="sketch-toolbar__tool-btn"
      :class="{ 'sketch-toolbar__tool-btn--active': modelTool === 'pen' }"
      @click="selectTool('pen')"
    >✏️</button>
    <button
      class="sketch-toolbar__tool-btn"
      :class="{ 'sketch-toolbar__tool-btn--active': modelTool === 'eraser' }"
      @click="selectTool('eraser')"
    >🧹</button>
    <div class="sketch-toolbar__separator" />
    <button class="sketch-toolbar__action-btn" :disabled="!canUndo" @click="$emit('undo')">↩️</button>
    <button class="sketch-toolbar__action-btn" :disabled="!canRedo" @click="$emit('redo')">↪️</button>
    <button class="sketch-toolbar__action-btn" @click="$emit('clear')">🗑️</button>
  </div>
</template>

<script setup lang="ts">
import type { SketchTool } from "@/types/sketch";
import { PRESET_COLORS } from "@/types/sketch";

const props = defineProps<{
  modelColor: string;
  modelTool: SketchTool;
  canUndo: boolean;
  canRedo: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelColor", value: string): void;
  (e: "update:modelTool", value: SketchTool): void;
  (e: "undo"): void;
  (e: "redo"): void;
  (e: "clear"): void;
}>();

const colors = PRESET_COLORS;

function selectColor(c: string) {
  emit("update:modelColor", c);
  emit("update:modelTool", "pen");
}

function selectTool(t: SketchTool) {
  emit("update:modelTool", t);
}
</script>

<style scoped>
.sketch-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--b3-theme-surface);
  border-top: 1px solid var(--b3-border-color);
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  justify-content: center;
}
.sketch-toolbar__colors { display: flex; gap: 6px; }
.sketch-toolbar__color-btn {
  width: 28px; height: 28px; border-radius: 50%;
  border: 2px solid transparent; cursor: pointer; transition: border-color 0.15s;
}
.sketch-toolbar__color-btn--active {
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 2px var(--b3-theme-primary-light);
}
.sketch-toolbar__separator {
  width: 1px; height: 24px;
  background: var(--b3-border-color); margin: 0 4px;
}
.sketch-toolbar__tool-btn, .sketch-toolbar__action-btn {
  width: 36px; height: 36px; border-radius: 8px;
  border: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface); cursor: pointer;
  font-size: 18px; display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.sketch-toolbar__tool-btn--active {
  background: var(--b3-theme-primary-light);
  border-color: var(--b3-theme-primary);
}
.sketch-toolbar__action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>

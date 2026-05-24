<template>
  <div class="sketch-tool-options">
    <label class="sketch-range">
      <span>{{ t("width") }}</span>
      <input
        :value="preset.width"
        type="range"
        min="1"
        max="30"
        @input="emitWidth(($event.target as HTMLInputElement).value)"
      >
      <output>{{ preset.width }}</output>
    </label>
    <label v-if="visibility.opacity" class="sketch-range">
      <span>{{ t("opacity") }}</span>
      <input
        :value="preset.opacity"
        type="range"
        min="0.1"
        max="1"
        step="0.05"
        @input="emitOpacity(($event.target as HTMLInputElement).value)"
      >
      <output>{{ Math.round(preset.opacity * 100) }}%</output>
    </label>
    <label v-if="visibility.eraserMode" class="sketch-mode">
      <span>{{ t("eraserMode") }}</span>
      <select :value="preset.mode" @change="$emit('updatePreset', { mode: ($event.target as HTMLSelectElement).value as ToolPreset['mode'] })">
        <option value="pixel">{{ t("eraserModePixel") }}</option>
        <option value="stroke">{{ t("eraserModeStroke") }}</option>
      </select>
    </label>
    <label v-if="visibility.lassoMode" class="sketch-mode">
      <span>{{ t("lassoMode") }}</span>
      <select :value="lassoMode" @change="$emit('update:lassoMode', ($event.target as HTMLSelectElement).value as 'freehand' | 'box')">
        <option value="freehand">{{ t("lassoModeFreehand") }}</option>
        <option value="box">{{ t("lassoModeBox") }}</option>
      </select>
    </label>
  </div>
</template>

<script setup lang="ts">
import type { ToolPreset } from "@/types/sketch";
import type { ToolOptionsVisibility } from "./toolbarModel";

defineProps<{
  lassoMode: "freehand" | "box";
  preset: ToolPreset;
  t: (key: string) => string;
  visibility: ToolOptionsVisibility;
}>();

const emit = defineEmits<{
  (e: "update:lassoMode", value: "freehand" | "box"): void;
  (e: "updatePreset", patch: Partial<Omit<ToolPreset, "tool">>): void;
}>();

function emitWidth(value: string) {
  emit("updatePreset", { width: Number(value) });
}

function emitOpacity(value: string) {
  emit("updatePreset", { opacity: Number(value) });
}
</script>

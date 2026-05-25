<template>
  <div class="sketch-color-popup">
    <div class="sketch-color-popup__header">
      <label
        class="sketch-color-popup__swatch"
        :title="t('addColor')"
      >
        <span
          class="sketch-color-popup__swatch-preview"
          :style="{ backgroundColor: modelValue }"
        />
        <input
          type="color"
          :value="modelValue"
          @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        >
      </label>
    </div>
    <span class="sketch-color-popup__divider" />
    <PresetColorPalette
      :rainbowColors="rainbowColors"
      :recentColors="recentColors"
      :activeColor="modelValue"
      :t="t"
      @select="$emit('update:modelValue', $event)"
      @deleteRecent="$emit('deleteRecent', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import PresetColorPalette from "./PresetColorPalette.vue";

defineProps<{
  modelValue: string;
  rainbowColors: readonly string[];
  recentColors: string[];
  t: (key: string) => string;
}>();

defineEmits<{
  (e: "update:modelValue", color: string): void;
  (e: "deleteRecent", color: string): void;
}>();
</script>

<style scoped>
.sketch-color-popup {
  position: absolute;
  left: calc(100% + 8px);
  bottom: 0;
  min-width: 180px;
  background: rgba(28, 28, 30, 0.94);
  backdrop-filter: blur(16px) saturate(150%);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 14px;
  padding: 10px;
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.34), 0 2px 8px rgba(0, 0, 0, 0.18);
  z-index: 1001;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.sketch-color-popup__header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sketch-color-popup__swatch {
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.2s ease, transform 0.2s ease;
}

.sketch-color-popup__swatch:hover {
  border-color: rgba(255, 255, 255, 0.6);
  transform: scale(1.08);
}

.sketch-color-popup__swatch-preview {
  display: block;
  width: 100%;
  height: 100%;
}

.sketch-color-popup__swatch input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.sketch-color-popup__divider {
  width: 100%;
  height: 1px;
  background: rgba(255, 255, 255, 0.12);
}
</style>

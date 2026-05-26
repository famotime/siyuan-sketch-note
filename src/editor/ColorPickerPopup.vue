<template>
  <div class="sketch-color-popup">
    <div class="sketch-color-popup__spectrum-wrap">
      <div
        ref="spectrumRef"
        class="sketch-color-popup__spectrum"
        :style="{ backgroundColor: hueColor }"
        @mousedown.prevent="onSpectrumPointerStart"
        @touchstart.prevent="onSpectrumPointerStart"
      >
        <span
          class="sketch-color-popup__thumb"
          :style="{
            left: `${selectedHsv.saturation}%`,
            top: `${100 - selectedHsv.value}%`,
            backgroundColor: modelValue,
          }"
        />
      </div>
      <input
        class="sketch-color-popup__hue"
        type="range"
        min="0"
        max="360"
        :value="selectedHsv.hue"
        :aria-label="t('colorHue')"
        @input="onHueInput"
      >
      <div class="sketch-color-popup__preview-row">
        <span
          class="sketch-color-popup__preview"
          :style="{ backgroundColor: modelValue }"
        />
        <span class="sketch-color-popup__value">{{ modelValue.toUpperCase() }}</span>
      </div>
    </div>

    <button
      class="sketch-color-popup__preset-toggle"
      :class="{ 'sketch-color-popup__preset-toggle--open': presetsOpen }"
      :aria-expanded="presetsOpen"
      :aria-label="t('presetColors')"
      :title="t('presetColors')"
      @click="presetsOpen = !presetsOpen"
    >
      <span class="sketch-color-popup__preset-arrow" />
    </button>

    <PresetColorPalette
      v-if="presetsOpen"
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
import { computed, onUnmounted, ref, watch } from "vue";
import { clampSpectrumPoint, hexToHsv, hsvToHex } from "./colorPickerModel";
import PresetColorPalette from "./PresetColorPalette.vue";

const props = defineProps<{
  modelValue: string;
  rainbowColors: readonly string[];
  recentColors: string[];
  t: (key: string) => string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", color: string): void;
  (e: "deleteRecent", color: string): void;
}>();

const spectrumRef = ref<HTMLDivElement>();
const presetsOpen = ref(false);
const localHue = ref(hexToHsv(props.modelValue).hue);
let isPickingSpectrum = false;

const selectedHsv = computed(() => {
  const hsv = hexToHsv(props.modelValue);
  return {
    ...hsv,
    hue: localHue.value,
  };
});

const hueColor = computed(() => hsvToHex({
  hue: selectedHsv.value.hue,
  saturation: 100,
  value: 100,
}));

watch(
  () => props.modelValue,
  (color) => {
    const hsv = hexToHsv(color);
    if (hsv.saturation > 0) {
      localHue.value = hsv.hue;
    }
  },
);

function onHueInput(e: Event) {
  localHue.value = Number((e.target as HTMLInputElement).value);
  emit("update:modelValue", hsvToHex({
    hue: localHue.value,
    saturation: selectedHsv.value.saturation,
    value: selectedHsv.value.value,
  }));
}

function onSpectrumPointerStart(e: MouseEvent | TouchEvent) {
  isPickingSpectrum = true;
  updateColorFromSpectrum(e);
  window.addEventListener("mousemove", onSpectrumPointerMove);
  window.addEventListener("touchmove", onSpectrumPointerMove, { passive: false });
  window.addEventListener("mouseup", onSpectrumPointerEnd);
  window.addEventListener("touchend", onSpectrumPointerEnd, { passive: true });
}

function onSpectrumPointerMove(e: MouseEvent | TouchEvent) {
  if (!isPickingSpectrum) return;
  if (e instanceof TouchEvent) {
    e.preventDefault();
  }
  updateColorFromSpectrum(e);
}

function onSpectrumPointerEnd() {
  isPickingSpectrum = false;
  removeSpectrumListeners();
}

function updateColorFromSpectrum(e: MouseEvent | TouchEvent) {
  if (!spectrumRef.value) return;
  const rect = spectrumRef.value.getBoundingClientRect();
  const point = getClientPoint(e);
  const selection = clampSpectrumPoint(
    {
      x: point.x - rect.left,
      y: point.y - rect.top,
    },
    {
      width: rect.width,
      height: rect.height,
    },
  );
  emit("update:modelValue", hsvToHex({
    hue: localHue.value,
    saturation: selection.saturation,
    value: selection.value,
  }));
}

function getClientPoint(e: MouseEvent | TouchEvent) {
  if (e instanceof MouseEvent) {
    return { x: e.clientX, y: e.clientY };
  }
  const touch = e.touches[0] ?? e.changedTouches[0];
  return { x: touch.clientX, y: touch.clientY };
}

function removeSpectrumListeners() {
  window.removeEventListener("mousemove", onSpectrumPointerMove);
  window.removeEventListener("touchmove", onSpectrumPointerMove);
  window.removeEventListener("mouseup", onSpectrumPointerEnd);
  window.removeEventListener("touchend", onSpectrumPointerEnd);
}

onUnmounted(removeSpectrumListeners);
</script>

<style scoped>
.sketch-color-popup {
  position: absolute;
  left: calc(100% + 8px);
  bottom: 0;
  width: 216px;
  background: rgba(28, 28, 30, 0.94);
  backdrop-filter: blur(16px) saturate(150%);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 16px;
  padding: 12px;
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.34), 0 2px 8px rgba(0, 0, 0, 0.18);
  z-index: 1001;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}

.sketch-color-popup__spectrum-wrap {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.sketch-color-popup__spectrum {
  position: relative;
  height: 132px;
  border-radius: 12px;
  overflow: hidden;
  cursor: crosshair;
  touch-action: none;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16), 0 8px 18px rgba(0, 0, 0, 0.22);
}

.sketch-color-popup__spectrum::before,
.sketch-color-popup__spectrum::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.sketch-color-popup__spectrum::before {
  background: linear-gradient(90deg, #fff, rgba(255, 255, 255, 0));
}

.sketch-color-popup__spectrum::after {
  background: linear-gradient(0deg, #000, rgba(0, 0, 0, 0));
}

.sketch-color-popup__thumb {
  position: absolute;
  z-index: 1;
  width: 14px;
  height: 14px;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.55);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.sketch-color-popup__hue {
  width: 100%;
  accent-color: var(--b3-theme-primary);
  cursor: pointer;
}

.sketch-color-popup__preview-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
}

.sketch-color-popup__preview {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.22);
}

.sketch-color-popup__value {
  color: rgba(255, 255, 255, 0.78);
  font-size: 11px;
  letter-spacing: 0.08em;
  font-variant-numeric: tabular-nums;
}

.sketch-color-popup__preset-toggle {
  align-self: center;
  width: 30px;
  height: 18px;
  border: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.18s ease, transform 0.18s ease, color 0.18s ease;
}

.sketch-color-popup__preset-toggle:hover,
.sketch-color-popup__preset-toggle--open {
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
}

.sketch-color-popup__preset-toggle:active {
  transform: scale(0.92);
}

.sketch-color-popup__preset-arrow {
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 6px solid currentColor;
  transition: transform 0.18s ease;
}

.sketch-color-popup__preset-toggle--open .sketch-color-popup__preset-arrow {
  transform: rotate(180deg);
}
</style>

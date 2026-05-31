<template>
  <div
    class="sketch-color-popup"
    :class="{
      'sketch-color-popup--theme-light': themeMode === 'light',
      'sketch-color-popup--theme-dark': themeMode === 'dark',
    }"
  >
    <div class="sketch-color-popup__spectrum-wrap">
      <div
        ref="spectrumRef"
        class="sketch-color-popup__spectrum"
        :style="{ backgroundColor: hueColor }"
        @mousedown.prevent="onSpectrumPointerStart"
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
        <button
          class="sketch-color-popup__eyedropper"
          :class="{ 'sketch-color-popup__eyedropper--disabled': !hasEyeDropper }"
          :disabled="!hasEyeDropper"
          :title="t('eyedropper')"
          @click="startEyedropper"
        >
          <svg
            class="sketch-color-popup__eyedropper-icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <path
              fill="currentColor"
              d="M13.432 2.569c.18.18.324.394.42.63h.002c.098.236.147.489.147.744a1.98 1.98 0 0 1-.573 1.456l-.7.7l.25.26a1.137 1.137 0 0 1 0 1.6l-.583.583a1.137 1.137 0 0 1-1.6 0l-.255-.255l-.002-.002l-4.935 4.935a.5.5 0 0 1-.354.146h-.532l-1.286.552a1.025 1.025 0 0 1-1.35-1.348l.553-1.287v-.532a.5.5 0 0 1 .146-.353l4.935-4.945l-.254-.254a1.136 1.136 0 0 1 0-1.6l.59-.585a1.14 1.14 0 0 1 1.234-.245q.207.087.367.245l.256.254l.7-.7a1.95 1.95 0 0 1 1.375-.57a1.98 1.98 0 0 1 1.449.57M8.424 6.164l-4.785 4.788v.428a.5.5 0 0 1-.04.2l-.6 1.38l1.415-.557a.5.5 0 0 1 .2-.04h.428L9.83 7.574zm4.299-1.48a.9.9 0 0 0 .205-.307l-.001.002a1 1 0 0 0 .07-.362a1 1 0 0 0-.276-.741a.95.95 0 0 0-.667-.276a1 1 0 0 0-.731.277l-1.057 1.058a.5.5 0 0 1-.707 0l-.61-.608a.14.14 0 0 0-.046-.03a.1.1 0 0 0-.054-.01a.1.1 0 0 0-.054.01a.14.14 0 0 0-.046.03l-.583.583a.13.13 0 0 0-.04.095a.13.13 0 0 0 .04.095l3.333 3.332a.13.13 0 0 0 .096.04a.13.13 0 0 0 .095-.04l.583-.583a.13.13 0 0 0 .04-.096a.13.13 0 0 0-.04-.095l-.608-.61a.5.5 0 0 1 0-.707z"
            />
          </svg>
        </button>
      </div>
    </div>

    <button
      class="sketch-color-popup__preset-toggle"
      :class="{ 'sketch-color-popup__preset-toggle--open': isPresetsOpen }"
      :aria-label="t('presetColors')"
      :title="t('presetColors')"
      @click="$emit('togglePresets')"
    >
      <span class="sketch-color-popup__preset-arrow" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { clampSpectrumPoint, hexToHsv, hsvToHex } from "./colorPickerModel";

const props = defineProps<{
  modelValue: string;
  t: (key: string) => string;
  themeMode: 'light' | 'dark';
  isPresetsOpen?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", color: string): void;
  (e: "togglePresets"): void;
}>();

const spectrumRef = ref<HTMLDivElement>();
const localHue = ref(hexToHsv(props.modelValue).hue);
let isPickingSpectrum = false;

watch(
  spectrumRef,
  (spectrum, _oldSpectrum, onCleanup) => {
    if (!spectrum) return;
    spectrum.addEventListener("touchstart", onSpectrumPointerStart, { passive: false });
    onCleanup(() => {
      spectrum.removeEventListener("touchstart", onSpectrumPointerStart);
    });
  },
  { immediate: true },
);

const hasEyeDropper = typeof window !== "undefined" && "EyeDropper" in window;

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

async function startEyedropper() {
  if (!hasEyeDropper) return;
  try {
    const eyeDropper = new (window as any).EyeDropper();
    const result = await eyeDropper.open();
    if (result?.sRGBHex) {
      emit("update:modelValue", result.sRGBHex.toLowerCase());
    }
  } catch {
    // user cancelled
  }
}

function onHueInput(e: Event) {
  localHue.value = Number((e.target as HTMLInputElement).value);
  emit("update:modelValue", hsvToHex({
    hue: localHue.value,
    saturation: selectedHsv.value.saturation,
    value: selectedHsv.value.value,
  }));
}

function onSpectrumPointerStart(e: MouseEvent | TouchEvent) {
  e.preventDefault();
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
  --sketch-color-popup-bg: rgba(28, 28, 30, 0.94);
  --sketch-color-popup-border: rgba(255, 255, 255, 0.14);
  --sketch-color-popup-shadow: 0 14px 34px rgba(0, 0, 0, 0.34), 0 2px 8px rgba(0, 0, 0, 0.18);
  --sketch-color-popup-text: rgba(255, 255, 255, 0.78);
  --sketch-color-popup-strong-text: #fff;
  --sketch-color-popup-control-bg: rgba(255, 255, 255, 0.1);
  --sketch-color-popup-control-hover-bg: rgba(255, 255, 255, 0.2);
  --sketch-color-popup-toggle-bg: rgba(255, 255, 255, 0.08);
  --sketch-color-popup-toggle-hover-bg: rgba(255, 255, 255, 0.16);
  position: absolute;
  left: calc(100% + 8px);
  bottom: 0;
  width: 216px;
  box-sizing: border-box;
  background: var(--sketch-color-popup-bg);
  backdrop-filter: blur(16px) saturate(150%);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
  border: 1px solid var(--sketch-color-popup-border);
  border-radius: 16px;
  padding: 12px;
  box-shadow: var(--sketch-color-popup-shadow);
  z-index: 1001;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}

.sketch-color-popup--theme-light {
  --sketch-color-popup-bg: rgba(255, 255, 255, 0.96);
  --sketch-color-popup-border: rgba(15, 23, 42, 0.1);
  --sketch-color-popup-shadow: 0 14px 34px rgba(15, 23, 42, 0.14), 0 2px 8px rgba(15, 23, 42, 0.08);
  --sketch-color-popup-text: rgba(15, 23, 42, 0.78);
  --sketch-color-popup-strong-text: rgba(15, 23, 42, 0.94);
  --sketch-color-popup-control-bg: rgba(15, 23, 42, 0.08);
  --sketch-color-popup-control-hover-bg: rgba(15, 23, 42, 0.14);
  --sketch-color-popup-toggle-bg: rgba(15, 23, 42, 0.06);
  --sketch-color-popup-toggle-hover-bg: rgba(15, 23, 42, 0.12);
}

.sketch-color-popup--theme-dark {
  --sketch-color-popup-bg: rgba(28, 28, 30, 0.94);
  --sketch-color-popup-border: rgba(255, 255, 255, 0.14);
  --sketch-color-popup-shadow: 0 14px 34px rgba(0, 0, 0, 0.34), 0 2px 8px rgba(0, 0, 0, 0.18);
  --sketch-color-popup-text: rgba(255, 255, 255, 0.78);
  --sketch-color-popup-strong-text: #fff;
  --sketch-color-popup-control-bg: rgba(255, 255, 255, 0.1);
  --sketch-color-popup-control-hover-bg: rgba(255, 255, 255, 0.2);
  --sketch-color-popup-toggle-bg: rgba(255, 255, 255, 0.08);
  --sketch-color-popup-toggle-hover-bg: rgba(255, 255, 255, 0.16);
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
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  height: 14px;
  margin: 0;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
}

.sketch-color-popup__hue::-webkit-slider-runnable-track {
  height: 10px;
  border-radius: 999px;
  background: linear-gradient(90deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
}

.sketch-color-popup__hue::-moz-range-track {
  height: 10px;
  border-radius: 999px;
  background: linear-gradient(90deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
}

.sketch-color-popup__hue::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  margin-top: -3px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: transparent;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.55);
}

.sketch-color-popup__hue::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: transparent;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.55);
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
  color: var(--sketch-color-popup-text);
  font-size: 11px;
  letter-spacing: 0.08em;
  font-variant-numeric: tabular-nums;
  flex: 1;
}

.sketch-color-popup__eyedropper {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: var(--sketch-color-popup-control-bg);
  color: var(--sketch-color-popup-text);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: background 0.18s ease, color 0.18s ease;
  padding: 0;
}

.sketch-color-popup__eyedropper:hover {
  background: var(--sketch-color-popup-control-hover-bg);
  color: var(--sketch-color-popup-strong-text);
}

.sketch-color-popup__eyedropper--disabled {
  opacity: 0.35;
  cursor: default;
}

.sketch-color-popup__eyedropper--disabled:hover {
  background: var(--sketch-color-popup-control-bg);
  color: var(--sketch-color-popup-text);
}

.sketch-color-popup__eyedropper-icon {
  width: 16px;
  height: 16px;
  display: block;
}

.sketch-color-popup__preset-toggle {
  align-self: center;
  width: 30px;
  height: 18px;
  border: none;
  border-radius: 999px;
  background: var(--sketch-color-popup-toggle-bg);
  color: var(--sketch-color-popup-text);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.18s ease, transform 0.18s ease, color 0.18s ease;
}

.sketch-color-popup__preset-toggle:hover,
.sketch-color-popup__preset-toggle--open {
  background: var(--sketch-color-popup-toggle-hover-bg);
  color: var(--sketch-color-popup-strong-text);
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

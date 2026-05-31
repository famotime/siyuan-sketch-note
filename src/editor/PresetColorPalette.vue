<template>
  <div class="sketch-preset-palette">
    <div class="sketch-preset-colors">
      <button
        v-for="c in rainbowColors"
        :key="`rainbow-${c}`"
        class="sketch-preset-color"
        :class="{ 'sketch-preset-color--active': activeColor === c }"
        :style="{ backgroundColor: c }"
        :title="c"
        @click="$emit('select', c)"
      />
    </div>
    <span
      class="sketch-preset-divider"
    />
    <div class="sketch-preset-favorites">
      <button
        v-for="slot in favoriteSlots"
        :key="`favorite-${slot.index}`"
        class="sketch-preset-favorite-slot"
        :class="{
          'sketch-preset-favorite-slot--empty': !slot.color,
          'sketch-preset-color--active': slot.color === activeColor,
        }"
        :style="slot.color ? { backgroundColor: slot.color } : undefined"
        :title="slot.color ? `${slot.color} (${t('deleteColorHint')})` : t('addColor')"
        @click="onFavoriteClick(slot)"
        @contextmenu.prevent="deleteFavorite(slot.index)"
        @pointerdown.stop="onFavoritePointerDown(slot, $event)"
        @pointerup.stop="onFavoritePointerEnd"
        @pointercancel="onFavoritePointerEnd"
        @pointerleave="onFavoritePointerEnd"
        @pointermove.stop="onFavoritePointerMove"
      >
        {{ slot.color ? "" : "+" }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted } from "vue";
import { createColorLongPressState, shouldCancelColorLongPress, shouldSwallowColorClick } from "./colorLongPress";

const FAVORITE_COLOR_SLOTS = 7;

const props = defineProps<{
  rainbowColors: readonly string[];
  favoriteColors: readonly (string | null)[];
  activeColor: string;
  currentColor: string;
  t: (key: string) => string;
}>();

const emit = defineEmits<{
  (e: "select", color: string): void;
  (e: "setFavorite", index: number, color: string): void;
  (e: "deleteFavorite", index: number): void;
}>();

const favoriteSlots = computed(() =>
  Array.from({ length: FAVORITE_COLOR_SLOTS }, (_, index) => ({
    index,
    color: props.favoriteColors[index] ?? "",
  })),
);

let favoriteLongPressTimer: ReturnType<typeof setTimeout> | null = null;
let favoriteLongPressStartPoint: { x: number; y: number } | null = null;
let activeFavoritePointerId: number | null = null;
const favoriteLongPressState = createColorLongPressState();

function onFavoriteClick(slot: { index: number; color: string }) {
  if (shouldSwallowColorClick(favoriteLongPressState)) return;
  if (slot.color) {
    emit("select", slot.color);
    return;
  }
  emit("setFavorite", slot.index, props.currentColor);
}

function deleteFavorite(index: number) {
  emit("deleteFavorite", index);
}

function onFavoritePointerDown(slot: { index: number; color: string }, e: PointerEvent) {
  if (!slot.color || (e.pointerType === "mouse" && e.button !== 0)) return;
  favoriteLongPressState.didLongPressDelete = false;
  activeFavoritePointerId = e.pointerId;
  favoriteLongPressStartPoint = { x: e.clientX, y: e.clientY };
  if (favoriteLongPressTimer) {
    clearTimeout(favoriteLongPressTimer);
  }
  favoriteLongPressTimer = setTimeout(() => {
    emit("deleteFavorite", slot.index);
    favoriteLongPressState.didLongPressDelete = true;
    favoriteLongPressTimer = null;
  }, 600);
}

function onFavoritePointerEnd() {
  if (favoriteLongPressTimer) {
    clearTimeout(favoriteLongPressTimer);
    favoriteLongPressTimer = null;
  }
  favoriteLongPressStartPoint = null;
  activeFavoritePointerId = null;
}

function onFavoritePointerMove(e: PointerEvent) {
  if (!favoriteLongPressTimer || !favoriteLongPressStartPoint || activeFavoritePointerId !== e.pointerId) return;
  if (shouldCancelColorLongPress(favoriteLongPressStartPoint, { x: e.clientX, y: e.clientY })) {
    clearTimeout(favoriteLongPressTimer);
    favoriteLongPressTimer = null;
    favoriteLongPressStartPoint = null;
    activeFavoritePointerId = null;
  }
}

onUnmounted(onFavoritePointerEnd);
</script>

<style scoped>
.sketch-preset-palette {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.sketch-preset-colors {
  display: grid;
  grid-template-columns: repeat(7, 24px);
  gap: 8px 4px;
  justify-content: center;
}

.sketch-preset-color,
.sketch-preset-favorite-slot {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(255, 255, 255, 0.14);
  border-radius: 50%;
  cursor: pointer;
  padding: 0;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.24);
  box-sizing: border-box;
  transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
}

.sketch-preset-color:hover,
.sketch-preset-favorite-slot:hover {
  border-color: rgba(255, 255, 255, 0.72);
  transform: scale(1.12);
}

.sketch-preset-color--active {
  border-color: #fff;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.22), inset 0 2px 4px rgba(0, 0, 0, 0.24);
}

.sketch-preset-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.12);
}

.sketch-preset-favorites {
  display: grid;
  grid-template-columns: repeat(7, 24px);
  gap: 8px 4px;
  justify-content: center;
}

.sketch-preset-favorite-slot {
  color: rgba(255, 255, 255, 0.72);
  font-size: 16px;
  line-height: 1;
  font-weight: 500;
}

.sketch-preset-favorite-slot--empty {
  background: rgba(148, 163, 184, 0.32);
  box-shadow: inset 0 1px 3px rgba(15, 23, 42, 0.18);
}
</style>

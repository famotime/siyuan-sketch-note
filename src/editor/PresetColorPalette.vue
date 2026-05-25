<template>
  <div class="sketch-preset-palette">
    <button
      v-for="c in rainbowColors"
      :key="`rainbow-${c}`"
      class="sketch-preset-color"
      :class="{ 'sketch-preset-color--active': activeColor === c }"
      :style="{ backgroundColor: c }"
      :title="c"
      @click="$emit('select', c)"
    />
    <span
      v-if="recentColors.length > 0"
      class="sketch-preset-divider"
    />
    <button
      v-for="c in recentColors"
      :key="`recent-${c}`"
      class="sketch-preset-color sketch-preset-color--recent"
      :class="{ 'sketch-preset-color--active': activeColor === c }"
      :style="{ backgroundColor: c }"
      :title="`${c} (${t('deleteColorHint')})`"
      @click="$emit('select', c)"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  rainbowColors: readonly string[];
  recentColors: string[];
  activeColor: string;
  t: (key: string) => string;
}>();

defineEmits<{
  (e: "select", color: string): void;
  (e: "deleteRecent", color: string): void;
}>();
</script>

<style scoped>
.sketch-preset-palette {
  display: grid;
  grid-template-columns: repeat(5, 24px);
  gap: 8px;
  justify-content: center;
}

.sketch-preset-color {
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

.sketch-preset-color:hover {
  border-color: rgba(255, 255, 255, 0.72);
  transform: scale(1.12);
}

.sketch-preset-color--recent {
  border-style: dashed;
}

.sketch-preset-color--active {
  border-color: #fff;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.22), inset 0 2px 4px rgba(0, 0, 0, 0.24);
}

.sketch-preset-divider {
  grid-column: 1 / -1;
  height: 1px;
  background: rgba(255, 255, 255, 0.12);
}
</style>

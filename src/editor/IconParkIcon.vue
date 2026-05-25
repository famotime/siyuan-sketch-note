<template>
  <span
    class="sketch-icon"
    aria-hidden="true"
    v-html="markup"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ICON_PARK_ICONS } from "./iconParkIcons";
import type { IconParkName } from "./iconParkIcons";

const props = defineProps<{
  name: IconParkName;
}>();

const markup = computed(() => ICON_PARK_ICONS[props.name]);
</script>

<style scoped>
.sketch-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1em;
  height: 1em;
  line-height: 1;
  color: currentColor;
}

.sketch-icon :deep(svg) {
  display: block;
  width: 1em;
  height: 1em;
  fill: none;
}

.sketch-icon :deep([fill="currentColor"]),
.sketch-icon :deep([fill="white"]) {
  fill: none;
}
</style>

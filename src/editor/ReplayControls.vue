<template>
  <div class="replay-controls">
    <button
      class="replay-btn"
      :title="t('replayPrevious')"
      :disabled="!canStepBack"
      @click="$emit('previous')"
    >
      <IconParkIcon name="ArrowLeft" />
    </button>
    <button
      class="replay-btn replay-btn--play"
      :title="isPlaying ? t('replayPause') : t('replayPlay')"
      @click="$emit('togglePlay')"
    >
      <IconParkIcon :name="isPlaying ? 'Pause' : 'Play'" />
    </button>
    <button
      class="replay-btn"
      :title="t('replayNext')"
      :disabled="!canStepForward"
      @click="$emit('next')"
    >
      <IconParkIcon name="ArrowRight" />
    </button>
    <div class="replay-progress-wrap">
      <input
        type="range"
        class="replay-progress"
        :min="0"
        :max="total"
        :value="current"
        @input="$emit('seek', Number(($event.target as HTMLInputElement).value))"
      >
      <span class="replay-progress-label">{{ current }} / {{ total }}</span>
    </div>
    <select
      class="replay-speed"
      :value="speed"
      @change="$emit('speedChange', Number(($event.target as HTMLSelectElement).value))"
    >
      <option :value="1">
        1x
      </option>
      <option :value="2">
        2x
      </option>
      <option :value="4">
        4x
      </option>
    </select>
    <button
      class="replay-btn replay-btn--exit"
      :title="t('replayExit')"
      @click="$emit('exit')"
    >
      ✕
    </button>
  </div>
</template>

<script setup lang="ts">
import IconParkIcon from "./IconParkIcon.vue";
import type { PlaybackSpeed } from "@/recorder/player";

defineProps<{
  isPlaying: boolean;
  current: number;
  total: number;
  speed: PlaybackSpeed;
  canStepBack: boolean;
  canStepForward: boolean;
  t: (key: string) => string;
}>();

defineEmits<{
  (e: "togglePlay"): void;
  (e: "previous"): void;
  (e: "next"): void;
  (e: "seek", index: number): void;
  (e: "speedChange", speed: PlaybackSpeed): void;
  (e: "exit"): void;
}>();
</script>

<style scoped>
.replay-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  box-sizing: border-box;
  padding: 8px 14px;
  background: var(--sketch-toolbar-surface);
  backdrop-filter: blur(14px) saturate(160%);
  -webkit-backdrop-filter: blur(14px) saturate(160%);
  border: 1px solid var(--sketch-toolbar-border);
  border-radius: 12px;
  box-shadow: var(--sketch-toolbar-shadow);
  user-select: none;
}

.replay-btn {
  appearance: none;
  background: var(--sketch-toolbar-control-bg);
  border: 1px solid var(--sketch-toolbar-control-border);
  color: var(--sketch-toolbar-text);
  border-radius: 8px;
  padding: 4px 10px;
  cursor: pointer;
  font-size: 13px;
  min-height: 30px;
  min-width: 30px;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.replay-btn:hover {
  background: var(--sketch-toolbar-hover-bg);
  border-color: var(--sketch-toolbar-hover-border);
  color: var(--sketch-toolbar-strong-text);
}
.replay-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.replay-btn--play {
  min-width: 40px;
  font-size: 15px;
}
.replay-btn--exit {
  margin-left: 4px;
  color: var(--sketch-toolbar-muted-text);
}
.replay-btn--exit:hover {
  color: #e5484d;
}

.replay-progress-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.replay-progress {
  flex: 1;
  min-width: 0;
  height: 4px;
  appearance: none;
  background: var(--sketch-toolbar-control-border);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}
.replay-progress::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--b3-theme-primary);
  cursor: pointer;
}
.replay-progress::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--b3-theme-primary);
  cursor: pointer;
  border: none;
}

.replay-progress-label {
  font-size: 12px;
  color: var(--sketch-toolbar-muted-text);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  min-width: 48px;
  text-align: center;
}

.replay-speed {
  appearance: none;
  color-scheme: light dark;
  background: var(--sketch-toolbar-control-bg);
  border: 1px solid var(--sketch-toolbar-control-border);
  color: var(--sketch-toolbar-text);
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 13px;
  min-height: 30px;
  cursor: pointer;
  outline: none;
}
.replay-speed:hover {
  background: var(--sketch-toolbar-hover-bg);
}
.replay-speed option {
  background: var(--sketch-toolbar-popover-surface);
  color: var(--sketch-toolbar-strong-text);
}

@media (max-width: 520px) {
  .replay-controls {
    gap: 6px;
    padding: 6px 8px;
    border-radius: 10px;
  }

  .replay-btn {
    min-width: 28px;
    min-height: 28px;
    padding: 3px 7px;
  }

  .replay-btn--play {
    min-width: 34px;
  }

  .replay-progress-wrap {
    gap: 6px;
  }

  .replay-progress-label {
    display: none;
  }

  .replay-speed {
    min-height: 28px;
    padding: 3px 6px;
    font-size: 12px;
  }
}
</style>

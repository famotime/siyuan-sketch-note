<template>
  <div class="sketch-editor__row sketch-editor__row--tools">
    <div class="sketch-toolbar-group">
      <!-- ✏ 画笔 -->
      <button
        class="sketch-btn sketch-btn--tool sketch-btn--icon-tool"
        :class="{ 'sketch-btn--tool-active': activeTool === 'pen' }"
        :title="t('pen')"
        :aria-label="t('pen')"
        @click="$emit('selectTool', 'pen')"
      >
        <span class="sketch-btn__icon" aria-hidden="true">✏</span>
        <span class="sketch-btn__label">{{ t("pen") }}</span>
      </button>

      <!-- ▰ 荧光笔 -->
      <button
        class="sketch-btn sketch-btn--tool sketch-btn--icon-tool"
        :class="{ 'sketch-btn--tool-active': activeTool === 'highlighter' }"
        :title="t('highlighter')"
        :aria-label="t('highlighter')"
        @click="$emit('selectTool', 'highlighter')"
      >
        <span class="sketch-btn__icon" aria-hidden="true">▰</span>
        <span class="sketch-btn__label">{{ t("highlighter") }}</span>
      </button>

      <!-- ⌫ 橡皮擦 -->
      <button
        class="sketch-btn sketch-btn--tool sketch-btn--icon-tool"
        :class="{ 'sketch-btn--tool-active': activeTool === 'eraser' }"
        :title="t('eraser')"
        :aria-label="t('eraser')"
        @click="$emit('selectTool', 'eraser')"
      >
        <span class="sketch-btn__icon" aria-hidden="true">⌫</span>
        <span class="sketch-btn__label">{{ t("eraser") }}</span>
      </button>

      <!-- ◇ 套索（选区合一） -->
      <button
        class="sketch-btn sketch-btn--tool sketch-btn--icon-tool"
        :class="{ 'sketch-btn--tool-active': activeTool === 'lasso' }"
        :title="t('lasso')"
        :aria-label="t('lasso')"
        @click="$emit('selectTool', 'lasso')"
      >
        <span class="sketch-btn__icon" aria-hidden="true">◇</span>
        <span class="sketch-btn__label">{{ t("lasso") }}</span>
      </button>

      <!-- 图形（图形合一主按钮） -->
      <button
        class="sketch-btn sketch-btn--tool sketch-btn--icon-tool"
        :class="{ 'sketch-btn--tool-active': isShapeActive }"
        :title="t('shape') || '图形'"
        :aria-label="t('shape') || '图形'"
        @click="$emit('selectTool', lastShapeTool)"
      >
        <span class="sketch-btn__icon" aria-hidden="true">{{ currentShapeIcon }}</span>
        <span class="sketch-btn__label">{{ t(lastShapeTool) }}</span>
      </button>

      <!-- T 文本 -->
      <button
        class="sketch-btn sketch-btn--tool sketch-btn--icon-tool"
        :title="t('text')"
        :aria-label="t('text')"
        @click="$emit('selectTool', 'text')"
      >
        <span class="sketch-btn__icon" aria-hidden="true">T</span>
        <span class="sketch-btn__label">{{ t("text") }}</span>
      </button>

      <!-- ▧ 图片 -->
      <button
        v-if="false"
        class="sketch-btn sketch-btn--tool sketch-btn--icon-tool"
        :title="t('image')"
        :aria-label="t('image')"
        @click="$emit('selectTool', 'image')"
      >
        <span class="sketch-btn__icon" aria-hidden="true">▧</span>
        <span class="sketch-btn__label">{{ t("image") }}</span>
      </button>
    </div>

    <!-- 撤销、重做与清空 -->
    <span class="sketch-sep" />
    <button class="sketch-btn sketch-btn--action" :disabled="!canUndo" @click="$emit('undo')">↩ {{ t("undo") }}</button>
    <button class="sketch-btn sketch-btn--action" :disabled="!canRedo" @click="$emit('redo')">↪ {{ t("redo") }}</button>
    <button class="sketch-btn sketch-btn--action" @click="$emit('clear')">⌧ {{ t("clear") }}</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { EditorTool, ShapeEditorTool } from "./tools";
import { isShapeEditorTool } from "./tools";

const props = defineProps<{
  activeTool: EditorTool;
  lastShapeTool: ShapeEditorTool;
  canRedo: boolean;
  canUndo: boolean;
  t: (key: string) => string;
}>();

defineEmits<{
  (e: "clear"): void;
  (e: "redo"): void;
  (e: "selectTool", tool: EditorTool): void;
  (e: "undo"): void;
}>();

// ── 形状工具激活状态 ──
const isShapeActive = computed(() => isShapeEditorTool(props.activeTool));

// ── 根据上次选择的图形映射图形图标 ──
const currentShapeIcon = computed(() => {
  const icons: Record<ShapeEditorTool, string> = {
    line: "／",
    arrow: "→",
    rectangle: "□",
    ellipse: "○",
    triangle: "△",
  };
  return icons[props.lastShapeTool] ?? "／";
});
</script>

<style scoped>
.sketch-toolbar-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>

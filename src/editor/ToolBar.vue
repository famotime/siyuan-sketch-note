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
.sketch-editor__row--tools {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.sketch-toolbar-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ── 统一的第二行极简磨砂工具按钮 ── */
.sketch-btn--tool {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  color: rgba(255, 255, 255, 0.75) !important;
  border-radius: 8px;
  font-size: 13px;
  min-height: 32px;
  padding: 5px 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
  user-select: none;
  box-sizing: border-box;
}
.sketch-btn--tool:hover {
  background: rgba(255, 255, 255, 0.12) !important;
  border-color: rgba(255, 255, 255, 0.15) !important;
  color: #fff !important;
  transform: scale(1.03);
}
.sketch-btn--tool:active {
  transform: scale(0.95);
}

/* 选中激活状态：高亮微光 */
.sketch-btn--tool-active {
  background: var(--b3-theme-primary) !important;
  color: #fff !important;
  border-color: transparent !important;
  box-shadow: 0 4px 12px rgba(var(--b3-theme-primary-rgb), 0.25);
}

/* 图标与动作按钮样式 */
.sketch-btn__icon {
  font-size: 14px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
}

.sketch-btn__label {
  font-size: 12px;
  font-weight: 500;
}

/* ── 撤销、重做、清除动作按钮 ── */
.sketch-btn--action {
  background: rgba(255, 255, 255, 0.04) !important;
  border: 1px solid rgba(255, 255, 255, 0.06) !important;
  color: rgba(255, 255, 255, 0.75) !important;
  border-radius: 8px;
  font-size: 12px;
  padding: 5px 12px;
  min-height: 32px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s ease;
  box-sizing: border-box;
}
.sketch-btn--action:hover {
  background: rgba(255, 255, 255, 0.12) !important;
  border-color: rgba(255, 255, 255, 0.15) !important;
  color: #fff !important;
  transform: scale(1.03);
}
.sketch-btn--action:active {
  transform: scale(0.95);
}
.sketch-btn--action:disabled {
  opacity: 0.35 !important;
  transform: none !important;
  cursor: not-allowed;
  border-color: rgba(255, 255, 255, 0.03) !important;
  background: rgba(255, 255, 255, 0.01) !important;
}

.sketch-sep {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.12);
  margin: 0 4px;
  flex-shrink: 0;
}
</style>

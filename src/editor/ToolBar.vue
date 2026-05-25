<template>
  <div class="sketch-editor__row sketch-editor__row--tools">
    <div class="sketch-toolbar-group">
      <!-- 画笔 -->
      <button
        class="sketch-btn sketch-btn--tool sketch-btn--icon-tool"
        :class="{ 'sketch-btn--tool-active': getToolButtonActiveState(activeTool, 'pen') }"
        :title="t('pen')"
        :aria-label="t('pen')"
        @click="$emit('selectTool', 'pen')"
      >
        <span class="sketch-btn__icon" aria-hidden="true">
          <IconParkIcon name="Write" />
        </span>
      </button>

      <!-- 荧光笔 -->
      <button
        class="sketch-btn sketch-btn--tool sketch-btn--icon-tool"
        :class="{ 'sketch-btn--tool-active': getToolButtonActiveState(activeTool, 'highlighter') }"
        :title="t('highlighter')"
        :aria-label="t('highlighter')"
        @click="$emit('selectTool', 'highlighter')"
      >
        <span class="sketch-btn__icon" aria-hidden="true">
          <IconParkIcon name="FormatBrush" />
        </span>
      </button>

      <!-- 橡皮擦 -->
      <button
        class="sketch-btn sketch-btn--tool sketch-btn--icon-tool"
        :class="{ 'sketch-btn--tool-active': getToolButtonActiveState(activeTool, 'eraser') }"
        :title="t('eraser')"
        :aria-label="t('eraser')"
        @click="$emit('selectTool', 'eraser')"
      >
        <span class="sketch-btn__icon" aria-hidden="true">
          <IconParkIcon name="DeleteKey" />
        </span>
      </button>

      <!-- 套索（选区合一） -->
      <button
        class="sketch-btn sketch-btn--tool sketch-btn--icon-tool"
        :class="{ 'sketch-btn--tool-active': getToolButtonActiveState(activeTool, 'lasso') }"
        :title="t('lasso')"
        :aria-label="t('lasso')"
        @click="$emit('selectTool', 'lasso')"
      >
        <span class="sketch-btn__icon" aria-hidden="true">
          <IconParkIcon name="Selected" />
        </span>
      </button>

      <!-- 图形（图形合一主按钮） -->
      <button
        class="sketch-btn sketch-btn--tool sketch-btn--icon-tool"
        :class="{ 'sketch-btn--tool-active': getToolButtonActiveState(activeTool, lastShapeTool) }"
        :title="t('shape')"
        :aria-label="t('shape')"
        @click="$emit('selectTool', lastShapeTool)"
      >
        <span class="sketch-btn__icon" aria-hidden="true">
          <IconParkIcon :name="currentShapeIcon" />
        </span>
      </button>

      <!-- 文本 -->
      <button
        class="sketch-btn sketch-btn--tool sketch-btn--icon-tool"
        :class="{ 'sketch-btn--tool-active': getToolButtonActiveState(activeTool, 'text') }"
        :title="t('text')"
        :aria-label="t('text')"
        @click="$emit('selectTool', 'text')"
      >
        <span class="sketch-btn__icon" aria-hidden="true">
          <IconParkIcon name="Text" />
        </span>
      </button>

      <!-- 图片 -->
      <button
        v-if="false"
        class="sketch-btn sketch-btn--tool sketch-btn--icon-tool"
        :title="t('image')"
        :aria-label="t('image')"
        @click="$emit('selectTool', 'image')"
      >
        <span class="sketch-btn__icon" aria-hidden="true">
          <IconParkIcon name="AddPic" />
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { EditorTool, ShapeEditorTool } from "./tools";
import IconParkIcon from "./IconParkIcon.vue";
import type { IconParkName } from "./iconParkIcons";
import { getToolButtonActiveState } from "./toolbarModel";

const props = defineProps<{
  activeTool: EditorTool;
  lastShapeTool: ShapeEditorTool;
  t: (key: string) => string;
}>();

defineEmits<{
  (e: "selectTool", tool: EditorTool): void;
}>();

// ── 根据上次选择的图形映射图形图标 ──
const currentShapeIcon = computed<IconParkName>(() => {
  const icons: Record<ShapeEditorTool, IconParkName> = {
    line: "Minus",
    arrow: "ArrowRight",
    rectangle: "Rectangle",
    ellipse: "Round",
    triangle: "Triangle",
  };
  return icons[props.lastShapeTool] ?? "Minus";
});
</script>

<style scoped>
.sketch-editor__row--tools {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.sketch-toolbar-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ── 统一的第二行极简磨砂工具按钮 ── */
.sketch-btn--tool {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  color: rgba(255, 255, 255, 0.75) !important;
  border-radius: 8px;
  font-size: 13px;
  min-height: 30px;
  padding: 4px 10px;
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

</style>

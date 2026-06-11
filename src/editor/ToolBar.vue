<template>
  <div class="sketch-editor__row sketch-editor__row--tools">
    <div
      class="sketch-toolbar-group"
      :class="{ 'sketch-toolbar-group--replay': replayActive }"
    >
      <!-- 画笔（下拉） -->
      <ToolDropdown v-model="showPenDropdown">
        <template #trigger>
          <button
            class="sketch-btn sketch-btn--tool sketch-btn--icon-tool sketch-btn--dropdown-trigger"
            :class="{ 'sketch-btn--tool-active': getToolButtonActiveState(activeTool, 'pen') }"
            :title="t(props.penSubtype === 'ballpoint' ? 'pen' : PEN_SUBTYPE_LABEL_KEYS[props.penSubtype])"
            :aria-label="t('pen')"
            data-tool="pen"
            @click="emit('selectTool', 'pen')"
          >
            <span
              class="sketch-btn__icon"
              aria-hidden="true"
              v-html="PEN_SUBTYPE_ICONS[props.penSubtype]"
            />
          </button>
        </template>
        <template #dropdown>
          <button
            v-for="subtype in penSubtypes"
            :key="subtype"
            class="sketch-dropdown-item"
            :class="{ 'sketch-dropdown-item--active': props.penSubtype === subtype }"
            @click="onSelectPenSubtype(subtype)"
          >
            <span
              class="sketch-dropdown-item__icon"
              v-html="PEN_SUBTYPE_ICONS[subtype]"
            />
            <span class="sketch-dropdown-item__label">{{ t(PEN_SUBTYPE_LABEL_KEYS[subtype]) }}</span>
          </button>
        </template>
      </ToolDropdown>

      <!-- 荧光笔（下拉） -->
      <ToolDropdown v-model="showHighlighterDropdown">
        <template #trigger>
          <button
            class="sketch-btn sketch-btn--tool sketch-btn--icon-tool sketch-btn--dropdown-trigger"
            :class="{ 'sketch-btn--tool-active': getToolButtonActiveState(activeTool, 'highlighter') }"
            :title="t(HIGHLIGHTER_SUBTYPE_LABEL_KEYS[props.highlighterSubtype])"
            :aria-label="t('highlighter')"
            data-tool="highlighter"
            @click="emit('selectTool', 'highlighter')"
          >
            <span
              class="sketch-btn__icon"
              aria-hidden="true"
              v-html="HIGHLIGHTER_SUBTYPE_ICONS[props.highlighterSubtype]"
            />
          </button>
        </template>
        <template #dropdown>
          <button
            v-for="subtype in highlighterSubtypes"
            :key="subtype"
            class="sketch-dropdown-item"
            :class="{ 'sketch-dropdown-item--active': props.highlighterSubtype === subtype }"
            @click="onSelectHighlighterSubtype(subtype)"
          >
            <span
              class="sketch-dropdown-item__icon"
              v-html="HIGHLIGHTER_SUBTYPE_ICONS[subtype]"
            />
            <span class="sketch-dropdown-item__label">{{ t(HIGHLIGHTER_SUBTYPE_LABEL_KEYS[subtype]) }}</span>
          </button>
        </template>
      </ToolDropdown>

      <!-- 橡皮擦 -->
      <button
        class="sketch-btn sketch-btn--tool sketch-btn--icon-tool"
        :class="{ 'sketch-btn--tool-active': getToolButtonActiveState(activeTool, 'eraser') }"
        :title="t('eraser')"
        :aria-label="t('eraser')"
        data-tool="eraser"
        @click="$emit('selectTool', 'eraser')"
      >
        <span
          class="sketch-btn__icon"
          aria-hidden="true"
        >
          <svg
            class="sketch-icon"
            viewBox="0 0 48 48"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g clip-path="url(#icon-c251fcf7c11bad3)">
              <path
                d="M44.7818 24.1702L31.918 7.09935L14.1348 20.5L27.5 37L30.8556 34.6643L44.7818 24.1702Z"
                fill="none"
                stroke="currentColor"
                stroke-width="4"
                stroke-linejoin="round"
              />
              <path
                d="M27.4998 37L23.6613 40.0748L13.0978 40.074L10.4973 36.6231L4.06543 28.0876L14.4998 20.2248"
                stroke="currentColor"
                stroke-width="4"
                stroke-linejoin="round"
              />
              <path
                d="M13.2056 40.072L44.5653 40.072"
                stroke="currentColor"
                stroke-width="4"
                stroke-linecap="round"
              />
            </g>
            <defs>
              <clipPath id="icon-c251fcf7c11bad3">
                <rect
                  width="48"
                  height="48"
                />
              </clipPath>
            </defs>
          </svg>
        </span>
      </button>

      <!-- 套索（选区合一） -->
      <button
        class="sketch-btn sketch-btn--tool sketch-btn--icon-tool"
        :class="{ 'sketch-btn--tool-active': getToolButtonActiveState(activeTool, 'lasso') }"
        :title="t('lasso')"
        :aria-label="t('lasso')"
        data-tool="lasso"
        @click="$emit('selectTool', 'lasso')"
      >
        <span
          class="sketch-btn__icon"
          aria-hidden="true"
        >
          <IconParkIcon name="Selected" />
        </span>
      </button>

      <!-- 图形（下拉） -->
      <ToolDropdown v-model="showShapeDropdown">
        <template #trigger>
          <button
            class="sketch-btn sketch-btn--tool sketch-btn--icon-tool sketch-btn--dropdown-trigger"
            :class="{ 'sketch-btn--tool-active': getToolButtonActiveState(activeTool, lastShapeTool) }"
            :title="t(lastShapeTool === 'rectangle' ? 'shape' : lastShapeTool)"
            :aria-label="t('shape')"
            data-tool="shape"
            @click="$emit('selectTool', lastShapeTool)"
          >
            <span
              class="sketch-btn__icon"
              aria-hidden="true"
            >
              <IconParkIcon :name="currentShapeIcon" />
            </span>
          </button>
        </template>
        <template #dropdown>
          <button
            v-for="shape in shapeOptions"
            :key="shape.tool"
            class="sketch-dropdown-item"
            :class="{ 'sketch-dropdown-item--active': lastShapeTool === shape.tool }"
            @click="onSelectShape(shape.tool)"
          >
            <span class="sketch-dropdown-item__icon">
              <IconParkIcon :name="shape.icon" />
            </span>
            <span class="sketch-dropdown-item__label">{{ t(shape.labelKey) }}</span>
          </button>
        </template>
      </ToolDropdown>

      <!-- 文本 -->
      <button
        class="sketch-btn sketch-btn--tool sketch-btn--icon-tool"
        :class="{ 'sketch-btn--tool-active': getToolButtonActiveState(activeTool, 'text') }"
        :title="t('text')"
        :aria-label="t('text')"
        data-tool="text"
        @click="$emit('selectTool', 'text')"
      >
        <span
          class="sketch-btn__icon"
          aria-hidden="true"
        >
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
        <span
          class="sketch-btn__icon"
          aria-hidden="true"
        >
          <IconParkIcon name="AddPic" />
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import type { EditorTool, ShapeEditorTool } from "./tools";
import type { PenSubtype, HighlighterSubtype } from "@/types/sketch";
import IconParkIcon from "./IconParkIcon.vue";
import ToolDropdown from "./ToolDropdown.vue";
import type { IconParkName } from "./iconParkIcons";
import { PEN_SUBTYPE_ICONS, HIGHLIGHTER_SUBTYPE_ICONS, PEN_SUBTYPE_LABEL_KEYS, HIGHLIGHTER_SUBTYPE_LABEL_KEYS } from "./penSubtypeIcons";
import { getToolButtonActiveState } from "./toolbarModel";

const props = defineProps<{
  activeTool: EditorTool;
  lastShapeTool: ShapeEditorTool;
  penSubtype: PenSubtype;
  highlighterSubtype: HighlighterSubtype;
  t: (key: string) => string;
  replayActive?: boolean;
}>();

const emit = defineEmits<{
  (e: "selectTool", tool: EditorTool): void;
  (e: "selectPenSubtype", subtype: PenSubtype): void;
  (e: "selectHighlighterSubtype", subtype: HighlighterSubtype): void;
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

// ── 画笔 / 荧光笔下拉 ──
const showPenDropdown = ref(false);
const showHighlighterDropdown = ref(false);

const penSubtypes: PenSubtype[] = ["ballpoint", "pencil", "fountain", "brush"];
const highlighterSubtypes: HighlighterSubtype[] = ["round", "square", "watercolor"];

// ── 图形下拉 ──
const shapeOptions = [
  { tool: "line" as ShapeEditorTool, labelKey: "line", icon: "Minus" },
  { tool: "arrow" as ShapeEditorTool, labelKey: "arrow", icon: "ArrowRight" },
  { tool: "rectangle" as ShapeEditorTool, labelKey: "rectangle", icon: "Rectangle" },
  { tool: "ellipse" as ShapeEditorTool, labelKey: "ellipse", icon: "Round" },
  { tool: "triangle" as ShapeEditorTool, labelKey: "triangle", icon: "Triangle" },
];

const showShapeDropdown = ref(false);

function onSelectShape(tool: ShapeEditorTool) {
  emit("selectTool", tool);
  showShapeDropdown.value = false;
}

function onSelectPenSubtype(subtype: PenSubtype) {
  emit("selectPenSubtype", subtype);
  showPenDropdown.value = false;
}

function onSelectHighlighterSubtype(subtype: HighlighterSubtype) {
  emit("selectHighlighterSubtype", subtype);
  showHighlighterDropdown.value = false;
}
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
  background: var(--sketch-toolbar-control-bg) !important;
  border: 1px solid var(--sketch-toolbar-control-border) !important;
  color: var(--sketch-toolbar-text) !important;
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
  background: var(--sketch-toolbar-border) !important;
  border-color: var(--sketch-toolbar-hover-bg) !important;
  color: var(--sketch-toolbar-strong-text) !important;
  transform: scale(1.03);
}
.sketch-btn--tool:active {
  transform: scale(0.95);
}

/* 选中激活状态：高亮微光；覆盖 hover，避免点击后高亮被悬停态遮住 */
.sketch-btn--tool-active,
.sketch-btn--tool.sketch-btn--tool-active:hover {
  background: var(--b3-theme-primary) !important;
  color: var(--sketch-toolbar-active-text) !important;
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

.sketch-btn__icon > svg {
  display: block;
  width: 1em;
  height: 1em;
  fill: none;
}

/* 回放点击动画 */
@keyframes sketch-replay-click {
  0% { transform: scale(1); }
  40% { transform: scale(0.85); }
  100% { transform: scale(1); }
}
.sketch-btn--replay-click {
  animation: sketch-replay-click 250ms cubic-bezier(0.25, 0.8, 0.25, 1);
}

/* 回放时禁止交互 */
.sketch-toolbar-group--replay {
  pointer-events: none;
}

/* 下拉项 */
.sketch-btn--dropdown-trigger {
  position: relative;
  padding-right: 14px;
}

.sketch-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border: none;
  background: transparent;
  color: var(--sketch-toolbar-text);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s ease;
}

.sketch-dropdown-item:hover {
  background: var(--sketch-toolbar-border);
}

.sketch-dropdown-item--active {
  background: var(--b3-theme-primary);
  color: var(--sketch-toolbar-active-text);
}

.sketch-dropdown-item__icon {
  display: inline-flex;
  align-items: center;
  font-size: 14px;
  width: 1em;
  height: 1em;
}

.sketch-dropdown-item__icon > svg {
  width: 1em;
  height: 1em;
}

.sketch-dropdown-item__label {
  white-space: nowrap;
}

</style>

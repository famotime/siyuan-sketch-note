<template>
  <div
    v-if="isVisible"
    ref="panelRef"
    class="sketch-float-panel"
    :class="{ 'sketch-float-panel--replay': replayActive }"
    :style="{ left: `${pos.left}px`, top: `${pos.top}px` }"
  >
    <!-- 拖动手柄 -->
    <div
      ref="dragHandleRef"
      class="sketch-float-panel__handle"
      @mousedown="onDragStart"
    >
      <span class="sketch-float-panel__handle-dot" />
      <span class="sketch-float-panel__handle-dot" />
    </div>

    <!-- 1. 形状工具选择（仅在选择图形工具时显示在最上方） -->
    <div
      v-if="isShapeMode"
      class="sketch-float-group sketch-float-group--shapes"
    >
      <button
        v-for="shape in shapeOptions"
        :key="shape.tool"
        class="sketch-float-btn"
        :class="{ 'sketch-float-btn--active': activeTool === shape.tool }"
        :title="t(shape.labelKey)"
        :data-tool="shape.tool"
        @click="$emit('selectTool', shape.tool)"
      >
        <IconParkIcon :name="shape.icon" />
      </button>
      <div class="sketch-float-divider" />
    </div>

    <!-- 2. 套索操作（仅在选择套索工具时显示） -->
    <div
      v-if="activeTool === 'lasso'"
      class="sketch-float-group"
    >
      <!-- 套索模式切换 -->
      <div class="sketch-float-mode-select">
        <button
          class="sketch-float-mode-btn"
          :class="{ 'sketch-float-mode-btn--active': lassoMode === 'freehand' }"
          :title="t('lassoModeFreehand')"
          @click="$emit('update:lassoMode', 'freehand')"
        >
          {{ t('lassoModeFreehand') }}
        </button>
        <button
          class="sketch-float-mode-btn"
          :class="{ 'sketch-float-mode-btn--active': lassoMode === 'box' }"
          :title="t('lassoModeBox')"
          @click="$emit('update:lassoMode', 'box')"
        >
          {{ t('lassoModeBox') }}
        </button>
      </div>
      <div class="sketch-float-divider" />
      <!-- 选区操作动作 -->
      <div
        ref="recolorWrapRef"
        class="sketch-float-action-wrap"
      >
        <button
          class="sketch-float-action-btn"
          :class="{ 'sketch-float-action-btn--active': showRecolorPopup }"
          :title="t('recolor')"
          @click="showRecolorPopup = !showRecolorPopup"
        >
          <IconParkIcon name="ColorFilter" />
          <span class="sketch-float-action-label">{{ t('recolor') }}</span>
        </button>
        <ColorPickerPopup
          v-if="showRecolorPopup"
          :modelValue="pendingRecolor ?? preset.color"
          :t="t"
          :themeMode="themeMode"
          :isPresetsOpen="showRecolorPresets"
          @update:modelValue="onRecolorPicked"
          @togglePresets="showRecolorPresets = !showRecolorPresets"
        />
        <div
          v-if="showRecolorPopup && showRecolorPresets"
          class="sketch-float-presets-below"
          :class="{ 'sketch-float-presets-below--theme-light': themeMode === 'light' }"
        >
          <PresetColorPalette
            :rainbowColors="rainbowPresetColors"
            :favoriteColors="favoriteColors"
            :activeColor="pendingRecolor ?? preset.color"
            :currentColor="pendingRecolor ?? preset.color"
            :t="t"
            @select="onRecolorPicked"
            @setFavorite="setFavoriteColor"
            @deleteFavorite="deleteFavoriteColor"
          />
        </div>
      </div>
      <button
        class="sketch-float-action-btn"
        :title="t('duplicateSelection')"
        @click="$emit('duplicateSelection')"
      >
        <IconParkIcon name="Copy" />
        <span class="sketch-float-action-label">{{ t('duplicateSelection') }}</span>
      </button>
      <button
        class="sketch-float-action-btn"
        :title="t('deleteSelection')"
        @click="$emit('deleteSelection')"
      >
        <IconParkIcon name="Delete" />
        <span class="sketch-float-action-label">{{ t('deleteSelection') }}</span>
      </button>
    </div>

    <!-- 3. 橡配擦模式切换（仅在橡皮擦模式下显示） -->
    <div
      v-if="activeTool === 'eraser'"
      class="sketch-float-group"
    >
      <div class="sketch-float-mode-select">
        <button
          class="sketch-float-mode-btn"
          :class="{ 'sketch-float-mode-btn--active': preset.mode === 'pixel' }"
          :title="t('eraserModePixel')"
          @click="$emit('updatePreset', { mode: 'pixel' })"
        >
          {{ t('eraserModePixel') }}
        </button>
        <button
          class="sketch-float-mode-btn"
          :class="{ 'sketch-float-mode-btn--active': preset.mode === 'stroke' }"
          :title="t('eraserModeStroke')"
          @click="$emit('updatePreset', { mode: 'stroke' })"
        >
          {{ t('eraserModeStroke') }}
        </button>
      </div>
      <div class="sketch-float-divider" />
    </div>

    <!-- 4. 颜色调色盘（画笔、荧光笔、图形工具需要） -->
    <div
      v-if="hasColorPalette"
      class="sketch-float-group sketch-float-colors"
    >
      <!-- 可滑动查看区域 -->
      <div
        ref="colorsScrollRef"
        class="sketch-float-colors-scroll"
      >
        <button
          v-for="c in colors"
          :key="c"
          class="sketch-float-color"
          :class="{ 'sketch-float-color--active': preset.color === c }"
          :style="{ backgroundColor: c }"
          :title="`${c} (${t('deleteColorHint')})`"
          @click="onColorClick(c, $event)"
          @pointerdown.stop.prevent="onColorPointerDown(c, $event)"
          @pointerup.stop.prevent="onColorPointerEnd"
          @pointercancel="onColorPointerEnd"
          @pointerleave="onColorPointerEnd"
          @pointermove.stop.prevent="onColorPointerMove"
          @contextmenu.prevent="$emit('deleteColor', c)"
        >
          <span
            v-if="preset.color === c"
            class="sketch-float-color-dot"
          />
        </button>
      </div>

      <!-- 自定义颜色与恢复默认按钮 -->
      <div
        ref="addColorWrapRef"
        class="sketch-float-colors-actions"
      >
        <button
          class="sketch-float-color-picker"
          :class="{ 'sketch-float-color-picker--open': showAddColorPopup }"
          :title="t('addColor')"
          @click="showAddColorPopup = !showAddColorPopup"
        >
          <span class="plus-icon">+</span>
        </button>
        <ColorPickerPopup
          v-if="showAddColorPopup"
          :modelValue="pendingAddColor ?? preset.color"
          :t="t"
          :themeMode="themeMode"
          :isPresetsOpen="showAddPresets"
          @update:modelValue="onCustomColorPicked"
          @togglePresets="showAddPresets = !showAddPresets"
        />
        <div
          v-if="showAddColorPopup && showAddPresets"
          class="sketch-float-presets-below"
          :class="{ 'sketch-float-presets-below--theme-light': themeMode === 'light' }"
        >
          <PresetColorPalette
            :rainbowColors="rainbowPresetColors"
            :favoriteColors="favoriteColors"
            :activeColor="pendingAddColor ?? preset.color"
            :currentColor="pendingAddColor ?? preset.color"
            :t="t"
            @select="onCustomColorPicked"
            @setFavorite="setFavoriteColor"
            @deleteFavorite="deleteFavoriteColor"
          />
        </div>
        <button
          class="sketch-float-reset-btn"
          :title="t('resetDefaultColors')"
          @click="$emit('resetDefaultColors')"
        >
          <IconParkIcon name="Refresh" />
        </button>
      </div>
      <div class="sketch-float-divider" />
    </div>

    <!-- 5. 粗细调节（三个常用粗细小圆点 + 滑动条） -->
    <div
      v-if="hasStrokeControls"
      ref="widthControlRef"
      class="sketch-float-group sketch-float-widths"
    >
      <div class="sketch-float-widths-presets">
        <button
          v-for="sz in widthPresets"
          :key="sz.val"
          class="sketch-float-width-circle"
          :class="{ 'sketch-float-width-circle--active': preset.width === sz.val }"
          :title="`${sz.label}: ${sz.val}px`"
          @click="$emit('updatePreset', { width: sz.val })"
        >
          <span
            class="sketch-float-width-dot"
            :style="{ width: `${sz.dotSize}px`, height: `${sz.dotSize}px` }"
          />
        </button>
      </div>
      <!-- 精细调节触发器与面板 -->
      <button
        class="sketch-float-slider-toggle"
        :class="{ 'sketch-float-slider-toggle--active': showWidthSlider }"
        @click="showWidthSlider = !showWidthSlider"
      >
        <IconParkIcon :name="activeTool === 'text' ? 'FontSize' : 'AutoLineWidth'" />
        <span class="sketch-val-text">{{ preset.width }}px</span>
      </button>

      <div
        v-if="showWidthSlider"
        class="sketch-float-slider-popover"
      >
        <div class="sketch-float-slider-header">
          <span>{{ activeTool === 'text' ? t('fontSize') : t('width') }}: {{ preset.width }}px</span>
        </div>
        <input
          type="range"
          :min="activeTool === 'text' ? 12 : 1"
          :max="activeTool === 'text' ? 48 : 30"
          :value="preset.width"
          @input="emitWidth(($event.target as HTMLInputElement).value)"
        >
      </div>
      <div
        v-if="hasOpacityControl"
        class="sketch-float-divider"
      />
    </div>

    <!-- 6. 透明度调节（仅在支持透明度调节时显示） -->
    <div
      v-if="hasOpacityControl"
      ref="opacityControlRef"
      class="sketch-float-group sketch-float-opacity"
    >
      <button
        class="sketch-float-slider-toggle"
        :class="{ 'sketch-float-slider-toggle--active': showOpacitySlider }"
        @click="showOpacitySlider = !showOpacitySlider"
      >
        <IconParkIcon name="Water" />
        <span class="sketch-val-text">{{ Math.round(preset.opacity * 100) }}%</span>
      </button>

      <div
        v-if="showOpacitySlider"
        class="sketch-float-slider-popover"
      >
        <div class="sketch-float-slider-header">
          <span>{{ t('opacity') }}: {{ Math.round(preset.opacity * 100) }}%</span>
        </div>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.05"
          :value="preset.opacity"
          @input="emitOpacity(($event.target as HTMLInputElement).value)"
        >
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import type { ToolPreset } from "@/types/sketch";
import type { EditorTool } from "./tools";
import IconParkIcon from "./IconParkIcon.vue";
import ColorPickerPopup from "./ColorPickerPopup.vue";
import PresetColorPalette from "./PresetColorPalette.vue";
import type { IconParkName } from "./iconParkIcons";
import { createColorLongPressState, shouldCancelColorLongPress, shouldSwallowColorClick } from "./colorLongPress";
import { isShapeEditorTool } from "./tools";

const props = defineProps<{
  activeTool: EditorTool;
  colors: readonly string[];
  favoriteColors: readonly (string | null)[];
  lassoMode: "freehand" | "box";
  preset: ToolPreset;
  t: (key: string) => string;
  themeMode: 'light' | 'dark';
  replayActive?: boolean;
}>();

const emit = defineEmits<{
  (e: "deleteSelection"): void;
  (e: "duplicateSelection"): void;
  (e: "recolorSelection", color: string): void;
  (e: "selectColor", color: string): void;
  (e: "selectCustomColor", color: string): void;
  (e: "selectTool", tool: EditorTool): void;
  (e: "update:lassoMode", value: "freehand" | "box"): void;
  (e: "updatePreset", patch: Partial<Omit<ToolPreset, "tool">>): void;
  (e: "deleteColor", color: string): void;
  (e: "setFavoriteColor", index: number, color: string): void;
  (e: "deleteFavoriteColor", index: number): void;
  (e: "resetDefaultColors"): void;
}>();

// ── 拖拽状态与逻辑 ──
const panelRef = ref<HTMLDivElement>();
const dragHandleRef = ref<HTMLDivElement>();
const widthControlRef = ref<HTMLDivElement>();
const opacityControlRef = ref<HTMLDivElement>();
const addColorWrapRef = ref<HTMLDivElement>();
const recolorWrapRef = ref<HTMLDivElement>();
const pos = ref({ left: 20, top: 150 });
let dragStartOffset = { x: 0, y: 0 };
let isDragging = false;

watch(
  dragHandleRef,
  (handle, _oldHandle, onCleanup) => {
    if (!handle) return;
    handle.addEventListener("touchstart", onDragStart, { passive: false });
    onCleanup(() => {
      handle.removeEventListener("touchstart", onDragStart);
    });
  },
  { immediate: true },
);

function onDragStart(e: MouseEvent | TouchEvent) {
  isDragging = true;
  const clientX = e instanceof MouseEvent ? e.clientX : e.touches[0].clientX;
  const clientY = e instanceof MouseEvent ? e.clientY : e.touches[0].clientY;

  dragStartOffset = {
    x: clientX - pos.value.left,
    y: clientY - pos.value.top,
  };

  window.addEventListener("mousemove", onDragging);
  window.addEventListener("touchmove", onDragging, { passive: false });
  window.addEventListener("mouseup", onDragEnd);
  window.addEventListener("touchend", onDragEnd, { passive: true });
}

function onDragging(e: MouseEvent | TouchEvent) {
  if (!isDragging) return;
  if (e instanceof TouchEvent) {
    e.preventDefault();
  }
  const clientX = e instanceof MouseEvent ? e.clientX : e.touches[0].clientX;
  const clientY = e instanceof MouseEvent ? e.clientY : e.touches[0].clientY;

  let newLeft = clientX - dragStartOffset.x;
  let newTop = clientY - dragStartOffset.y;

  if (panelRef.value) {
    const parent = panelRef.value.offsetParent as HTMLElement;
    const parentWidth = parent ? parent.clientWidth : window.innerWidth;
    const parentHeight = parent ? parent.clientHeight : window.innerHeight;
    const panelWidth = panelRef.value.offsetWidth;
    const panelHeight = panelRef.value.offsetHeight;

    newLeft = Math.max(10, Math.min(parentWidth - panelWidth - 10, newLeft));
    newTop = Math.max(10, Math.min(parentHeight - panelHeight - 10, newTop));
  }

  pos.value = { left: newLeft, top: newTop };
}

function onDragEnd() {
  if (isDragging) {
    isDragging = false;
    window.removeEventListener("mousemove", onDragging);
    window.removeEventListener("touchmove", onDragging);
    window.removeEventListener("mouseup", onDragEnd);
    window.removeEventListener("touchend", onDragEnd);

    localStorage.setItem("sketch-note-float-pos", JSON.stringify(pos.value));
  }
}

// ── 调色盘滑动机制打磨（新追加颜色自动下滑滚动至底端完整可见） ──
const colorsScrollRef = ref<HTMLDivElement>();

watch(
  () => props.colors,
  (newColors, oldColors) => {
    // 仅在新增颜色（追加）时触发自动平滑向下滚动到底部
    if (newColors.length > (oldColors ? oldColors.length : 0)) {
      nextTick(() => {
        if (colorsScrollRef.value) {
          colorsScrollRef.value.scrollTo({
            top: colorsScrollRef.value.scrollHeight,
            behavior: "smooth",
          });
        }
      });
    }
  },
  { deep: true },
);

// ── 移动端长按手势删除颜色 ──
let colorLongPressTimer: ReturnType<typeof setTimeout> | null = null;
let colorLongPressStartPoint: { x: number; y: number } | null = null;
let activeColorPointerId: number | null = null;
const colorLongPressState = createColorLongPressState();

function onColorPointerDown(c: string, e: PointerEvent) {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  colorLongPressState.didLongPressDelete = false;
  activeColorPointerId = e.pointerId;
  colorLongPressStartPoint = { x: e.clientX, y: e.clientY };
  if (colorLongPressTimer) {
    clearTimeout(colorLongPressTimer);
  }
  colorLongPressTimer = setTimeout(() => {
    emit("deleteColor", c);
    colorLongPressState.didLongPressDelete = true;
    colorLongPressTimer = null;
  }, 600);
}

function onColorPointerEnd() {
  if (colorLongPressTimer) {
    clearTimeout(colorLongPressTimer);
    colorLongPressTimer = null;
  }
  colorLongPressStartPoint = null;
  activeColorPointerId = null;
}

function onColorPointerMove(e: PointerEvent) {
  if (!colorLongPressTimer || !colorLongPressStartPoint || activeColorPointerId !== e.pointerId) return;
  if (shouldCancelColorLongPress(colorLongPressStartPoint, { x: e.clientX, y: e.clientY })) {
    clearTimeout(colorLongPressTimer);
    colorLongPressTimer = null;
    colorLongPressStartPoint = null;
    activeColorPointerId = null;
  }
}

function onColorClick(c: string, e: MouseEvent) {
  if (shouldSwallowColorClick(colorLongPressState)) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  emit("selectColor", c);
}

// ── 粗细与透明度 Slider 控制 ──
const showWidthSlider = ref(false);
const showOpacitySlider = ref(false);
const showAddColorPopup = ref(false);
const showRecolorPopup = ref(false);
const showAddPresets = ref(false);
const showRecolorPresets = ref(false);
const pendingAddColor = ref<string | null>(null);
const pendingRecolor = ref<string | null>(null);

watch(showAddColorPopup, (open, wasOpen) => {
  if (open) {
    pendingAddColor.value = props.preset.color;
  } else {
    showAddPresets.value = false;
    if (wasOpen && pendingAddColor.value) {
      emit("selectCustomColor", pendingAddColor.value);
      pendingAddColor.value = null;
    }
  }
});

watch(showRecolorPopup, (open, wasOpen) => {
  if (open) {
    pendingRecolor.value = props.preset.color;
  } else {
    showRecolorPresets.value = false;
    if (wasOpen && pendingRecolor.value) {
      emit("recolorSelection", pendingRecolor.value);
      pendingRecolor.value = null;
    }
  }
});

function closeFloatingPopoversOnOutsidePointerDown(e: PointerEvent) {
  const target = e.target as Node;
  if (showWidthSlider.value && widthControlRef.value && !widthControlRef.value.contains(target)) {
    showWidthSlider.value = false;
  }
  if (showOpacitySlider.value && opacityControlRef.value && !opacityControlRef.value.contains(target)) {
    showOpacitySlider.value = false;
  }
  if (showAddColorPopup.value && addColorWrapRef.value) {
    const presetsEl = addColorWrapRef.value.querySelector(".sketch-float-presets-below");
    if (!addColorWrapRef.value.contains(target) && !(presetsEl && presetsEl.contains(target))) {
      showAddColorPopup.value = false;
      showAddPresets.value = false;
    }
  }
  if (showRecolorPopup.value && recolorWrapRef.value) {
    const presetsEl = recolorWrapRef.value.querySelector(".sketch-float-presets-below");
    if (!recolorWrapRef.value.contains(target) && !(presetsEl && presetsEl.contains(target))) {
      showRecolorPopup.value = false;
      showRecolorPresets.value = false;
    }
  }
}

function onCustomColorPicked(color: string) {
  pendingAddColor.value = color;
}

function onRecolorPicked(color: string) {
  pendingRecolor.value = color;
}

function setFavoriteColor(index: number, color: string) {
  emit("setFavoriteColor", index, color);
}

function deleteFavoriteColor(index: number) {
  emit("deleteFavoriteColor", index);
}

const widthPresets = computed(() => {
  /** 根据实际粗细值计算 UI 圆点大小（px），限制在 3-14 范围内 */
  const dot = (val: number) => Math.min(14, Math.max(3, Math.round(val * 1.5)));

  if (props.activeTool === "pen") {
    const subtype = props.preset.penSubtype ?? "ballpoint";
    switch (subtype) {
      case "pencil":
        return [
          { val: 1, dotSize: 3, label: props.t("sizeThin") },
          { val: 2, dotSize: 3, label: props.t("sizeMedium") },
          { val: 4, dotSize: 6, label: props.t("sizeThick") },
        ];
      case "ballpoint":
        return [
          { val: 1, dotSize: 3, label: props.t("sizeThin") },
          { val: 1.5, dotSize: 3, label: props.t("sizeMedium") },
          { val: 3, dotSize: 5, label: props.t("sizeThick") },
        ];
      case "fountain":
        return [
          { val: 1, dotSize: 3, label: props.t("sizeThin") },
          { val: 2, dotSize: 3, label: props.t("sizeMedium") },
          { val: 5, dotSize: 8, label: props.t("sizeThick") },
        ];
      case "brush":
        return [
          { val: 1, dotSize: 3, label: props.t("sizeThin") },
          { val: 3, dotSize: 5, label: props.t("sizeMedium") },
          { val: 8, dotSize: 12, label: props.t("sizeThick") },
        ];
      default:
        return [
          { val: 2, dotSize: 3, label: props.t("sizeThin") },
          { val: 6, dotSize: 9, label: props.t("sizeMedium") },
          { val: 12, dotSize: 14, label: props.t("sizeThick") },
        ];
    }
  } else if (props.activeTool === "highlighter") {
    return [
      { val: 8, dotSize: 4, label: props.t("sizeThin") },
      { val: 18, dotSize: 9, label: props.t("sizeMedium") },
      { val: 28, dotSize: 14, label: props.t("sizeThick") },
    ];
  } else if (props.activeTool === "eraser") {
    return [
      { val: 10, dotSize: 5, label: props.t("sizeThin") },
      { val: 20, dotSize: 10, label: props.t("sizeMedium") },
      { val: 30, dotSize: 15, label: props.t("sizeThick") },
    ];
  } else if (props.activeTool === "text") {
    return [
      { val: 14, dotSize: 4, label: props.t("sizeSmall") },
      { val: 20, dotSize: 7, label: props.t("sizeMedium") },
      { val: 28, dotSize: 11, label: props.t("sizeLarge") },
    ];
  } else {
    return [
      { val: 2, dotSize: 3, label: props.t("sizeThin") },
      { val: 6, dotSize: 9, label: props.t("sizeMedium") },
      { val: 12, dotSize: 14, label: props.t("sizeThick") },
    ];
  }
});

function emitWidth(value: string) {
  emit("updatePreset", { width: Number(value) });
}

function emitOpacity(value: string) {
  emit("updatePreset", { opacity: Number(value) });
}

const isVisible = computed(() => {
  const toolsToShow: EditorTool[] = ["pen", "highlighter", "eraser", "lasso", "text"];
  return toolsToShow.includes(props.activeTool) || isShapeEditorTool(props.activeTool);
});

const isShapeMode = computed(() => isShapeEditorTool(props.activeTool));

const hasColorPalette = computed(() => {
  return props.activeTool === "pen" || props.activeTool === "highlighter" || props.activeTool === "text" || isShapeMode.value;
});

const hasStrokeControls = computed(() => {
  return props.activeTool !== "lasso";
});

const hasOpacityControl = computed(() => {
  return props.activeTool !== "eraser" && props.activeTool !== "lasso";
});

const rainbowPresetColors = [
  "#000000",
  "#ffffff",
  "#ff3b30",
  "#ff9500",
  "#ffcc00",
  "#34c759",
  "#00c7be",
  "#007aff",
  "#5856d6",
  "#af52de",
  "#ff2d55",
  "#5ac8fa",
  "#30d158",
  "#bf5af2",
] as const;

const shapeOptions = [
  { tool: "line", labelKey: "line", icon: "Minus" },
  { tool: "arrow", labelKey: "arrow", icon: "ArrowRight" },
  { tool: "rectangle", labelKey: "rectangle", icon: "Rectangle" },
  { tool: "ellipse", labelKey: "ellipse", icon: "Round" },
  { tool: "triangle", labelKey: "triangle", icon: "Triangle" },
] as const satisfies readonly {
  tool: EditorTool;
  labelKey: string;
  icon: IconParkName;
}[];

onMounted(() => {
  document.addEventListener("pointerdown", closeFloatingPopoversOnOutsidePointerDown, true);
  try {
    const cached = localStorage.getItem("sketch-note-float-pos");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (typeof parsed.left === "number" && typeof parsed.top === "number") {
        pos.value = parsed;
      }
    }
  } catch (e) {
    console.error("加载浮动面板缓存位置失败:", e);
  }
});

onUnmounted(() => {
  document.removeEventListener("pointerdown", closeFloatingPopoversOnOutsidePointerDown, true);
  window.removeEventListener("mousemove", onDragging);
  window.removeEventListener("touchmove", onDragging);
  window.removeEventListener("mouseup", onDragEnd);
  window.removeEventListener("touchend", onDragEnd);
});
</script>

<style scoped>
/* 悬浮面板基础样式：深色玻璃态，垂直修长，质感 premium */
.sketch-float-panel {
  position: absolute;
  z-index: 1000;
  width: 56px;
  background: var(--sketch-toolbar-surface);
  backdrop-filter: blur(14px) saturate(160%);
  -webkit-backdrop-filter: blur(14px) saturate(160%);
  border: 1px solid var(--sketch-toolbar-border);
  border-radius: 20px;
  box-shadow: var(--sketch-toolbar-shadow);
  padding: 10px 6px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  user-select: none;
  transition: box-shadow 0.2s ease;
}

.sketch-float-panel:hover {
  box-shadow: var(--sketch-toolbar-hover-shadow);
}

.sketch-float-panel--replay {
  pointer-events: none;
}

.sketch-float-panel--replay-click {
  animation: sketch-replay-click 250ms cubic-bezier(0.25, 0.8, 0.25, 1);
}

/* 拖拽手柄：置于面板顶部，设计为极简的小圆点/横杠，增强仪式感 */
.sketch-float-panel__handle {
  width: 100%;
  height: 12px;
  cursor: move;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 2px;
  padding-bottom: 4px;
}
.sketch-float-panel__handle-dot {
  width: 14px;
  height: 2px;
  border-radius: 1px;
  background: var(--sketch-toolbar-hover-border);
  transition: background-color 0.2s ease;
}
.sketch-float-panel__handle:hover .sketch-float-panel__handle-dot {
  background: var(--sketch-toolbar-muted-text);
}

/* 分割线 */
.sketch-float-divider {
  width: 32px;
  height: 1px;
  background: var(--sketch-toolbar-separator);
  margin: 6px 0;
}

/* 模块化排布组 */
.sketch-float-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  gap: 6px;
}

/* 一致的悬浮面板控制按钮样式 */
.sketch-float-btn {
  width: 36px;
  height: 36px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--sketch-toolbar-text);
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
  outline: none;
}
.sketch-float-btn:hover {
  background: var(--sketch-toolbar-separator);
  color: var(--sketch-toolbar-strong-text);
  transform: scale(1.05);
}
.sketch-float-btn:active {
  transform: scale(0.92);
}
.sketch-float-btn--active {
  background: var(--b3-theme-primary) !important;
  color: var(--sketch-toolbar-strong-text) !important;
  box-shadow: var(--sketch-toolbar-active-shadow);
  border-color: var(--sketch-toolbar-separator);
}
.sketch-float-btn--replay-click {
  animation: sketch-replay-click 250ms cubic-bezier(0.25, 0.8, 0.25, 1);
}

/* 模式切换：像素/整笔，自由/框选 等 */
.sketch-float-mode-select {
  display: flex;
  flex-direction: column;
  gap: 3px;
  background: var(--sketch-toolbar-control-bg);
  padding: 2px;
  border-radius: 8px;
  border: 1px solid var(--sketch-toolbar-control-bg);
}
.sketch-float-mode-btn {
  width: 38px;
  height: 22px;
  border: none;
  background: transparent;
  color: var(--sketch-toolbar-muted-text);
  border-radius: 6px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
  padding: 0;
  line-height: 22px;
  text-align: center;
}
.sketch-float-mode-btn:hover {
  color: var(--sketch-toolbar-strong-text);
}
.sketch-float-mode-btn--active {
  background: var(--sketch-toolbar-hover-border);
  color: var(--sketch-toolbar-strong-text);
  font-weight: 500;
}

/* 套索高级操作动作按钮，如复制、删除 */
.sketch-float-action-btn {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid var(--sketch-toolbar-control-border);
  background: var(--sketch-toolbar-control-bg);
  color: var(--sketch-toolbar-text);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.2s ease;
  padding: 0;
}
.sketch-float-action-btn:hover {
  background: var(--sketch-toolbar-hover-bg);
  transform: scale(1.05);
  border-color: var(--sketch-toolbar-hover-border);
}
.sketch-float-action-btn:active {
  transform: scale(0.92);
}
.sketch-float-action-btn--active {
  background: var(--sketch-toolbar-hover-border) !important;
  border-color: var(--sketch-toolbar-hover-border) !important;
  color: var(--sketch-toolbar-strong-text) !important;
}
.sketch-float-action-label {
  font-size: 8px;
  color: var(--sketch-toolbar-muted-text);
  margin-top: 1px;
  transform: scale(0.9);
  max-width: 34px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 4. 颜色控制与滑动面板 */
.sketch-float-colors {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

/* 颜色滑动查看滚动条 */
.sketch-float-colors-scroll {
  max-height: 140px; /* 约 5 个颜色按钮的高度，超出后可上下流畅滑动 */
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
  scrollbar-width: none; /* Firefox 隐藏滚动条 */
}
.sketch-float-colors-scroll::-webkit-scrollbar {
  display: none; /* Chrome/Safari 隐藏滚动条 */
}

.sketch-float-color {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid var(--sketch-toolbar-hover-bg);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  box-sizing: border-box;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
  flex-shrink: 0; /* 必须，防滑动时被压缩 */
}
.sketch-float-color:hover {
  transform: scale(1.15);
  border-color: var(--sketch-toolbar-muted-text);
}
.sketch-float-color--active {
  border-color: var(--sketch-toolbar-strong-text) !important;
  transform: scale(1.1);
  box-shadow: 0 0 8px var(--sketch-toolbar-hover-border);
}
.sketch-float-color-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--sketch-toolbar-strong-text);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
}

/* 自定义与重置按钮改为垂直垂直排列，更加符合垂直浮动条美学 */
.sketch-float-colors-actions {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin-top: 4px;
}

.sketch-float-color-picker {
  position: relative;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1px dashed var(--sketch-toolbar-muted-text);
  color: var(--sketch-toolbar-muted-text);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.2s ease;
  box-sizing: border-box;
  overflow: hidden;
  background: var(--sketch-toolbar-control-bg);
}
.sketch-float-color-picker:hover,
.sketch-float-color-picker--open {
  border-color: var(--sketch-toolbar-strong-text);
  color: var(--sketch-toolbar-strong-text);
  transform: scale(1.1);
  background: var(--sketch-toolbar-control-border);
}
.sketch-float-color-picker .plus-icon {
  margin-top: -1px;
}

/* 恢复默认颜色按钮 */
.sketch-float-reset-btn {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1px solid var(--sketch-toolbar-hover-border);
  background: var(--sketch-toolbar-control-bg);
  color: var(--sketch-toolbar-muted-text);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  transition: all 0.2s ease;
  padding: 0;
  box-sizing: border-box;
}
.sketch-float-reset-btn:hover {
  border-color: var(--sketch-toolbar-strong-text);
  color: var(--sketch-toolbar-strong-text);
  background: var(--sketch-toolbar-hover-bg);
  transform: scale(1.1);
}
.sketch-float-reset-btn:active {
  transform: scale(0.9);
}

.sketch-float-action-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* 5. 粗细调节面板 */
.sketch-float-widths {
  position: relative;
}
.sketch-float-widths-presets {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sketch-float-width-circle {
  width: 28px;
  height: 28px;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}
.sketch-float-width-circle:hover {
  background: var(--sketch-toolbar-control-border);
}
.sketch-float-width-circle--active {
  background: var(--sketch-toolbar-hover-bg) !important;
  border-color: var(--sketch-toolbar-hover-border) !important;
}
.sketch-float-width-dot {
  border-radius: 50%;
  background: var(--sketch-toolbar-strong-text);
  box-shadow: 0 1px 2px rgba(0,0,0,0.3);
}

/* 精细调节触点与浮窗 */
.sketch-float-slider-toggle {
  background: var(--sketch-toolbar-control-bg);
  border: 1px solid var(--sketch-toolbar-control-bg);
  border-radius: 8px;
  color: var(--sketch-toolbar-muted-text);
  font-size: 11px;
  padding: 4px 2px;
  width: 38px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  margin-top: 4px;
  transition: all 0.2s ease;
}
.sketch-float-toggle-text {
  font-size: 9px;
  font-weight: 500;
}
.sketch-float-slider-toggle:hover {
  color: var(--sketch-toolbar-strong-text);
  background: var(--sketch-toolbar-border);
  border-color: var(--sketch-toolbar-hover-border);
}
.sketch-float-slider-toggle--active {
  color: var(--sketch-toolbar-strong-text);
  background: var(--b3-theme-primary);
  border-color: transparent;
}
.sketch-val-text {
  font-size: 9px;
  font-weight: 500;
  transform: scale(0.95);
}

.sketch-float-slider-popover {
  position: absolute;
  left: 62px;
  bottom: 0;
  background: var(--sketch-toolbar-popover-surface);
  backdrop-filter: blur(10px);
  border: 1px solid var(--sketch-toolbar-hover-bg);
  border-radius: 12px;
  padding: 8px 10px;
  box-shadow: var(--sketch-toolbar-shadow);
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 140px;
  z-index: 1001;
}
.sketch-float-slider-header {
  font-size: 11px;
  color: var(--sketch-toolbar-text);
  display: flex;
  justify-content: space-between;
}
.sketch-float-slider-popover input[type="range"] {
  width: 100%;
  margin: 4px 0;
  cursor: pointer;
  accent-color: var(--b3-theme-primary);
}

/* 6. 透明度面板 */
.sketch-float-opacity {
  position: relative;
}

/* 预置颜色面板：弹窗下方展开 */
.sketch-float-presets-below {
  position: absolute;
  left: calc(100% + 8px);
  top: 100%;
  width: 216px;
  z-index: 1000;
  background: rgba(28, 28, 30, 0.94);
  backdrop-filter: blur(16px) saturate(150%);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 12px;
  padding: 12px;
  box-sizing: border-box;
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.34), 0 2px 8px rgba(0, 0, 0, 0.18);
}

.sketch-float-presets-below--theme-light {
  background: rgba(255, 255, 255, 0.96);
  border-color: rgba(15, 23, 42, 0.1);
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.14), 0 2px 8px rgba(15, 23, 42, 0.08);
}
</style>

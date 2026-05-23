<template>
  <div v-if="visible" class="sketch-editor">
    <div class="sketch-editor__header">
      <button class="sketch-editor__back" @click="goBack">← {{ t("back") }}</button>
      <select class="sketch-editor__template-select" v-model="currentTemplate">
        <option v-for="tpl in templates" :key="tpl.id" :value="tpl.id">{{ t(tpl.nameKey) }}</option>
      </select>
      <span class="sketch-editor__title">{{ t("sketchNote") }}</span>
      <button class="sketch-editor__save" @click="doSave">{{ t("save") }}</button>
    </div>
    <div class="sketch-editor__body">
      <SketchCanvas
        ref="canvasRef"
        :initialData="loadedData"
        :tool="activeTool"
        :color="activeColor"
        @update:canUndo="canUndo = $event"
        @update:canRedo="canRedo = $event"
        @heightChanged="onHeightChanged"
      />
    </div>
    <SketchToolbar
      :modelColor="activeColor"
      :modelTool="activeTool"
      :canUndo="canUndo"
      :canRedo="canRedo"
      @update:modelColor="activeColor = $event"
      @update:modelTool="activeTool = $event"
      @undo="canvasRef?.doUndo()"
      @redo="canvasRef?.doRedo()"
      @clear="canvasRef?.doClear()"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import type { SketchData, SketchTool } from "@/types/sketch";
import { PRESET_COLORS } from "@/types/sketch";
import { getAllTemplates } from "@/template";
import { thumbnailCanvas } from "@/storage/thumbnail";
import SketchCanvas from "./SketchCanvas.vue";
import SketchToolbar from "./SketchToolbar.vue";

const props = defineProps<{
  blockId: string;
  initialData: SketchData | null;
  i18n: Record<string, string>;
  saveData: (key: string, data: any) => Promise<void>;
}>();

const emit = defineEmits<{ (e: "close"): void }>();

function t(key: string): string { return props.i18n[key] ?? key; }

const visible = ref(false);
const canvasRef = ref<InstanceType<typeof SketchCanvas>>();
const activeTool = ref<SketchTool>("pen");
const activeColor = ref(PRESET_COLORS[0]);
const canUndo = ref(false);
const canRedo = ref(false);
const currentTemplate = ref(props.initialData?.template ?? "blank");
const templates = getAllTemplates();
const loadedData = ref<SketchData | null>(props.initialData);

onMounted(() => {
  visible.value = true;
  document.body.style.overflow = "hidden";
});

async function doSave() {
  if (!canvasRef.value) return;
  const data = canvasRef.value.getData();
  data.thumbnail = thumbnailCanvas(data.strokes, data.template, data.canvasHeight);
  data.template = currentTemplate.value;
  const key = `sketch:${props.blockId}`;
  await props.saveData(key, data);
  document.body.style.overflow = "";
  emit("close");
}

async function goBack() { await doSave(); }

function onHeightChanged(_height: number) {
  // Auto-scroll handled by overflow-y: auto on .sketch-editor__body
}
</script>

<style scoped>
.sketch-editor {
  position: fixed; inset: 0; z-index: 999;
  background: var(--b3-theme-background);
  display: flex; flex-direction: column;
}
.sketch-editor__header {
  display: flex; align-items: center; gap: 12px;
  padding: 8px 16px;
  background: var(--b3-theme-surface);
  border-bottom: 1px solid var(--b3-border-color);
  flex-shrink: 0;
}
.sketch-editor__back, .sketch-editor__save {
  padding: 6px 12px; border-radius: 6px;
  border: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface); cursor: pointer; font-size: 14px;
}
.sketch-editor__save {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  border-color: var(--b3-theme-primary); margin-left: auto;
}
.sketch-editor__template-select {
  padding: 4px 8px; border-radius: 4px;
  border: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface); font-size: 13px;
}
.sketch-editor__title { font-weight: 500; font-size: 15px; color: var(--b3-theme-on-surface); }
.sketch-editor__body {
  flex: 1; overflow-y: auto; padding: 16px 0 60px; touch-action: none;
}
</style>

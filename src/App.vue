<template>
  <SketchEditor
    v-if="editorVisible"
    :blockId="editorBlockId"
    :initialData="editorData"
    :i18n="pluginI18n"
    :saveData="pluginSaveData"
    @close="closeEditor"
  />
</template>

<script lang="ts">
import { ref } from "vue";
import { loadSketchData } from "@/storage";
import SketchEditor from "@/editor/SketchEditor.vue";

const editorVisible = ref(false);
const editorBlockId = ref("");
const editorData = ref<any>(null);
const pluginI18n = ref<Record<string, string>>({});
const pluginSaveData = ref<(key: string, data: any) => Promise<void>>(async () => {});

let loadDataFn: (key: string) => Promise<any> = async () => null;

export function setI18n(i18n: Record<string, string>) {
  pluginI18n.value = i18n;
}

export function setSaveDataFn(fn: (key: string, data: any) => Promise<void>) {
  pluginSaveData.value = fn;
}

export function setLoadDataFn(fn: (key: string) => Promise<any>) {
  loadDataFn = fn;
}

export async function openSketchEditor(blockId: string) {
  editorBlockId.value = blockId;
  editorData.value = await loadSketchData(loadDataFn, blockId);
  editorVisible.value = true;
}

function closeEditor() {
  const savedBlockId = editorBlockId.value;
  editorVisible.value = false;
  editorBlockId.value = "";
  editorData.value = null;

  // Refresh the sketch-note image in the document to show updated content
  refreshSketchImage(savedBlockId);
}

/**
 * Force-refresh the displayed image for a sketch block.
 * Uses cache-busting to ensure the browser loads the updated PNG from assets.
 */
function refreshSketchImage(blockId: string) {
  const pattern = `sketch-note-${blockId}.png`;
  document.querySelectorAll("img").forEach((img) => {
    const dataSrc = img.getAttribute("data-src") || "";
    if (dataSrc.includes(pattern)) {
      // Append cache-busting timestamp to force reload
      const baseSrc = dataSrc.split("?")[0];
      img.src = `${baseSrc}?t=${Date.now()}`;
    }
  });
}

export default {
  components: { SketchEditor },
  setup() {
    return {
      editorVisible,
      editorBlockId,
      editorData,
      pluginI18n,
      pluginSaveData,
      closeEditor,
    };
  },
};
</script>

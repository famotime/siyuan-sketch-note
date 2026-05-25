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
import { ref, nextTick } from "vue";
import { showMessage } from "siyuan";
import { loadSketchData } from "@/storage";
import { normalizeEditorI18n } from "@/i18n/editorI18n";
import SketchEditor from "@/editor/SketchEditor.vue";

const editorVisible = ref(false);
const editorBlockId = ref("");
const editorData = ref<any>(null);
const pluginI18n = ref<Record<string, string>>({});
const pluginSaveData = ref<(key: string, data: any) => Promise<void>>(async () => {});

let loadDataFn: (key: string) => Promise<any> = async () => null;

export function setI18n(i18n: Record<string, string>) {
  pluginI18n.value = normalizeEditorI18n(i18n);
}

export function setSaveDataFn(fn: (key: string, data: any) => Promise<void>) {
  pluginSaveData.value = fn;
}

export function setLoadDataFn(fn: (key: string) => Promise<any>) {
  loadDataFn = fn;
}

export async function openSketchEditor(blockId: string) {
  editorBlockId.value = blockId;
  try {
    editorData.value = await loadSketchData(loadDataFn, blockId);
  } catch (e) {
    console.error("[Sketch Note] Failed to load sketch data:", e);
    showMessage(`Sketch Note: ${pluginI18n.value.loadFailed || "Data load failed"}`, 5000, "error");
    editorData.value = null;
  }
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
 * Uses nextTick + setTimeout to wait for Vue DOM update, then
 * force-fetches to bust HTTP cache and updates both data-src and src.
 */
function refreshSketchImage(blockId: string) {
  const pattern = `sketch-note-${blockId}.png`;

  // Wait for Vue DOM update (editor overlay removal) to complete
  nextTick(() => {
    setTimeout(() => {
      const imgs = document.querySelectorAll("img");
      let found = false;
      imgs.forEach((img) => {
        const dataSrc = img.getAttribute("data-src") || "";
        if (dataSrc.includes(pattern)) {
          found = true;
          const baseSrc = dataSrc.split("?")[0];
          const bustSrc = `${baseSrc}?t=${Date.now()}`;

          // Force browser HTTP cache refresh (like excalidraw approach)
          fetch(baseSrc, { cache: "reload" }).then(() => {
            img.setAttribute("data-src", bustSrc);
            img.src = bustSrc;
          }).catch(() => {
            // Still update src even if fetch fails
            img.setAttribute("data-src", bustSrc);
            img.src = bustSrc;
          });
        }
      });
      if (!found) {
        console.warn(`[Sketch Note] refreshSketchImage: no img found for pattern "${pattern}"`);
      }
    }, 100);
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

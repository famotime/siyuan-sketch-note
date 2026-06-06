import { createApp } from "vue";
import { openTab } from "siyuan";
import App, { setSaveDataFn, setLoadDataFn, pluginI18n, setOpenSketchInNewTabFn, refreshSketchImage } from "./App.vue";
import SketchEditor from "./editor/SketchEditor.vue";
import { loadSketchData } from "./storage";
import type { Plugin, Custom } from "siyuan";

const SKETCH_TAB_TYPE = "sketch-editor";

let app: ReturnType<typeof createApp> | null = null;
let container: HTMLDivElement | null = null;
let pluginInstance: Plugin | null = null;
let tabRegistered = false;
let currentTabApp: ReturnType<typeof createApp> | null = null;
let currentTabSketchId: string | null = null;

export function usePlugin(pluginProps?: Plugin): Plugin | undefined {
  if (pluginProps) {
    (window as any)._sketchNotePlugin = pluginProps;
  }
  return (window as any)._sketchNotePlugin;
}

function destroyTabApp() {
  if (currentTabApp) {
    currentTabApp.unmount();
    currentTabApp = null;
  }
  currentTabSketchId = null;
}

async function mountSketchEditor(container: HTMLElement, sketchId: string, plugin: Plugin) {
  console.log("[Sketch Note] mountSketchEditor: loading data for", sketchId);
  const data = await loadSketchData((key) => plugin.loadData(key), sketchId);
  console.log("[Sketch Note] mountSketchEditor: data loaded", data ? "OK" : "NULL");

  const tabApp = createApp(SketchEditor, {
    blockId: sketchId,
    initialData: data,
    i18n: pluginI18n.value,
    saveData: (key: string, val: any) => plugin.saveData(key, val),
    themeMode: "light",
    embedMode: true,
  });
  tabApp.mount(container);
  currentTabApp = tabApp;
  currentTabSketchId = sketchId;
  console.log("[Sketch Note] mountSketchEditor: mounted OK");
}

function registerSketchTab() {
  if (!pluginInstance || tabRegistered) return;

  const plugin = pluginInstance;

  pluginInstance.addTab({
    type: SKETCH_TAB_TYPE,
    init(this: Custom) {
      console.log("[Sketch Note] Tab init called, this.data =", this.data);
      const hostElement = this.element;
      if (!(hostElement instanceof HTMLElement)) return;

      hostElement.innerHTML = "";
      const container = document.createElement("div");
      container.style.height = "100%";
      container.style.width = "100%";
      container.style.position = "relative";
      hostElement.appendChild(container);

      const sketchId = this.data?.sketchId as string | undefined;
      if (!sketchId) {
        console.warn("[Sketch Note] Tab init: no sketchId in data");
        container.textContent = "No sketch ID.";
        return;
      }

      mountSketchEditor(container, sketchId, plugin).catch((err) => {
        console.error("[Sketch Note] mountSketchEditor failed", err);
      });
    },
    update(this: Custom) {
      console.log("[Sketch Note] Tab update called, this.data =", this.data);
      const sketchId = this.data?.sketchId as string | undefined;
      if (!sketchId || sketchId === currentTabSketchId) return;

      destroyTabApp();
      const hostElement = this.element;
      if (!(hostElement instanceof HTMLElement)) return;
      hostElement.innerHTML = "";
      const container = document.createElement("div");
      container.style.height = "100%";
      container.style.width = "100%";
      container.style.position = "relative";
      hostElement.appendChild(container);

      mountSketchEditor(container, sketchId, plugin).catch((err) => {
        console.error("[Sketch Note] mountSketchEditor (update) failed", err);
      });
    },
    destroy(this: Custom) {
      console.log("[Sketch Note] Tab destroy called");
      destroyTabApp();
    },
    beforeDestroy(this: Custom) {
      if (currentTabSketchId) {
        refreshSketchImage(currentTabSketchId);
      }
      destroyTabApp();
    },
  });

  tabRegistered = true;
}

export async function openSketchInNewTab(sketchId: string) {
  console.log("[Sketch Note] openSketchInNewTab called, sketchId =", sketchId);
  if (!pluginInstance) return;

  const customId = pluginInstance.name + SKETCH_TAB_TYPE;
  console.log("[Sketch Note] openSketchInNewTab: customId =", customId);
  try {
    await openTab({
      app: pluginInstance.app,
      custom: {
        id: customId,
        icon: "iconPencil",
        title: pluginI18n.value.editSketch || "Sketch Note",
        data: { sketchId },
      },
    });
  } catch (err) {
    console.error("[Sketch Note] openSketchInNewTab: openTab failed", err);
  }
}

export function init(plugin: Plugin) {
  pluginInstance = plugin;
  container = document.createElement("div");
  container.className = "sketch-note-app";
  document.body.appendChild(container);

  app = createApp(App);
  app.mount(container);

  setSaveDataFn((key, data) => plugin.saveData(key, data));
  setLoadDataFn((key) => plugin.loadData(key));
  setOpenSketchInNewTabFn(openSketchInNewTab);

  registerSketchTab();
}

export function destroy() {
  if (app) {
    app.unmount();
    app = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
  pluginInstance = null;
  tabRegistered = false;
}

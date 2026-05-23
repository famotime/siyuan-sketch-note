import { createApp } from "vue";
import App from "./App.vue";
import { setI18n, setSaveDataFn, setLoadDataFn } from "./App.vue";
import type { Plugin } from "siyuan";

let app: ReturnType<typeof createApp> | null = null;
let container: HTMLDivElement | null = null;

export function usePlugin(pluginProps?: Plugin): Plugin | undefined {
  if (pluginProps) {
    (window as any)._sketchNotePlugin = pluginProps;
  }
  return (window as any)._sketchNotePlugin;
}

export function init(plugin: Plugin) {
  container = document.createElement("div");
  container.className = "sketch-note-app";
  document.body.appendChild(container);

  app = createApp(App);
  app.mount(container);

  // Wire up plugin APIs to Vue app
  setSaveDataFn((key, data) => plugin.saveData(key, data));
  setLoadDataFn((key) => plugin.loadData(key));
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
}

import type { Ref } from "vue";
import { saveEditorPreferences } from "@/storage";

export function useEditorPreferences(ctx: {
  inputSettings: Ref<any>;
  currentTemplate: Ref<string>;
  customBackgrounds: Ref<any[]>;
  saveData: (key: string, data: any) => Promise<void>;
  markAndSchedule: () => void;
}) {
  function toggleStylusOnly() {
    ctx.inputSettings.value = {
      ...ctx.inputSettings.value,
      stylusOnly: !ctx.inputSettings.value.stylusOnly,
    };
    persistEditorPreferences();
    ctx.markAndSchedule();
  }

  function togglePressure() {
    ctx.inputSettings.value = {
      ...ctx.inputSettings.value,
      enablePressure: ctx.inputSettings.value.enablePressure === undefined ? false : !ctx.inputSettings.value.enablePressure,
    };
    persistEditorPreferences();
    ctx.markAndSchedule();
  }

  function onTemplateChange(value: string) {
    ctx.currentTemplate.value = value;
    persistEditorPreferences();
    ctx.markAndSchedule();
  }

  function persistEditorPreferences() {
    saveEditorPreferences(ctx.saveData, {
      template: ctx.currentTemplate.value,
      inputSettings: ctx.inputSettings.value,
      customBackgrounds: ctx.customBackgrounds.value,
    }).catch((e) => {
      console.error("[Sketch Note] Save editor preferences failed:", e);
    });
  }

  return { toggleStylusOnly, togglePressure, onTemplateChange, persistEditorPreferences };
}

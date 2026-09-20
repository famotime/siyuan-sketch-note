import { ref } from "vue";
import type { PenCursorStyle } from "@/storage/pluginSettings";

export const penCursorStyle = ref<PenCursorStyle>("crosshair");

export function setPenCursorStyle(style: PenCursorStyle) {
  penCursorStyle.value = style;
}

export function usePenCursorStyle() {
  return {
    penCursorStyle,
    setPenCursorStyle,
  };
}

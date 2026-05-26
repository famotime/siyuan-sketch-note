import { ref, computed } from "vue";
import type { Ref } from "vue";
import { PRESET_COLORS } from "@/types/sketch";
import { addRecentColor, appendRecentColor, normalizeToolColorPalettes } from "@/tools/palette";
import { showMessage } from "siyuan";
import type { EditorTool } from "@/editor/tools";

export function useColorPalettes(ctx: {
  activeTool: Ref<EditorTool>;
  colorPalettes: Ref<{ pen: string[]; highlighter: string[] }>;
  activePreset: Ref<any>;
  canvasRef: Ref<{ recolorLasso: (c: string) => void } | undefined>;
  t: (key: string) => string;
  markAndSchedule: () => void;
}) {
  const activeColor = ref(PRESET_COLORS[0]);

  const colors = computed(() => {
    if (ctx.activeTool.value === "highlighter") {
      return ctx.colorPalettes.value.highlighter;
    }
    return ctx.colorPalettes.value.pen;
  });

  function selectColor(c: string) {
    activeColor.value = c;
    if (ctx.activeTool.value === "eraser") {
      ctx.activeTool.value = "pen";
    }
  }

  function selectCustomColor(c: string) {
    activeColor.value = c;
    if (ctx.activeTool.value === "eraser") {
      ctx.activeTool.value = "pen";
    }
    if (ctx.activeTool.value === "highlighter") {
      ctx.colorPalettes.value = {
        ...ctx.colorPalettes.value,
        highlighter: appendRecentColor(ctx.colorPalettes.value.highlighter, c),
      };
    } else {
      ctx.colorPalettes.value = {
        ...ctx.colorPalettes.value,
        pen: appendRecentColor(ctx.colorPalettes.value.pen, c),
      };
    }
  }

  function recolorSelection(c: string) {
    ctx.canvasRef.value?.recolorLasso(c);
    ctx.colorPalettes.value = {
      ...ctx.colorPalettes.value,
      pen: addRecentColor(ctx.colorPalettes.value.pen, c),
    };
  }

  function deleteColor(color: string) {
    if (ctx.activeTool.value === "highlighter") {
      ctx.colorPalettes.value = {
        ...ctx.colorPalettes.value,
        highlighter: ctx.colorPalettes.value.highlighter.filter((c) => c !== color),
      };
    } else {
      ctx.colorPalettes.value = {
        ...ctx.colorPalettes.value,
        pen: ctx.colorPalettes.value.pen.filter((c) => c !== color),
      };
    }
    showMessage(ctx.t("colorDeleted") || "已删除该颜色", 3000, "info");

    if (ctx.activePreset.value.color === color) {
      const fallback = colors.value[0] ?? PRESET_COLORS[0];
      selectColor(fallback);
    }
    ctx.markAndSchedule();
  }

  function resetDefaultColors() {
    if (ctx.activeTool.value === "highlighter") {
      ctx.colorPalettes.value = {
        ...ctx.colorPalettes.value,
        highlighter: normalizeToolColorPalettes().highlighter,
      };
    } else {
      ctx.colorPalettes.value = {
        ...ctx.colorPalettes.value,
        pen: normalizeToolColorPalettes().pen,
      };
    }
    showMessage(ctx.t("colorReset") || "已恢复默认颜色设置", 3000, "info");

    selectColor(colors.value[0] ?? PRESET_COLORS[0]);
    ctx.markAndSchedule();
  }

  return { activeColor, colors, selectColor, selectCustomColor, recolorSelection, deleteColor, resetDefaultColors };
}

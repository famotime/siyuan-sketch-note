import { ref, computed } from "vue";
import type { Ref } from "vue";
import { PRESET_COLORS } from "@/types/sketch";
import { addRecentColor, appendRecentColor, deleteFavoriteColorAt, setFavoriteColorAt } from "@/tools/palette";
import type { EditorTool } from "@/editor/tools";

export function useColorPalettes(ctx: {
  activeTool: Ref<EditorTool>;
  colorPalettes: Ref<{ pen: string[]; highlighter: string[] }>;
  favoriteColors: Ref<{ pen: (string | null)[]; highlighter: (string | null)[] }>;
  activePreset: Ref<any>;
  canvasRef: Ref<{ recolorLasso: (c: string) => void } | undefined>;
  t: (key: string) => string;
  markAndSchedule: () => void;
  updateActivePreset: (patch: { color: string }) => void;
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
    ctx.updateActivePreset({ color: c });
  }

  function selectCustomColor(c: string) {
    activeColor.value = c;
    if (ctx.activeTool.value === "eraser") {
      ctx.activeTool.value = "pen";
    }
    ctx.updateActivePreset({ color: c });
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
    if (ctx.activePreset.value.color === color) {
      const fallback = colors.value[0] ?? PRESET_COLORS[0];
      selectColor(fallback);
    }
    ctx.markAndSchedule();
  }

  function setFavoriteColor(index: number, color: string) {
    if (ctx.activeTool.value === "highlighter") {
      ctx.favoriteColors.value = {
        ...ctx.favoriteColors.value,
        highlighter: setFavoriteColorAt(ctx.favoriteColors.value.highlighter, index, color),
      };
    } else {
      ctx.favoriteColors.value = {
        ...ctx.favoriteColors.value,
        pen: setFavoriteColorAt(ctx.favoriteColors.value.pen, index, color),
      };
    }
    ctx.markAndSchedule();
  }

  function deleteFavoriteColor(index: number) {
    const activeFavorites = ctx.activeTool.value === "highlighter" ? ctx.favoriteColors.value.highlighter : ctx.favoriteColors.value.pen;
    const deletedColor = activeFavorites[index];
    if (ctx.activeTool.value === "highlighter") {
      ctx.favoriteColors.value = {
        ...ctx.favoriteColors.value,
        highlighter: deleteFavoriteColorAt(ctx.favoriteColors.value.highlighter, index),
      };
    } else {
      ctx.favoriteColors.value = {
        ...ctx.favoriteColors.value,
        pen: deleteFavoriteColorAt(ctx.favoriteColors.value.pen, index),
      };
    }
    if (deletedColor && ctx.activePreset.value.color === deletedColor) {
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
    selectColor(colors.value[0] ?? PRESET_COLORS[0]);
    ctx.markAndSchedule();
  }

  return { activeColor, colors, selectColor, selectCustomColor, recolorSelection, deleteColor, setFavoriteColor, deleteFavoriteColor, resetDefaultColors };
}

import { ref } from "vue";
import type { Ref } from "vue";
import type { SketchData } from "@/types/sketch";
import { renderSketchPdfPageImages, renderSketchPngPageImage } from "@/storage/thumbnail";
import { createCurrentPagePngExportPlan, dataUrlToBlob, downloadBlob, createExportPngFileName } from "@/export/png";
import { createExportPdfFileName, createPdfExportPlanFromSketch, exportPdf as exportPdfBlob } from "@/export/pdf";
import { createExportJsonFileName, exportSketchJson } from "@/export/json";

export function useExportManager(ctx: {
  canvasRef: Ref<{ getData: () => SketchData } | undefined>;
  currentTemplate: Ref<string>;
  colorPalettes: Ref<{ pen: string[]; highlighter: string[] }>;
  toolPresets: Ref<Record<string, any>>;
  inputSettings: Ref<any>;
  customBackgrounds: Ref<any[]>;
  blockId: Ref<string>;
}) {
  const exportIncludeBackground = ref(true);

  async function exportPng() {
    if (!ctx.canvasRef.value) return;
    const data = ctx.canvasRef.value.getData();
    data.template = ctx.currentTemplate.value;
    data.recentColors = ctx.colorPalettes.value.pen;
    data.highlighterRecentColors = ctx.colorPalettes.value.highlighter;
    const plan = createCurrentPagePngExportPlan(ctx.blockId.value, data);
    const pngDataUrl = await renderSketchPngPageImage(data, plan, exportIncludeBackground.value);
    const blob = dataUrlToBlob(pngDataUrl);
    downloadBlob(blob, createExportPngFileName(ctx.blockId.value, new Date(), plan.pageNumber));
  }

  async function exportPdf() {
    if (!ctx.canvasRef.value) return;
    const data = ctx.canvasRef.value.getData();
    data.template = ctx.currentTemplate.value;
    data.recentColors = ctx.colorPalettes.value.pen;
    data.highlighterRecentColors = ctx.colorPalettes.value.highlighter;
    const plan = createPdfExportPlanFromSketch(
      ctx.blockId.value,
      data,
      undefined,
      exportIncludeBackground.value,
    );
    const pageImages = await renderSketchPdfPageImages(data, plan);
    const blob = await exportPdfBlob(plan, { pageImages });
    downloadBlob(blob, createExportPdfFileName(ctx.blockId.value));
  }

  function exportJson() {
    if (!ctx.canvasRef.value) return;
    const data = ctx.canvasRef.value.getData();
    data.template = ctx.currentTemplate.value;
    data.toolPresets = ctx.toolPresets.value;
    data.inputSettings = ctx.inputSettings.value;
    data.customBackgrounds = ctx.customBackgrounds.value;
    data.recentColors = ctx.colorPalettes.value.pen;
    data.highlighterRecentColors = ctx.colorPalettes.value.highlighter;
    const blob = exportSketchJson(data);
    downloadBlob(blob, createExportJsonFileName(ctx.blockId.value));
  }

  return { exportIncludeBackground, exportPng, exportPdf, exportJson };
}

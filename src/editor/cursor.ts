import type { EditorTool } from "./tools";
import type { ToolPresetCollection } from "@/types/sketch";
import type { PenCursorStyle } from "@/storage/pluginSettings";

export function buildSvgCursorUrl(svg: string, hotspotX: number, hotspotY: number): string {
  const cleanSvg = svg.trim().replace(/\s+/g, " ");
  const x = Math.round(hotspotX);
  const y = Math.round(hotspotY);
  return `url("data:image/svg+xml,${encodeURIComponent(cleanSvg)}") ${x} ${y}, auto`;
}

export function getEraserCursor(eraserWidth: number, scale: number): string {
  const rawWidth = eraserWidth * scale;
  const clampedWidth = Math.max(4, Math.min(128, Math.round(rawWidth)));
  const r = clampedWidth / 2;
  const pad = 2;
  let size = Math.ceil(clampedWidth) + pad * 2;
  if (size % 2 !== 0) size += 1;
  const center = size / 2;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${center}" cy="${center}" r="${r}" stroke="rgba(255, 255, 255, 0.85)" stroke-width="2" fill="none"/>
      <circle cx="${center}" cy="${center}" r="${r}" stroke="rgba(223, 76, 60, 0.9)" stroke-width="1" fill="rgba(223, 76, 60, 0.15)"/>
    </svg>
  `;
  return buildSvgCursorUrl(svg, center, center);
}

export function getColorDotCursor(color: string): string {
  const size = 12;
  const center = 6;
  const r = 3;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${center}" cy="${center}" r="${r + 0.8}" stroke="rgba(255, 255, 255, 0.9)" stroke-width="1.5" fill="none"/>
      <circle cx="${center}" cy="${center}" r="${r}" fill="${color}" stroke="rgba(0, 0, 0, 0.7)" stroke-width="0.75"/>
    </svg>
  `;
  return buildSvgCursorUrl(svg, center, center);
}

export function getBrushSizeCursor(brushWidth: number, color: string, scale: number): string {
  const rawDiameter = brushWidth * scale;
  const diameter = Math.max(4, Math.min(128, Math.round(rawDiameter)));
  const r = diameter / 2;
  const pad = 3;
  let size = Math.ceil(diameter) + pad * 2;
  if (size % 2 !== 0) size += 1;
  const center = size / 2;
  const outerR = r + 0.6;
  const innerR = Math.max(0.5, r - 0.6);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${center}" cy="${center}" r="${outerR}" stroke="rgba(0, 0, 0, 0.6)" stroke-width="1" fill="none"/>
      <circle cx="${center}" cy="${center}" r="${innerR}" stroke="rgba(255, 255, 255, 0.8)" stroke-width="1" fill="none"/>
      <circle cx="${center}" cy="${center}" r="${r}" stroke="${color}" stroke-width="1" fill="none"/>
    </svg>
  `;
  return buildSvgCursorUrl(svg, center, center);
}

export interface ResolveCanvasCursorOptions {
  tool: EditorTool | string;
  penCursorStyle?: PenCursorStyle;
  toolPresets?: Partial<ToolPresetCollection>;
  viewportScale?: number;
}

export function resolveCanvasCursor(options: ResolveCanvasCursorOptions): string {
  const tool = options.tool;
  const scale = options.viewportScale && options.viewportScale > 0 ? options.viewportScale : 1;

  if (tool === "eraser") {
    return getEraserCursor(options.toolPresets?.eraser?.width ?? 20, scale);
  }

  if (tool === "pen" || tool === "highlighter") {
    const cursorStyle = options.penCursorStyle ?? "crosshair";
    if (cursorStyle === "colorDot") {
      const color = tool === "highlighter"
        ? (options.toolPresets?.highlighter?.color ?? "#ffd43b")
        : (options.toolPresets?.pen?.color ?? "#000000");
      return getColorDotCursor(color);
    }
    if (cursorStyle === "brushSize") {
      const preset = tool === "highlighter" ? options.toolPresets?.highlighter : options.toolPresets?.pen;
      const width = preset?.width ?? 2;
      const color = preset?.color ?? "#000000";
      return getBrushSizeCursor(width, color, scale);
    }
    return "crosshair";
  }

  return "crosshair";
}

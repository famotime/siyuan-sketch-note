import { getTemplate } from "@/template";
import type { PdfExportPlan } from "@/export/pdf";
import type { PngExportPlan } from "@/export/png";
import type { SketchData, Stroke } from "@/types/sketch";
import type { SketchElement } from "@/elements/model";
import { splitElementsForRender } from "@/elements/renderOrder";
import { getPressureWidth, getSmoothedSegments } from "@/engine/strokeSmoothing";
import { getCustomBackgroundDrawRect, getCustomBackgroundSource, getCustomBackgroundTemplate } from "@/template/customBackground";
import { translateElementsForRender } from "./renderElements";

const PADDING = 40;
const MIN_WIDTH = 200;
const MIN_HEIGHT = 150;
const SAFE_MARGIN = 60;

/**
 * Render all strokes onto a canvas in order, with correct compositing.
 * Eraser strokes use destination-out to truly erase pixels from earlier strokes.
 */
function compositeStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[]): void {
  for (const stroke of strokes) {
    renderStrokeToCtx(ctx, stroke);
  }
}

/**
 * Scan pixel data to find the bounding box of non-transparent content.
 * Returns null if the canvas is fully transparent.
 */
function scanVisibleBounds(
  imageData: ImageData,
  width: number,
  height: number
): { x: number; y: number; w: number; h: number } | null {
  const data = imageData.data;
  let minX = width, minY = height, maxX = 0, maxY = 0;
  let found = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        found = true;
      }
    }
  }

  if (!found) return null;

  return {
    x: minX,
    y: minY,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
  };
}

/**
 * Composite strokes onto a transparent canvas and scan for visible pixel bounds.
 * Canvas size is based on non-eraser strokes only, so eraser movement
 * does not inflate the scan area.
 * Returns null if no visible content.
 */
function findStrokeVisibleBounds(strokes: Stroke[]): { x: number; y: number; w: number; h: number } | null {
  // Compute canvas size from content strokes only (exclude eraser)
  let maxX = 0, maxY = 0;
  for (const stroke of strokes) {
    if (stroke.tool === "eraser") continue;
    const halfW = stroke.width / 2;
    for (const pt of stroke.points) {
      if (pt.x + halfW > maxX) maxX = pt.x + halfW;
      if (pt.y + halfW > maxY) maxY = pt.y + halfW;
    }
  }
  if (maxX === 0 && maxY === 0) return null;

  const w = Math.ceil(maxX) + SAFE_MARGIN;
  const h = Math.ceil(maxY) + SAFE_MARGIN;

  const scanCanvas = document.createElement("canvas");
  scanCanvas.width = w;
  scanCanvas.height = h;
  const scanCtx = scanCanvas.getContext("2d")!;
  compositeStrokes(scanCtx, strokes);
  const imageData = scanCtx.getImageData(0, 0, w, h);
  return scanVisibleBounds(imageData, w, h);
}

/**
 * Compute the axis-aligned bounding box of non-stroke elements only.
 * Returns null if there are no elements.
 */
function computeElementBounds(
  elements: SketchElement[],
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let found = false;

  for (const el of elements) {
    const b = el.bounds;
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.width > maxX) maxX = b.x + b.width;
    if (b.y + b.height > maxY) maxY = b.y + b.height;
    found = true;
  }

  return found ? { minX, minY, maxX, maxY } : null;
}

interface CropRegion { x: number; y: number; w: number; h: number }

/**
 * Given content bounding box, compute a crop region with padding.
 * Minimum size is MIN_WIDTH × MIN_HEIGHT. Canvas dimensions clamp the region.
 */
function computeCropRegion(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  canvasW: number,
  canvasH: number,
): CropRegion {
  const contentW = bounds.maxX - bounds.minX;
  const contentH = bounds.maxY - bounds.minY;
  const cropX = Math.max(0, Math.floor(bounds.minX - PADDING));
  const cropY = Math.max(0, Math.floor(bounds.minY - PADDING));
  const cropW = Math.min(Math.ceil(contentW + PADDING * 2), canvasW - cropX);
  const cropH = Math.min(Math.ceil(contentH + PADDING * 2), canvasH - cropY);
  return {
    x: cropX,
    y: cropY,
    w: Math.max(cropW, MIN_WIDTH),
    h: Math.max(cropH, MIN_HEIGHT),
  };
}

/**
 * Render strokes to a PNG data URL with correct eraser compositing and auto-cropping.
 *
 * 1. Compute content bounds from stroke coordinates.
 * 2. Render all strokes on a transparent scan canvas to find visible bounds after erasing.
 * 3. Crop to the visible bounds + padding, render the final PNG.
 */
export function thumbnailCanvas(strokes: Stroke[], templateId: string): string {
  if (strokes.length === 0) {
    return renderToDataUrl(MIN_WIDTH, MIN_HEIGHT, templateId, []);
  }

  const visible = findStrokeVisibleBounds(strokes);
  if (!visible) {
    return renderToDataUrl(MIN_WIDTH, MIN_HEIGHT, templateId, []);
  }

  const crop = computeCropRegion(
    { minX: visible.x, minY: visible.y, maxX: visible.x + visible.w, maxY: visible.y + visible.h },
    visible.x + visible.w + SAFE_MARGIN,
    visible.y + visible.h + SAFE_MARGIN,
  );

  return renderToDataUrl(crop.w, crop.h, templateId, strokes, -crop.x, -crop.y);
}

export function thumbnailSketchData(data: SketchData): string {
  return thumbnailCanvasWithElements(data.strokes, data.template, data.elements ?? []);
}

function thumbnailCanvasWithElements(
  strokes: Stroke[],
  templateId: string,
  elements: SketchElement[],
): string {
  if (strokes.length === 0 && elements.length === 0) {
    return renderToDataUrl(MIN_WIDTH, MIN_HEIGHT, templateId, [], 0, 0, elements);
  }

  // Scan visible stroke bounds on transparent canvas (correctly handles eraser)
  let strokeBounds = null;
  if (strokes.length > 0) {
    strokeBounds = findStrokeVisibleBounds(strokes);
  }

  // Compute element bounds (text, images, excluding stroke elements since their bounds are already handled by strokeBounds with pixel eraser consideration)
  const elBounds = computeElementBounds(elements.filter((el) => el.type !== "stroke"));

  // Union stroke visible bounds + element bounds
  let contentBounds = null;
  if (strokeBounds && elBounds) {
    contentBounds = {
      minX: Math.min(strokeBounds.x, elBounds.minX),
      minY: Math.min(strokeBounds.y, elBounds.minY),
      maxX: Math.max(strokeBounds.x + strokeBounds.w, elBounds.maxX),
      maxY: Math.max(strokeBounds.y + strokeBounds.h, elBounds.maxY),
    };
  } else if (strokeBounds) {
    contentBounds = { minX: strokeBounds.x, minY: strokeBounds.y, maxX: strokeBounds.x + strokeBounds.w, maxY: strokeBounds.y + strokeBounds.h };
  } else if (elBounds) {
    contentBounds = elBounds;
  }

  if (!contentBounds) {
    return renderToDataUrl(MIN_WIDTH, MIN_HEIGHT, templateId, [], 0, 0, elements);
  }

  const canvasW = Math.max(MIN_WIDTH, Math.ceil(contentBounds.maxX + SAFE_MARGIN));
  const canvasH = Math.max(MIN_HEIGHT, Math.ceil(contentBounds.maxY + SAFE_MARGIN));
  const crop = computeCropRegion(contentBounds, canvasW, canvasH);

  return renderToDataUrl(crop.w, crop.h, templateId, strokes, -crop.x, -crop.y, elements);
}

export async function thumbnailSketchDataAsync(data: SketchData): Promise<string> {
  const imageElements = (data.elements ?? []).filter((element) => element.type === "image");
  if (imageElements.length === 0 && !getCustomBackgroundSource(data)) {
    return thumbnailSketchData(data);
  }

  const strokes = data.strokes;
  const elements = data.elements ?? [];
  const canvasW = Math.max(MIN_WIDTH, data.canvasWidth || 800);
  const canvasH = Math.max(MIN_HEIGHT, data.canvasHeight || 400);

  // Custom background fills the entire canvas — skip cropping
  if (getCustomBackgroundSource(data)) {
    return renderToDataUrlAsync(canvasW, canvasH, data.template, strokes, 0, 0, elements, "image/png", true, data);
  }

  // Auto-crop to visible content bounds + padding
  let strokeBounds = null;
  if (strokes.length > 0) {
    strokeBounds = findStrokeVisibleBounds(strokes);
  }

  // Compute element bounds (text, images, excluding stroke elements since their bounds are already handled by strokeBounds with pixel eraser consideration)
  const elBounds = computeElementBounds(elements.filter((el) => el.type !== "stroke"));

  let contentBounds = null;
  if (strokeBounds && elBounds) {
    contentBounds = {
      minX: Math.min(strokeBounds.x, elBounds.minX),
      minY: Math.min(strokeBounds.y, elBounds.minY),
      maxX: Math.max(strokeBounds.x + strokeBounds.w, elBounds.maxX),
      maxY: Math.max(strokeBounds.y + strokeBounds.h, elBounds.maxY),
    };
  } else if (strokeBounds) {
    contentBounds = { minX: strokeBounds.x, minY: strokeBounds.y, maxX: strokeBounds.x + strokeBounds.w, maxY: strokeBounds.y + strokeBounds.h };
  } else if (elBounds) {
    contentBounds = elBounds;
  }

  if (!contentBounds) {
    return renderToDataUrlAsync(MIN_WIDTH, MIN_HEIGHT, data.template, [], 0, 0, elements, "image/png", true, data);
  }

  const crop = computeCropRegion(contentBounds, canvasW, canvasH);
  return renderToDataUrlAsync(crop.w, crop.h, data.template, strokes, -crop.x, -crop.y, elements, "image/png", true, data);
}

export async function renderSketchPdfPageImages(
  data: SketchData,
  plan: PdfExportPlan,
): Promise<string[]> {
  const elements = data.elements ?? [];
  return Promise.all(plan.pages.map((page) => renderToDataUrlAsync(
    page.width,
    page.height,
    data.template,
    data.strokes,
    0,
    -page.sourceY,
    elements,
    "image/jpeg",
    plan.includeBackground,
    data,
  )));
}

export async function renderSketchPngPageImage(
  data: SketchData,
  plan: PngExportPlan,
  includeBackground = true,
): Promise<string> {
  return renderToDataUrlAsync(
    plan.width,
    plan.height,
    data.template,
    data.strokes,
    -plan.sourceX,
    -plan.sourceY,
    data.elements ?? [],
    "image/png",
    includeBackground,
    data,
  );
}

/**
 * Render the final PNG: template background + translated strokes.
 *
 * When compositeStrokesSeparately is true, strokes are first composited on a
 * transparent offscreen canvas (so eraser's destination-out only affects strokes,
 * not the template background), then the result is drawn onto the template.
 */
function renderToDataUrl(
  width: number,
  height: number,
  templateId: string,
  strokes: Stroke[],
  tx = 0,
  ty = 0,
  elements: SketchElement[] = [],
  compositeStrokesSeparately = true,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const template = getTemplate(templateId);
  template.render(ctx, width, height);

  const translatedElements = translateElementsForRender(elements, tx, ty);
  const layers = splitElementsForRender(translatedElements);
  renderNonStrokeElements(ctx, layers.background);
  if (strokes.length > 0) {
    if (compositeStrokesSeparately) {
      const strokeCanvas = document.createElement("canvas");
      strokeCanvas.width = width;
      strokeCanvas.height = height;
      const strokeCtx = strokeCanvas.getContext("2d")!;
      strokeCtx.save();
      strokeCtx.translate(tx, ty);
      compositeStrokes(strokeCtx, strokes);
      strokeCtx.restore();
      ctx.drawImage(strokeCanvas, 0, 0);
    } else {
      ctx.save();
      ctx.translate(tx, ty);
      compositeStrokes(ctx, strokes);
      ctx.restore();
    }
  }
  renderNonStrokeElements(ctx, layers.foreground);

  return canvas.toDataURL("image/png");
}

async function renderToDataUrlAsync(
  width: number,
  height: number,
  templateId: string,
  strokes: Stroke[],
  tx = 0,
  ty = 0,
  elements: SketchElement[] = [],
  type = "image/png",
  includeBackground = true,
  data?: SketchData,
  compositeStrokesSeparately = true,
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  if (includeBackground) {
    const customBackground = data ? getCustomBackgroundTemplate(data) : null;
    if (customBackground) {
      const image = await loadImage(customBackground.src);
      const rect = getCustomBackgroundDrawRect({
        imageWidth: image.naturalWidth,
        imageHeight: image.naturalHeight,
        targetWidth: width,
        targetHeight: height,
        fit: customBackground.fit,
      });
      ctx.drawImage(
        image,
        rect.sx,
        rect.sy,
        rect.sw,
        rect.sh,
        rect.dx,
        rect.dy,
        rect.dw,
        rect.dh,
      );
    } else {
      const template = getTemplate(templateId);
      template.render(ctx, width, height);
    }
  } else {
    ctx.clearRect(0, 0, width, height);
  }

  const translatedElements = translateElementsForRender(elements, tx, ty);
  const layers = splitElementsForRender(translatedElements);
  await renderNonStrokeElementsAsync(ctx, layers.background);
  if (strokes.length > 0) {
    if (compositeStrokesSeparately) {
      const strokeCanvas = document.createElement("canvas");
      strokeCanvas.width = width;
      strokeCanvas.height = height;
      const strokeCtx = strokeCanvas.getContext("2d")!;
      strokeCtx.save();
      strokeCtx.translate(tx, ty);
      compositeStrokes(strokeCtx, strokes);
      strokeCtx.restore();
      ctx.drawImage(strokeCanvas, 0, 0);
    } else {
      ctx.save();
      ctx.translate(tx, ty);
      compositeStrokes(ctx, strokes);
      ctx.restore();
    }
  }
  await renderNonStrokeElementsAsync(ctx, layers.foreground);

  return canvas.toDataURL(type);
}

function renderNonStrokeElements(ctx: CanvasRenderingContext2D, elements: SketchElement[]): void {
  for (const element of elements) {
    if (element.type === "image") {
      renderImagePlaceholder(ctx, element);
      continue;
    }
    if (element.type !== "text") continue;
    ctx.save();
    ctx.fillStyle = element.style.color;
    ctx.font = `${element.style.fontSize}px ${element.style.fontFamily}`;
    ctx.textBaseline = "top";
    ctx.fillText(element.text, element.bounds.x, element.bounds.y, element.bounds.width);
    ctx.restore();
  }
}

async function renderNonStrokeElementsAsync(ctx: CanvasRenderingContext2D, elements: SketchElement[]): Promise<void> {
  for (const element of elements) {
    if (element.type === "image") {
      const image = await loadImage(element.src);
      ctx.drawImage(
        image,
        element.bounds.x,
        element.bounds.y,
        element.bounds.width,
        element.bounds.height,
      );
      continue;
    }
    if (element.type !== "text") continue;
    ctx.save();
    ctx.fillStyle = element.style.color;
    ctx.font = `${element.style.fontSize}px ${element.style.fontFamily}`;
    ctx.textBaseline = "top";
    ctx.fillText(element.text, element.bounds.x, element.bounds.y, element.bounds.width);
    ctx.restore();
  }
}

function renderImagePlaceholder(ctx: CanvasRenderingContext2D, element: Extract<SketchElement, { type: "image" }>): void {
  ctx.save();
  ctx.fillStyle = "#f4f4f4";
  ctx.strokeStyle = "#c8c8c8";
  ctx.lineWidth = 1;
  ctx.fillRect(element.bounds.x, element.bounds.y, element.bounds.width, element.bounds.height);
  ctx.strokeRect(element.bounds.x, element.bounds.y, element.bounds.width, element.bounds.height);
  ctx.fillStyle = "#888";
  ctx.font = "14px sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(
    element.alt || "Image",
    element.bounds.x + element.bounds.width / 2,
    element.bounds.y + element.bounds.height / 2,
    element.bounds.width - 16,
  );
  ctx.restore();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image element"));
    image.src = src;
  });
}

function renderStrokeToCtx(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const { points, color, width, tool } = stroke;
  if (points.length < 2) return;

  ctx.save();
  if (tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
  } else {
    ctx.globalAlpha = stroke.opacity ?? 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = color;
  }

  ctx.lineWidth = getPressureWidth(width, points[0].pressure);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const segment of getSmoothedSegments(points)) {
    ctx.quadraticCurveTo(
      segment.control.x,
      segment.control.y,
      segment.end.x,
      segment.end.y,
    );
  }
  ctx.stroke();
  ctx.restore();
}

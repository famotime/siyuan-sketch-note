import { getTemplate } from "@/template";
import type { PdfExportPlan } from "@/export/pdf";
import type { PngExportPlan } from "@/export/png";
import type { SketchData, Stroke } from "@/types/sketch";
import type { SketchElement } from "@/elements/model";
import { splitElementsForRender } from "@/elements/renderOrder";
import { getPressureWidth, getSmoothedSegments } from "@/engine/strokeSmoothing";
import { getCustomBackgroundSource } from "@/template/customBackground";

const PADDING = 40;
const MIN_WIDTH = 200;
const MIN_HEIGHT = 150;
const SAFE_MARGIN = 60;

/**
 * Calculate a safe canvas size that covers all stroke coordinates + margin.
 * This is the data-level bounds, NOT the visible bounds (which accounts for erasing).
 */
function safeCanvasSize(strokes: Stroke[]): { w: number; h: number } | null {
  let maxX = 0, maxY = 0;
  for (const stroke of strokes) {
    const halfW = stroke.width / 2;
    for (const pt of stroke.points) {
      maxX = Math.max(maxX, pt.x + halfW);
      maxY = Math.max(maxY, pt.y + halfW);
    }
  }
  if (maxX === 0 && maxY === 0) return null;
  return { w: maxX + SAFE_MARGIN, h: maxY + SAFE_MARGIN };
}

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
 * Render strokes to a PNG data URL with correct eraser compositing and auto-cropping.
 *
 * 1. Render all strokes on a transparent scan canvas (same order as the editor)
 *    so that eraser's destination-out correctly removes earlier stroke pixels.
 * 2. Scan pixels to find the actual visible bounding box after erasing.
 * 3. Crop to the visible bounds + padding, render the final PNG.
 */
export function thumbnailCanvas(strokes: Stroke[], templateId: string): string {
  if (strokes.length === 0) {
    return renderToDataUrl(MIN_WIDTH, MIN_HEIGHT, templateId, []);
  }

  const size = safeCanvasSize(strokes);
  if (!size) {
    return renderToDataUrl(MIN_WIDTH, MIN_HEIGHT, templateId, []);
  }

  // Step 1: Composite render on transparent scan canvas
  const scanCanvas = document.createElement("canvas");
  scanCanvas.width = Math.ceil(size.w);
  scanCanvas.height = Math.ceil(size.h);
  const scanCtx = scanCanvas.getContext("2d")!;
  compositeStrokes(scanCtx, strokes);

  // Step 2: Scan pixels for true visible bounds (accounts for erasing)
  const imageData = scanCtx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
  const visible = scanVisibleBounds(imageData, scanCanvas.width, scanCanvas.height);

  if (!visible) {
    // All content erased — return placeholder
    return renderToDataUrl(MIN_WIDTH, MIN_HEIGHT, templateId, []);
  }

  // Step 3: Calculate final cropped size with padding
  const cropX = Math.max(0, visible.x - PADDING);
  const cropY = Math.max(0, visible.y - PADDING);
  const cropW = Math.min(Math.ceil(visible.w + PADDING * 2), scanCanvas.width - cropX);
  const cropH = Math.min(Math.ceil(visible.h + PADDING * 2), scanCanvas.height - cropY);
  const outW = Math.max(cropW, MIN_WIDTH);
  const outH = Math.max(cropH, MIN_HEIGHT);

  return renderToDataUrl(outW, outH, templateId, strokes, -cropX, -cropY);
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

  return renderToDataUrl(
    Math.max(MIN_WIDTH, 800),
    Math.max(MIN_HEIGHT, 400),
    templateId,
    strokes,
    0,
    0,
    elements,
  );
}

export async function thumbnailSketchDataAsync(data: SketchData): Promise<string> {
  const imageElements = (data.elements ?? []).filter((element) => element.type === "image");
  if (imageElements.length === 0 && !getCustomBackgroundSource(data)) {
    return thumbnailSketchData(data);
  }

  return renderToDataUrlAsync(
    Math.max(MIN_WIDTH, data.canvasWidth || 800),
    Math.max(MIN_HEIGHT, data.canvasHeight || 400),
    data.template,
    data.strokes,
    0,
    0,
    data.elements ?? [],
    "image/png",
    true,
    data,
  );
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
 */
function renderToDataUrl(
  width: number,
  height: number,
  templateId: string,
  strokes: Stroke[],
  tx = 0,
  ty = 0,
  elements: SketchElement[] = [],
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const template = getTemplate(templateId);
  template.render(ctx, width, height);

  const layers = splitElementsForRender(elements);
  renderNonStrokeElements(ctx, layers.background);
  if (strokes.length > 0) {
    ctx.save();
    ctx.translate(tx, ty);
    compositeStrokes(ctx, strokes);
    ctx.restore();
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
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  if (includeBackground) {
    const customBackground = data ? getCustomBackgroundSource(data) : null;
    if (customBackground) {
      const image = await loadImage(customBackground);
      ctx.drawImage(image, 0, 0, width, height);
    } else {
      const template = getTemplate(templateId);
      template.render(ctx, width, height);
    }
  } else {
    ctx.clearRect(0, 0, width, height);
  }

  const layers = splitElementsForRender(elements);
  await renderNonStrokeElementsAsync(ctx, layers.background);
  if (strokes.length > 0) {
    ctx.save();
    ctx.translate(tx, ty);
    compositeStrokes(ctx, strokes);
    ctx.restore();
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

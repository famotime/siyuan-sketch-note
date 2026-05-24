import type { SketchData, SketchPage, Stroke } from "@/types/sketch";
import { CANVAS_INITIAL_HEIGHT, CANVAS_LOGICAL_WIDTH } from "@/types/sketch";

export const DEFAULT_SKETCH_PAGE_HEIGHT = 1000;

export interface CreatePagedSketchDataOptions {
  template: string;
  canvasWidth?: number;
  pageHeight?: number;
}

export interface PageNavigator {
  pages: SketchPage[];
  current: SketchPage | null;
  goToId: (pageId: string) => SketchData;
  goToIndex: (index: number) => SketchData;
  goToNext: () => SketchData;
  goToPrevious: () => SketchData;
}

export function getSketchPages(
  data: Pick<SketchData, "activePageId" | "canvasHeight" | "canvasWidth" | "pageMode" | "pages">,
  fallbackPageHeight = DEFAULT_SKETCH_PAGE_HEIGHT,
): SketchPage[] {
  if (data.pageMode === "paged" && data.pages?.length) {
    return normalizePages(data.pages, data.canvasWidth);
  }

  const pageHeight = fallbackPageHeight > 0 ? fallbackPageHeight : DEFAULT_SKETCH_PAGE_HEIGHT;
  const canvasHeight = Math.max(1, data.canvasHeight || CANVAS_INITIAL_HEIGHT);
  const canvasWidth = Math.max(1, data.canvasWidth || CANVAS_LOGICAL_WIDTH);
  const pages: SketchPage[] = [];

  for (let y = 0, index = 0; y < canvasHeight; y += pageHeight, index += 1) {
    pages.push({
      id: `page-${index + 1}`,
      index,
      x: 0,
      y,
      width: canvasWidth,
      height: Math.min(pageHeight, canvasHeight - y),
    });
  }

  return pages;
}

export function createPagedSketchData(options: CreatePagedSketchDataOptions): SketchData {
  const canvasWidth = options.canvasWidth ?? CANVAS_LOGICAL_WIDTH;
  const pageHeight = options.pageHeight ?? DEFAULT_SKETCH_PAGE_HEIGHT;
  const firstPage = createPage("page-1", 0, canvasWidth, pageHeight);

  return {
    version: 1,
    template: options.template,
    canvasWidth,
    canvasHeight: pageHeight,
    pageMode: "paged",
    pages: [firstPage],
    activePageId: firstPage.id,
    elements: [],
    strokes: [],
  };
}

export function addSketchPage(data: SketchData, pageHeight = inferPageHeight(data)): SketchData {
  const pages = getSketchPages({ ...data, pageMode: "paged" }, pageHeight);
  const nextIndex = pages.length;
  const nextPage = createPage(createNextPageId(pages), nextIndex, data.canvasWidth, pageHeight);
  const nextPages = [...pages, nextPage];

  return {
    ...data,
    pageMode: "paged",
    pages: nextPages,
    activePageId: nextPage.id,
    canvasHeight: getCanvasHeightFromPages(nextPages),
  };
}

export function insertSketchPageAfter(data: SketchData, pageId: string): SketchData {
  const pages = getSketchPages({ ...data, pageMode: "paged" }, inferPageHeight(data));
  const targetIndex = pages.findIndex((page) => page.id === pageId);
  if (targetIndex < 0) return data;

  const target = pages[targetIndex];
  const nextPage = {
    ...createPage(createNextPageId(pages), targetIndex + 1, data.canvasWidth, target.height),
    y: target.y + target.height,
  };
  const nextPages = normalizePages([
    ...pages.slice(0, targetIndex + 1),
    nextPage,
    ...pages.slice(targetIndex + 1),
  ], data.canvasWidth);

  return {
    ...data,
    pageMode: "paged",
    pages: nextPages,
    activePageId: nextPage.id,
    canvasHeight: getCanvasHeightFromPages(nextPages),
    strokes: shiftStrokesAtOrAfter(data.strokes, nextPage.y, nextPage.height),
  };
}

export function duplicateSketchPage(
  data: SketchData,
  pageId: string,
  createCopyId: (id: string) => string = (id) => `copy-${Date.now()}-${id}`,
): SketchData {
  const pages = getSketchPages({ ...data, pageMode: "paged" }, inferPageHeight(data));
  const target = pages.find((page) => page.id === pageId);
  if (!target) return data;

  const inserted = insertSketchPageAfter(data, pageId);
  const copiedStrokes = getStrokesInPage(data.strokes, target).map((stroke) =>
    shiftStroke({
      ...stroke,
      id: createCopyId(stroke.id),
      points: stroke.points.map((point) => ({ ...point })),
      bounds: stroke.bounds ? { ...stroke.bounds } : undefined,
    }, target.height),
  );

  return {
    ...inserted,
    strokes: [
      ...inserted.strokes,
      ...copiedStrokes,
    ],
  };
}

export function removeSketchPage(data: SketchData, pageId: string): SketchData {
  const pages = getSketchPages({ ...data, pageMode: "paged" }, inferPageHeight(data));
  const target = pages.find((page) => page.id === pageId);
  if (!target) return data;
  if (pageHasContent(target, data.strokes)) {
    throw new Error("Cannot remove a page that contains content");
  }
  if (pages.length <= 1) return data;

  const nextPages = normalizePages(pages.filter((page) => page.id !== pageId), data.canvasWidth);
  const nextActivePageId = data.activePageId === pageId
    ? nextPages[Math.min(target.index, nextPages.length - 1)].id
    : data.activePageId ?? nextPages[0].id;

  return {
    ...data,
    pageMode: "paged",
    pages: nextPages,
    activePageId: nextActivePageId,
    canvasHeight: getCanvasHeightFromPages(nextPages),
    strokes: shiftStrokesAtOrAfter(data.strokes, target.y + target.height, -target.height),
  };
}

export function createPageNavigator(data: SketchData): PageNavigator {
  const pages = getSketchPages(data);
  const activePageId = data.activePageId ?? pages[0]?.id;
  const currentIndex = Math.max(0, pages.findIndex((page) => page.id === activePageId));
  const current = pages[currentIndex] ?? null;

  return {
    pages,
    current,
    goToId(pageId) {
      if (!pages.some((page) => page.id === pageId)) return data;
      return { ...data, activePageId: pageId };
    },
    goToIndex(index) {
      if (pages.length === 0) return data;
      const clampedIndex = Math.max(0, Math.min(pages.length - 1, index));
      return { ...data, activePageId: pages[clampedIndex].id };
    },
    goToNext() {
      if (pages.length === 0) return data;
      const nextIndex = Math.min(pages.length - 1, currentIndex + 1);
      return { ...data, activePageId: pages[nextIndex].id };
    },
    goToPrevious() {
      if (pages.length === 0) return data;
      const previousIndex = Math.max(0, currentIndex - 1);
      return { ...data, activePageId: pages[previousIndex].id };
    },
  };
}

function createPage(id: string, index: number, width: number, height: number): SketchPage {
  return {
    id,
    index,
    x: 0,
    y: index * height,
    width,
    height,
  };
}

function createNextPageId(pages: SketchPage[]): string {
  const maxPageNumber = pages.reduce((max, page) => {
    const match = /^page-(\d+)$/.exec(page.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `page-${maxPageNumber + 1}`;
}

function normalizePages(pages: SketchPage[], canvasWidth: number): SketchPage[] {
  let y = 0;
  return pages.map((page, index) => {
    const normalized = {
      ...page,
      index,
      x: 0,
      y,
      width: page.width || canvasWidth,
      height: Math.max(1, page.height),
    };
    y += normalized.height;
    return normalized;
  });
}

function inferPageHeight(data: SketchData): number {
  return data.pages?.[0]?.height ?? DEFAULT_SKETCH_PAGE_HEIGHT;
}

function getCanvasHeightFromPages(pages: SketchPage[]): number {
  return pages.reduce((height, page) => Math.max(height, page.y + page.height), 0);
}

function pageHasContent(page: SketchPage, strokes: Stroke[]): boolean {
  return strokes.some((stroke) =>
    stroke.points.some((point) =>
      point.y >= page.y && point.y <= page.y + page.height,
    ),
  );
}

function getStrokesInPage(strokes: Stroke[], page: SketchPage): Stroke[] {
  return strokes.filter((stroke) =>
    stroke.points.some((point) => point.y >= page.y && point.y <= page.y + page.height),
  );
}

function shiftStrokesAtOrAfter(strokes: Stroke[], y: number, dy: number): Stroke[] {
  return strokes.map((stroke) => {
    if (!stroke.points.some((point) => point.y >= y)) return stroke;
    return shiftStroke(stroke, dy);
  });
}

function shiftStroke(stroke: Stroke, dy: number): Stroke {
  return {
    ...stroke,
    points: stroke.points.map((point) => ({
      ...point,
      y: point.y + dy,
    })),
    bounds: stroke.bounds
      ? {
          ...stroke.bounds,
          y: stroke.bounds.y + dy,
        }
      : undefined,
  };
}

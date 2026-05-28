const SKETCH_ALT_PREFIX = "sketch:";
const SKETCH_ASSET_PATTERN = /(?:^|\/)sketch-note-([^/?#]+)\.png(?:[?#].*)?$/;

export function generateSketchId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function sketchAssetFileName(sketchId: string): string {
  return `sketch-note-${sketchId}.png`;
}

export function buildSketchImageMarkdown(sketchId: string): string {
  return `![${SKETCH_ALT_PREFIX}${sketchId}](assets/${sketchAssetFileName(sketchId)})`;
}

export function extractSketchIdFromAlt(alt: string): string | null {
  const value = alt.trim();
  if (!value.startsWith(SKETCH_ALT_PREFIX)) return null;
  const sketchId = value.slice(SKETCH_ALT_PREFIX.length).trim();
  return sketchId || null;
}

export function extractSketchIdFromAsset(assetSrc: string): string | null {
  const match = assetSrc.match(SKETCH_ASSET_PATTERN);
  return match ? decodeURIComponent(match[1]) : null;
}

export function extractSketchIdFromImage(imgElement: HTMLImageElement): string | null {
  const altSketchId = extractSketchIdFromAlt(imgElement.getAttribute("alt") || "");
  if (altSketchId) return altSketchId;

  const dataSrc = imgElement.getAttribute("data-src") || imgElement.dataset?.src || imgElement.getAttribute("src") || "";
  return extractSketchIdFromAsset(dataSrc);
}

export function isSketchImageSource(src: string): boolean {
  return extractSketchIdFromAsset(src) !== null;
}

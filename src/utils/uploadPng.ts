import { thumbnailCanvas } from "@/storage/thumbnail";
import { CANVAS_LOGICAL_WIDTH, CANVAS_INITIAL_HEIGHT } from "@/types/sketch";

/**
 * Create a placeholder PNG blob for a sketch block.
 * Uses the template renderer to generate a blank canvas image.
 */
export function createPlaceholderPng(templateId: string): Blob {
  const dataUrl = thumbnailCanvas([], templateId, CANVAS_INITIAL_HEIGHT);
  const byteString = atob(dataUrl.split(",")[1]);
  const mimeString = dataUrl.split(",")[0].split(":")[1].split(";")[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}

/**
 * Upload a PNG blob to SiYuan's assets directory via /api/file/putFile.
 * @param pngBlob - The PNG file content
 * @param fileName - e.g. "sketch-note-abc123.png"
 */
export async function uploadPngToAssets(pngBlob: Blob, fileName: string): Promise<void> {
  const file = new File([pngBlob], fileName, { type: "image/png" });
  const formData = new FormData();
  formData.append("path", `data/assets/${fileName}`);
  formData.append("file", file);
  formData.append("isDir", "false");

  const response = await fetch("/api/file/putFile", {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    throw new Error(`[Sketch Note] Failed to upload PNG: ${response.status}`);
  }
}

/**
 * Convert a PNG data URL (from thumbnailCanvas) to a Blob,
 * then upload it to assets, overwriting the existing file.
 */
export async function uploadDataUrlToAssets(dataUrl: string, fileName: string): Promise<void> {
  const byteString = atob(dataUrl.split(",")[1]);
  const mimeString = dataUrl.split(",")[0].split(":")[1].split(";")[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([ab], { type: mimeString });
  await uploadPngToAssets(blob, fileName);
}

/**
 * Get the asset file name for a sketch block.
 */
export function sketchAssetFileName(blockId: string): string {
  return `sketch-note-${blockId}.png`;
}

/**
 * Extract blockId from a sketch-note asset path.
 * Input: "assets/sketch-note-abc123.png" or "assets/subdir/sketch-note-abc123.png"
 * Returns: "abc123" or null if not a match.
 */
export function extractBlockIdFromAsset(assetSrc: string): string | null {
  const match = assetSrc.match(/sketch-note-(.+)\.png$/);
  return match ? match[1] : null;
}

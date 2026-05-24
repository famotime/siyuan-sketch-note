import { thumbnailCanvas } from "@/storage/thumbnail";
import { dataUrlToBlob } from "@/export/png";

/**
 * Create a placeholder PNG blob for a sketch block.
 * Uses the template renderer to generate a blank canvas image.
 */
export function createPlaceholderPng(templateId: string): Blob {
  const dataUrl = thumbnailCanvas([], templateId);
  return dataUrlToBlob(dataUrl);
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
  const blob = dataUrlToBlob(dataUrl);
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

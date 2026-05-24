interface ClipboardLikeItem {
  type: string;
  getAsFile: () => File | null;
}

export function getFirstImageFileFromClipboard(items: Iterable<ClipboardLikeItem>): File | null {
  for (const item of items) {
    if (!item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (file) return file;
  }
  return null;
}

/**
 * 图片缓存击穿与文档内白板缩略图热重载
 * 通过 fetch(url, { cache: 'reload' }) 绕过浏览器/思源内存图片缓存，强制重新拉取最新渲染图。
 */
export async function bustCacheForImage(img: HTMLImageElement): Promise<void> {
  const imageURL = img.src;
  if (!imageURL) return;

  try {
    if (typeof fetch === "function") {
      await fetch(imageURL, { cache: "reload" });
    }
    // 重新附加上新的时间戳参数或重设 src 触发重新解码
    const url = new URL(imageURL, window.location?.href ?? "http://localhost");
    url.searchParams.set("_t", String(Date.now()));
    img.src = url.toString();
  } catch (e) {
    console.warn("Failed to bust image cache:", e);
  }
}

/**
 * 刷新当前文档中所有匹配 sketchId 或所有草图的 img 元素
 */
export async function refreshSketchImages(sketchId?: string): Promise<number> {
  if (typeof document === "undefined") return 0;
  const allImages = Array.from(document.querySelectorAll("img")) as HTMLImageElement[];
  const matchedImages = allImages.filter((img) => {
    const src = img.src || "";
    if (sketchId) {
      return src.includes(sketchId);
    }
    return src.includes("sketch-") || src.includes("siyuan-sketch-note");
  });

  await Promise.all(matchedImages.map((img) => bustCacheForImage(img)));
  return matchedImages.length;
}

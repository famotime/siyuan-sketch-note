export type ImageColorInversionMode = "on-dark" | "on-light" | "disabled";

const STYLE_ID = "snippetCSS-sketchNoteColorInversion";

/**
 * 动态注入暗黑模式图片智能反色滤镜
 * 在暗色模式下将亮底手绘图反转为暗底亮字，并通过 hue-rotate(180deg) 保持原色彩色相
 */
export function updateImageColorInversionStyle(inversionMode: ImageColorInversionMode): void {
  if (typeof document === "undefined") return;

  let styleElement = document.getElementById(STYLE_ID) as HTMLStyleElement | null;

  if (inversionMode === "disabled") {
    if (styleElement) {
      styleElement.remove();
    }
    return;
  }

  if (!styleElement) {
    styleElement = document.createElement("style");
    styleElement.id = STYLE_ID;
    document.head.appendChild(styleElement);
  }

  const themeMode = inversionMode === "on-dark" ? "dark" : "light";
  const invertFactor = inversionMode === "on-dark" ? 88.1 : 100;

  const css = `
    html[data-theme-mode="${themeMode}"] img[src*="sketch-"],
    html[data-theme-mode="${themeMode}"] img[data-src*="sketch-"] {
      filter: grayscale(0%) invert(${invertFactor}%) contrast(100%) brightness(100%) hue-rotate(180deg);
    }
  `;

  styleElement.textContent = css;
}

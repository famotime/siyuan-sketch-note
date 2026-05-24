import type { Template } from "./blank";

const DOT_GAP = 19;
const DOT_RADIUS = 1;
const DOT_COLOR = "#d6dce3";

export const dottedTemplate: Template = {
  id: "dotted",
  nameKey: "templateDotted",
  render(ctx, width, height) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = DOT_COLOR;
    for (let x = DOT_GAP; x < width; x += DOT_GAP) {
      for (let y = DOT_GAP; y < height; y += DOT_GAP) {
        ctx.beginPath();
        ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
};

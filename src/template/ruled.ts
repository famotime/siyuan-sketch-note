import type { Template } from "./blank";

const LINE_GAP = 34;
const MARGIN_LEFT = 72;
const LINE_COLOR = "#d8dee6";
const MARGIN_COLOR = "#f0a8a8";

export const ruledTemplate: Template = {
  id: "ruled",
  nameKey: "templateRuled",
  render(ctx, width, height) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = LINE_GAP; y < height; y += LINE_GAP) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    ctx.strokeStyle = MARGIN_COLOR;
    ctx.beginPath();
    ctx.moveTo(MARGIN_LEFT, 0);
    ctx.lineTo(MARGIN_LEFT, height);
    ctx.stroke();
  },
};

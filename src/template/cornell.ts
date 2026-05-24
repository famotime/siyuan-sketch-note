import type { Template } from "./blank";

const CUE_WIDTH = 220;
const SUMMARY_HEIGHT = 180;
const RULE_GAP = 34;
const LINE_COLOR = "#d8dee6";
const SECTION_COLOR = "#b9c4d1";

export const cornellTemplate: Template = {
  id: "cornell",
  nameKey: "templateCornell",
  render(ctx, width, height) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const summaryTop = Math.max(0, height - SUMMARY_HEIGHT);

    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = RULE_GAP; y < summaryTop; y += RULE_GAP) {
      ctx.moveTo(CUE_WIDTH, y);
      ctx.lineTo(width, y);
    }
    for (let y = summaryTop + RULE_GAP; y < height; y += RULE_GAP) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    ctx.strokeStyle = SECTION_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(CUE_WIDTH, 0);
    ctx.lineTo(CUE_WIDTH, summaryTop);
    ctx.moveTo(0, summaryTop);
    ctx.lineTo(width, summaryTop);
    ctx.stroke();
  },
};

import type { Template } from "./blank";

const LINE_COLOR = "#d8dee6";
const SECTION_COLOR = "#b9c4d1";
const LABEL_COLOR = "#8a96a3";
const MARGIN = 36;
const HEADER_HEIGHT = 44;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const weeklyTemplate: Template = {
  id: "weekly",
  nameKey: "templateWeekly",
  render(ctx, width, height) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const gridTop = MARGIN + HEADER_HEIGHT;
    const gridHeight = height - gridTop - MARGIN;
    const rowHeight = gridHeight / DAYS.length;

    ctx.strokeStyle = SECTION_COLOR;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(MARGIN, gridTop, width - MARGIN * 2, gridHeight);

    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < DAYS.length; i++) {
      const y = gridTop + rowHeight * i;
      ctx.moveTo(MARGIN, y);
      ctx.lineTo(width - MARGIN, y);
    }
    ctx.stroke();

    ctx.fillStyle = LABEL_COLOR;
    ctx.font = "16px sans-serif";
    ctx.fillText("Week", MARGIN, MARGIN + 18);
    ctx.font = "14px sans-serif";
    DAYS.forEach((day, index) => {
      ctx.fillText(day, MARGIN + 14, gridTop + rowHeight * index + 25);
    });
  },
};

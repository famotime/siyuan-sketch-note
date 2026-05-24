import type { Template } from "./blank";

const LINE_COLOR = "#d8dee6";
const SECTION_COLOR = "#b9c4d1";
const LABEL_COLOR = "#8a96a3";
const MARGIN = 36;
const HEADER_HEIGHT = 52;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const monthlyTemplate: Template = {
  id: "monthly",
  nameKey: "templateMonthly",
  render(ctx, width, height) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const gridTop = MARGIN + HEADER_HEIGHT;
    const gridWidth = width - MARGIN * 2;
    const gridHeight = height - gridTop - MARGIN;
    const cellWidth = gridWidth / 7;
    const cellHeight = gridHeight / 6;

    ctx.strokeStyle = SECTION_COLOR;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(MARGIN, gridTop, gridWidth, gridHeight);

    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let col = 1; col < 7; col++) {
      const x = MARGIN + cellWidth * col;
      ctx.moveTo(x, gridTop);
      ctx.lineTo(x, gridTop + gridHeight);
    }
    for (let row = 1; row < 6; row++) {
      const y = gridTop + cellHeight * row;
      ctx.moveTo(MARGIN, y);
      ctx.lineTo(width - MARGIN, y);
    }
    ctx.stroke();

    ctx.fillStyle = LABEL_COLOR;
    ctx.font = "16px sans-serif";
    ctx.fillText("Month", MARGIN, MARGIN + 18);
    ctx.font = "12px sans-serif";
    WEEKDAYS.forEach((day, index) => {
      ctx.fillText(day, MARGIN + cellWidth * index + 10, gridTop - 12);
    });
  },
};

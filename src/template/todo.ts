import type { Template } from "./blank";

const LINE_COLOR = "#d8dee6";
const SECTION_COLOR = "#b9c4d1";
const LABEL_COLOR = "#8a96a3";
const MARGIN = 48;
const ROW_HEIGHT = 42;
const CHECK_SIZE = 16;

export const todoTemplate: Template = {
  id: "todo",
  nameKey: "templateTodo",
  render(ctx, width, height) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = LABEL_COLOR;
    ctx.font = "18px sans-serif";
    ctx.fillText("Tasks", MARGIN, MARGIN);

    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = MARGIN + 34; y < height - MARGIN; y += ROW_HEIGHT) {
      ctx.moveTo(MARGIN + 42, y + CHECK_SIZE + 7);
      ctx.lineTo(width - MARGIN, y + CHECK_SIZE + 7);
    }
    ctx.stroke();

    ctx.strokeStyle = SECTION_COLOR;
    ctx.lineWidth = 1.4;
    for (let y = MARGIN + 34; y < height - MARGIN; y += ROW_HEIGHT) {
      ctx.strokeRect(MARGIN, y + 3, CHECK_SIZE, CHECK_SIZE);
    }
  },
};

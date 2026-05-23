import type { Template } from "./blank";

const GRID_SIZE = 19; // ~5mm at 96dpi
const GRID_COLOR = "#e0e0e0";
const GRID_LINE_WIDTH = 0.5;

export const gridTemplate: Template = {
  id: "grid",
  nameKey: "templateGrid",
  render(ctx, width, height) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = GRID_LINE_WIDTH;

    ctx.beginPath();
    for (let x = GRID_SIZE; x < width; x += GRID_SIZE) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = GRID_SIZE; y < height; y += GRID_SIZE) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  },
};

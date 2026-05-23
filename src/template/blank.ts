export interface Template {
  id: string;
  nameKey: string;  // i18n key
  render: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
}

export const blankTemplate: Template = {
  id: "blank",
  nameKey: "templateBlank",
  render(ctx, width, height) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  },
};

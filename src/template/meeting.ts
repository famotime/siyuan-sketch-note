import type { Template } from "./blank";

const LINE_COLOR = "#d8dee6";
const SECTION_COLOR = "#b9c4d1";
const LABEL_COLOR = "#8a96a3";
const MARGIN = 48;
const HEADER_HEIGHT = 112;
const COLUMN_GAP = 24;
const RULE_GAP = 34;

export const meetingTemplate: Template = {
  id: "meeting",
  nameKey: "templateMeeting",
  render(ctx, width, height) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const contentTop = HEADER_HEIGHT + MARGIN;
    const halfWidth = (width - MARGIN * 2 - COLUMN_GAP) / 2;
    const rightX = MARGIN + halfWidth + COLUMN_GAP;
    const actionTop = Math.max(contentTop + 260, height - 260);

    ctx.strokeStyle = SECTION_COLOR;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(MARGIN, MARGIN, width - MARGIN * 2, HEADER_HEIGHT - 22);
    ctx.beginPath();
    ctx.moveTo(MARGIN, contentTop);
    ctx.lineTo(width - MARGIN, contentTop);
    ctx.moveTo(rightX - COLUMN_GAP / 2, contentTop);
    ctx.lineTo(rightX - COLUMN_GAP / 2, actionTop - 20);
    ctx.moveTo(MARGIN, actionTop);
    ctx.lineTo(width - MARGIN, actionTop);
    ctx.stroke();

    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = MARGIN + 34; y < HEADER_HEIGHT + 18; y += 34) {
      ctx.moveTo(MARGIN + 96, y);
      ctx.lineTo(width - MARGIN, y);
    }
    for (let y = contentTop + RULE_GAP; y < actionTop - 28; y += RULE_GAP) {
      ctx.moveTo(MARGIN, y);
      ctx.lineTo(MARGIN + halfWidth, y);
      ctx.moveTo(rightX, y);
      ctx.lineTo(width - MARGIN, y);
    }
    for (let y = actionTop + RULE_GAP; y < height - MARGIN; y += RULE_GAP) {
      ctx.moveTo(MARGIN, y);
      ctx.lineTo(width - MARGIN, y);
    }
    ctx.stroke();

    ctx.fillStyle = LABEL_COLOR;
    ctx.font = "14px sans-serif";
    ctx.fillText("Topic", MARGIN + 14, MARGIN + 28);
    ctx.fillText("Date", MARGIN + 14, MARGIN + 62);
    ctx.fillText("Notes", MARGIN, contentTop - 10);
    ctx.fillText("Decisions", rightX, contentTop - 10);
    ctx.fillText("Action items", MARGIN, actionTop - 10);
  },
};

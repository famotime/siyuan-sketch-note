import type { Template } from "./blank";
import { blankTemplate } from "./blank";
import { cornellTemplate } from "./cornell";
import { dottedTemplate } from "./dotted";
import { gridTemplate } from "./grid";
import { meetingTemplate } from "./meeting";
import { monthlyTemplate } from "./monthly";
import { ruledTemplate } from "./ruled";
import { todoTemplate } from "./todo";
import { weeklyTemplate } from "./weekly";

export type { Template };

const templates: Template[] = [
  blankTemplate,
  gridTemplate,
  ruledTemplate,
  dottedTemplate,
  cornellTemplate,
  meetingTemplate,
  todoTemplate,
  weeklyTemplate,
  monthlyTemplate,
];

export function getTemplate(id: string): Template {
  return templates.find((t) => t.id === id) ?? blankTemplate;
}

export function getAllTemplates(): Template[] {
  return templates;
}

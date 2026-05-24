import type { Template } from "./blank";
import { blankTemplate } from "./blank";
import { cornellTemplate } from "./cornell";
import { dottedTemplate } from "./dotted";
import { gridTemplate } from "./grid";
import { ruledTemplate } from "./ruled";

export type { Template };

const templates: Template[] = [
  blankTemplate,
  gridTemplate,
  ruledTemplate,
  dottedTemplate,
  cornellTemplate,
];

export function getTemplate(id: string): Template {
  return templates.find((t) => t.id === id) ?? blankTemplate;
}

export function getAllTemplates(): Template[] {
  return templates;
}

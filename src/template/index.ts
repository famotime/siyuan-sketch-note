import type { Template } from "./blank";
import { blankTemplate } from "./blank";
import { gridTemplate } from "./grid";

export type { Template };

const templates: Template[] = [blankTemplate, gridTemplate];

export function getTemplate(id: string): Template {
  return templates.find((t) => t.id === id) ?? blankTemplate;
}

export function getAllTemplates(): Template[] {
  return templates;
}

import { describe, expect, it } from "vitest";
import { getAllTemplates, getTemplate } from "./index";

describe("template registry", () => {
  it("registers commercial note-taking templates in a stable order", () => {
    expect(getAllTemplates().map((template) => template.id)).toEqual([
      "blank",
      "grid",
      "ruled",
      "dotted",
      "cornell",
      "meeting",
      "todo",
      "weekly",
      "monthly",
    ]);
  });

  it("falls back to blank template for unknown ids", () => {
    expect(getTemplate("missing").id).toBe("blank");
  });
});

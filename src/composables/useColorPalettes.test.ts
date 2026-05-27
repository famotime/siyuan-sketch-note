import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("useColorPalettes", () => {
  it("updates the active tool preset when a palette color is selected", () => {
    const source = readFileSync(resolve(process.cwd(), "src/composables/useColorPalettes.ts"), "utf8");
    const selectColorBody = source.match(/function selectColor\(c: string\) \{([\s\S]*?)\n  \}/)?.[1] ?? "";

    expect(selectColorBody).toContain("ctx.updateActivePreset({ color: c })");
  });

  it("updates the active tool preset when a custom color is selected", () => {
    const source = readFileSync(resolve(process.cwd(), "src/composables/useColorPalettes.ts"), "utf8");
    const selectCustomColorBody = source.match(/function selectCustomColor\(c: string\) \{([\s\S]*?)\n  \}/)?.[1] ?? "";

    expect(selectCustomColorBody).toContain("ctx.updateActivePreset({ color: c })");
  });
});

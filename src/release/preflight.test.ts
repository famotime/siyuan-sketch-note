import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");

function readText(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

function readJson<T>(path: string): T {
  return JSON.parse(readText(path)) as T;
}

interface PluginJson {
  author: string;
  backends: string[];
  frontends: string[];
  funding?: unknown;
  url: string;
}

describe("release preflight configuration", () => {
  it("uses Bazaar-ready plugin metadata", () => {
    const plugin = readJson<PluginJson>("plugin.json");

    expect(plugin.author).not.toBe("");
    expect(plugin.author).not.toBe("sketch-note");
    expect(plugin.url).toMatch(/^https:\/\//);
    expect(plugin.funding).toBeUndefined();
    expect(plugin.frontends).not.toEqual(["all"]);
    expect(plugin.backends).not.toEqual(["all"]);
  });

  it("keeps release assets within Bazaar limits", () => {
    expect(statSync(resolve(root, "icon.png")).size).toBeLessThan(20 * 1024);
    expect(statSync(resolve(root, "preview.png")).size).toBeLessThan(200 * 1024);
  });

  it("uses current license owner and year", () => {
    const license = readText("LICENSE");

    expect(license).toContain("Copyright (c) 2026");
    expect(license).not.toContain("SiYuan");
  });

  it("uses SiYuan native hotkey format", () => {
    const index = readText("src/index.ts");

    expect(index).toContain('hotkey: "⌃⇧S"');
    expect(index).not.toContain('hotkey: "Ctrl+Shift+S"');
  });

  it("does not copy unused static i18n files into the release package", () => {
    const viteConfig = readText("vite.config.ts");

    expect(viteConfig).not.toContain('src: "./src/i18n/**"');
    expect(viteConfig).not.toContain('dest: "./i18n/"');
  });
});

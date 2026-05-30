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
  disabledInPublish: boolean;
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
    expect(plugin.frontends).toEqual(["all"]);
    expect(plugin.backends).toEqual(["all"]);
    expect(plugin.disabledInPublish).toBe(true);
  });

  it("keeps README videos playable in Bazaar preview", () => {
    const readme = readText("README.md");
    const videos = readme.match(/<video\b[^>]*>/g) ?? [];

    expect(videos.length).toBeGreaterThan(0);
    expect(videos.every((video) => /\bcontrols\b/.test(video))).toBe(true);
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

  it("uses theme-aware SVG colors for top bar and injected edit buttons", () => {
    const index = readText("src/index.ts");

    expect(index).toContain('stroke="currentColor"');
    expect(index).not.toMatch(/stroke="#[0-9a-fA-F]{3,6}"/);
    expect(index).not.toMatch(/fill="#[0-9a-fA-F]{3,6}"/);
  });

  it("removes injected editor DOM when the plugin is disabled", () => {
    const index = readText("src/index.ts");
    const unloadIndex = index.indexOf("onunload()");
    const cleanupIndex = index.indexOf("this.removeInjectedEditButtons()");
    const methodIndex = index.indexOf("private removeInjectedEditButtons()");

    expect(unloadIndex).toBeGreaterThan(-1);
    expect(cleanupIndex).toBeGreaterThan(unloadIndex);
    expect(methodIndex).toBeGreaterThan(-1);
    expect(index.slice(methodIndex)).toContain('document.querySelectorAll(".sketch-note-edit-btn")');
    expect(index.slice(methodIndex)).toContain(".remove()");
  });

  it("does not copy unused static i18n files into the release package", () => {
    const viteConfig = readText("vite.config.ts");

    expect(viteConfig).not.toContain('src: "./src/i18n/**"');
    expect(viteConfig).not.toContain('dest: "./i18n/"');
  });
});

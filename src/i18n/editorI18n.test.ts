import { describe, expect, it } from "vitest";
import { normalizeEditorI18n } from "./editorI18n";

describe("editor i18n", () => {
  it("fills missing editor tool labels from the Chinese locale when plugin i18n is Chinese", () => {
    const i18n = normalizeEditorI18n({
      insertSketch: "闲笔",
    });

    expect(i18n.shape).toBe("图形");
    expect(i18n.text).toBe("文本");
    expect(i18n.pen).toBe("画笔");
  });

  it("keeps plugin-provided keys over bundled editor defaults", () => {
    const i18n = normalizeEditorI18n({
      insertSketch: "Insert Sketch Block",
      shape: "Custom Shape",
    });

    expect(i18n.shape).toBe("Custom Shape");
    expect(i18n.text).toBe("Text");
  });
});

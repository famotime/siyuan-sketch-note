import { describe, expect, it } from "vitest";
import { createSaveStatusLabel } from "./saveStatus";

const labels: Record<string, string> = {
  statusSaving: "保存中...",
  statusSaved: "已保存",
  statusError: "保存失败",
  statusDirty: "未保存",
};

function t(key: string): string {
  return labels[key] ?? key;
}

describe("save status labels", () => {
  it("shows the last saved time when data has been saved", () => {
    expect(createSaveStatusLabel("saved", t, new Date("2026-05-24T09:08:00").getTime())).toBe(
      "已保存 09:08",
    );
  });

  it("keeps transient save labels concise", () => {
    expect(createSaveStatusLabel("saving", t, new Date("2026-05-24T09:08:00").getTime())).toBe("保存中...");
    expect(createSaveStatusLabel("dirty", t, new Date("2026-05-24T09:08:00").getTime())).toBe("未保存");
    expect(createSaveStatusLabel("error", t, new Date("2026-05-24T09:08:00").getTime())).toBe("保存失败");
  });
});

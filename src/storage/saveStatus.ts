export type SaveStatus = "idle" | "saving" | "saved" | "error" | "dirty";

export function createSaveStatusLabel(
  status: SaveStatus,
  t: (key: string) => string,
  lastSavedAt: number | null = null,
): string {
  if (status === "saved" && lastSavedAt) {
    return `${t("statusSaved")} ${formatSavedTime(lastSavedAt)}`;
  }

  switch (status) {
    case "saving":
      return t("statusSaving");
    case "saved":
      return t("statusSaved");
    case "error":
      return t("statusError");
    case "dirty":
      return t("statusDirty");
    default:
      return "";
  }
}

function formatSavedTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

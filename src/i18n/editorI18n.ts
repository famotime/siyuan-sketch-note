import enUS from "./en_US.json";
import zhCN from "./zh_CN.json";

export type EditorI18n = Record<string, string>;

export function normalizeEditorI18n(pluginI18n: EditorI18n = {}): EditorI18n {
  const defaults = isChineseLocale(pluginI18n) ? zhCN : enUS;
  return {
    ...defaults,
    ...pluginI18n,
  };
}

function isChineseLocale(i18n: EditorI18n): boolean {
  const locale = getSiyuanLocale();
  if (locale) {
    return locale.toLowerCase().startsWith("zh");
  }

  return Object.values(i18n).some((value) => /[\u4E00-\u9FFF]/.test(value));
}

function getSiyuanLocale(): string | undefined {
  const siyuan = (globalThis as any).window?.siyuan ?? (globalThis as any).siyuan;
  return siyuan?.config?.appearance?.lang
    ?? siyuan?.config?.lang
    ?? siyuan?.languages?.lang;
}

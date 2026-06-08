import type { Dialog } from 'siyuan'

export type SiyuanConfirm = (
  title: string,
  text: string,
  confirmCallback?: (dialog: Dialog) => void,
  cancelCallback?: (dialog: Dialog) => void,
) => void

export function requestSiyuanConfirm(
  confirmFn: SiyuanConfirm,
  title: string,
  text: string,
  options: { fallbackDelayMs?: number } = {},
): Promise<boolean> {
  return new Promise((resolve) => {
    const fallbackDelayMs = options.fallbackDelayMs ?? 200;
    const dialogCountBefore = getSiyuanDialogCount();
    let settled = false;

    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const fallbackToWindowConfirm = () => {
      finish(globalThis.window?.confirm?.(`${title}\n\n${text}`) === true);
    };

    try {
      confirmFn(
        title,
        text,
        () => finish(true),
        () => finish(false),
      )
    } catch {
      fallbackToWindowConfirm();
      return;
    }

    globalThis.window?.setTimeout?.(() => {
      if (settled) return;
      if (getSiyuanDialogCount() > dialogCountBefore) return;
      fallbackToWindowConfirm();
    }, fallbackDelayMs);
  })
}

function getSiyuanDialogCount(): number {
  return globalThis.document?.querySelectorAll?.('.b3-dialog').length ?? 0;
}

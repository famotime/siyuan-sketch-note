/** Stub for siyuan types-only package — provides runtime entry for vitest */
export function fetchSyncPost(_url: string, _data?: any): Promise<any> {
  return Promise.resolve({ code: 0, data: null });
}

export function showMessage(_msg: string, _timeout?: number): void {}

export function confirm(_title: string, _msg: string, _cb?: () => void): void {}

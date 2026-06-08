export function resolveSiyuanWorkspaceDir(): string {
  const value = (globalThis.window as any)?.siyuan?.config?.system?.workspaceDir;
  return typeof value === 'string' ? value : '';
}

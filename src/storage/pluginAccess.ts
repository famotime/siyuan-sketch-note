export interface PluginStorageAccess {
  loadData?: (key: string) => Promise<any>;
  saveData: (key: string, data: any) => Promise<void>;
  removeData?: (key: string) => Promise<any>;
}

export function resolvePluginStorageAccess(input: Partial<PluginStorageAccess> & {
  saveData?: (key: string, data: any) => Promise<void>;
}): PluginStorageAccess {
  const plugin = (globalThis.window as any)?._sketchNotePlugin;
  return {
    loadData: input.loadData ?? (typeof plugin?.loadData === 'function'
      ? (key: string) => plugin.loadData(key)
      : undefined),
    saveData: input.saveData ?? (typeof plugin?.saveData === 'function'
      ? (key: string, data: any) => plugin.saveData(key, data)
      : async () => {}),
    removeData: input.removeData ?? (typeof plugin?.removeData === 'function'
      ? (key: string) => plugin.removeData(key)
      : undefined),
  };
}

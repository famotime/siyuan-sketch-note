import type { Plugin } from "siyuan";

export const SYNC_MARKER_STORAGE_KEY = "sync-marker.json";

export interface SyncMarkerData {
  timestamp: number;
}

/**
 * 跨设备同步变更标记器
 * 在保存白板时写入时间戳文件到插件 storage 目录，
 * 思源同步系统检测到该文件变更后会在其他设备上派发 ws-main: reloadPlugin 事件，
 * 从而触发多端自动无感热重载。
 */
export async function bumpSyncMarker(
  saveStorage: (key: string, data: any) => Promise<void>,
): Promise<void> {
  const markerData: SyncMarkerData = {
    timestamp: Date.now(),
  };
  try {
    await saveStorage(SYNC_MARKER_STORAGE_KEY, markerData);
  } catch (e) {
    console.warn("Failed to bump sync marker:", e);
  }
}

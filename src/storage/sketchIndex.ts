import { sketchAssetFileName } from '@/utils/sketchReference';

export const SKETCH_INDEX_KEY = 'sketch-index.json';

export interface SketchIndexItem {
  sketchId: string;
  blockIds: string[];
  assetName: string;
  createdAt: number;
  updatedAt: number;
}

export interface SketchIndex {
  version: 1;
  items: Record<string, SketchIndexItem>;
}

export function createEmptySketchIndex(): SketchIndex {
  return { version: 1, items: {} };
}

export function normalizeSketchIndex(raw: unknown): SketchIndex {
  if (!raw || typeof raw !== 'object') return createEmptySketchIndex();
  const candidate = raw as Partial<SketchIndex>;
  const items: Record<string, SketchIndexItem> = {};
  if (candidate.items && typeof candidate.items === 'object') {
    for (const [key, value] of Object.entries(candidate.items)) {
      const item = value as Partial<SketchIndexItem>;
      const sketchId = typeof item.sketchId === 'string' && item.sketchId ? item.sketchId : key;
      const blockIds = Array.isArray(item.blockIds)
        ? Array.from(new Set(item.blockIds.filter((id): id is string => typeof id === 'string' && Boolean(id.trim())).map(id => id.trim())))
        : [];
      items[sketchId] = {
        sketchId,
        blockIds,
        assetName: typeof item.assetName === 'string' && item.assetName ? item.assetName : sketchAssetFileName(sketchId),
        createdAt: typeof item.createdAt === 'number' ? item.createdAt : 0,
        updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : 0,
      };
    }
  }
  return { version: 1, items };
}

export async function loadSketchIndex(loadData: (key: string) => Promise<any>): Promise<SketchIndex> {
  return normalizeSketchIndex(await loadData(SKETCH_INDEX_KEY));
}

export async function saveSketchIndex(saveData: (key: string, data: any) => Promise<void>, index: SketchIndex): Promise<void> {
  await saveData(SKETCH_INDEX_KEY, normalizeSketchIndex(index));
}

export function upsertSketchIndexItem(index: SketchIndex, input: {
  sketchId: string;
  blockIds: string[];
  assetName?: string;
  now?: number;
}): SketchIndex {
  const now = input.now ?? Date.now();
  const existing = index.items[input.sketchId];
  const blockIds = Array.from(new Set([...(existing?.blockIds ?? []), ...input.blockIds].filter(Boolean)));
  return {
    version: 1,
    items: {
      ...index.items,
      [input.sketchId]: {
        sketchId: input.sketchId,
        blockIds,
        assetName: input.assetName ?? existing?.assetName ?? sketchAssetFileName(input.sketchId),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      },
    },
  };
}

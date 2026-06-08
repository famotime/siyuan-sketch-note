import type { SketchData } from '@/types/sketch';
import { sketchAssetFileName } from '@/utils/sketchReference';
import { storageKey } from './index';
import { filterSketchReferences, normalizeReferences } from './sketchIdentity';
import { SKETCH_INDEX_KEY, normalizeSketchIndex } from './sketchIndex';
import type { SketchIndex } from './sketchIndex';

export type ReferenceCheckStatus = 'valid' | 'invalid' | 'unknown';

export interface CleanupPlanItemToDelete {
  sketchId: string;
  assetName: string;
  invalidBlockIds: string[];
}

export interface CleanupPlanItemToUpdate {
  sketchId: string;
  validBlockIds: string[];
  invalidBlockIds: string[];
  unknownBlockIds: string[];
}

export interface CleanupPlan {
  total: number;
  validCount: number;
  deleteCount: number;
  updateCount: number;
  unknownCount: number;
  itemsToDelete: CleanupPlanItemToDelete[];
  itemsToUpdate: CleanupPlanItemToUpdate[];
}

export function resolveSketchReferenceStatus(sketchId: string, result: any): ReferenceCheckStatus {
  if (result?.code !== 0 || !result?.data) return 'invalid';
  const kramdown = String(result.data.kramdown ?? '');
  return kramdown.includes(`sketch-note-${sketchId}.png`) || kramdown.includes(`sketch:${sketchId}`)
    ? 'valid'
    : 'invalid';
}

export async function createCleanupPlan(ctx: {
  index: SketchIndex;
  loadSketchData: (sketchId: string) => Promise<SketchData | null>;
  checkReference: (sketchId: string, blockId: string) => Promise<ReferenceCheckStatus>;
}): Promise<CleanupPlan> {
  const itemsToDelete: CleanupPlanItemToDelete[] = [];
  const itemsToUpdate: CleanupPlanItemToUpdate[] = [];
  let validCount = 0;
  let unknownCount = 0;

  for (const item of Object.values(ctx.index.items)) {
    const data = await ctx.loadSketchData(item.sketchId);
    const referenceBlockIds = new Set(item.blockIds);
    for (const reference of normalizeReferences(data?.id?.references)) {
      referenceBlockIds.add(reference.blockId);
    }

    const validBlockIds: string[] = [];
    const invalidBlockIds: string[] = [];
    const unknownBlockIds: string[] = [];

    for (const blockId of referenceBlockIds) {
      const status = await ctx.checkReference(item.sketchId, blockId);
      if (status === 'valid') validBlockIds.push(blockId);
      else if (status === 'invalid') invalidBlockIds.push(blockId);
      else unknownBlockIds.push(blockId);
    }

    if (validBlockIds.length > 0) validCount++;
    if (unknownBlockIds.length > 0) unknownCount++;

    if (validBlockIds.length === 0 && unknownBlockIds.length === 0 && invalidBlockIds.length > 0) {
      itemsToDelete.push({
        sketchId: item.sketchId,
        assetName: item.assetName || sketchAssetFileName(item.sketchId),
        invalidBlockIds,
      });
    } else if (invalidBlockIds.length > 0) {
      itemsToUpdate.push({
        sketchId: item.sketchId,
        validBlockIds,
        invalidBlockIds,
        unknownBlockIds,
      });
    }
  }

  return {
    total: Object.keys(ctx.index.items).length,
    validCount,
    deleteCount: itemsToDelete.length,
    updateCount: itemsToUpdate.length,
    unknownCount,
    itemsToDelete,
    itemsToUpdate,
  };
}

export async function executeCleanupPlan(ctx: {
  index: SketchIndex;
  plan: CleanupPlan;
  loadSketchData: (sketchId: string) => Promise<SketchData | null>;
  saveData: (key: string, data: any) => Promise<void>;
  removeData: (key: string) => Promise<any>;
  removeAsset: (path: string) => Promise<void>;
  now?: number;
}): Promise<{ deleted: number; updated: number; assetDeleteFailed: number }> {
  const nextIndex = normalizeSketchIndex(ctx.index);
  let deleted = 0;
  let updated = 0;
  let assetDeleteFailed = 0;

  for (const item of ctx.plan.itemsToDelete) {
    await ctx.removeData(storageKey(item.sketchId));
    await ctx.removeData(`sketch:${item.sketchId}`);
    try {
      await ctx.removeAsset(`/data/assets/${item.assetName}`);
    } catch {
      assetDeleteFailed++;
    }
    delete nextIndex.items[item.sketchId];
    deleted++;
  }

  for (const item of ctx.plan.itemsToUpdate) {
    const data = await ctx.loadSketchData(item.sketchId);
    if (data) {
      const keptBlockIds = [...item.validBlockIds, ...item.unknownBlockIds];
      await ctx.saveData(storageKey(item.sketchId), filterSketchReferences(data, keptBlockIds, ctx.now));
    }
    const indexItem = nextIndex.items[item.sketchId];
    if (indexItem) {
      nextIndex.items[item.sketchId] = {
        ...indexItem,
        blockIds: [...item.validBlockIds, ...item.unknownBlockIds],
        updatedAt: ctx.now ?? Date.now(),
      };
    }
    updated++;
  }

  await ctx.saveData(SKETCH_INDEX_KEY, nextIndex);
  return { deleted, updated, assetDeleteFailed };
}

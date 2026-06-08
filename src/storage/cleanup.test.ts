import { describe, expect, it } from 'vitest';
import { createCleanupPlan, executeCleanupPlan } from './cleanup';
import { storageKey } from './index';
import type { SketchIndex } from './sketchIndex';
import type { SketchData } from '@/types/sketch';

function sketch(sketchId: string, blockIds: string[]): SketchData {
  return {
    version: 2,
    id: {
      sketchId,
      createdAt: 1,
      updatedAt: 1,
      references: blockIds.map(blockId => ({ blockId, updatedAt: 1 })),
    },
    template: 'blank',
    canvasWidth: 800,
    canvasHeight: 1200,
    strokes: [],
  };
}

function index(): SketchIndex {
  return {
    version: 1,
    items: {
      'sketch-1': {
        sketchId: 'sketch-1',
        blockIds: ['block-a', 'block-b'],
        assetName: 'sketch-note-sketch-1.png',
        createdAt: 1,
        updatedAt: 1,
      },
      'sketch-2': {
        sketchId: 'sketch-2',
        blockIds: ['block-c'],
        assetName: 'sketch-note-sketch-2.png',
        createdAt: 1,
        updatedAt: 1,
      },
    },
  };
}

describe('createCleanupPlan', () => {
  it('keeps a sketch when at least one block still references it and only removes invalid references', async () => {
    const plan = await createCleanupPlan({
      index: index(),
      loadSketchData: async sketchId => sketch(sketchId, sketchId === 'sketch-1' ? ['block-a', 'block-b'] : ['block-c']),
      checkReference: async (_sketchId, blockId) => blockId === 'block-a' ? 'valid' : 'invalid',
    });

    expect(plan.itemsToDelete.map(item => item.sketchId)).toEqual(['sketch-2']);
    expect(plan.itemsToUpdate).toEqual([
      {
        sketchId: 'sketch-1',
        validBlockIds: ['block-a'],
        invalidBlockIds: ['block-b'],
        unknownBlockIds: [],
      },
    ]);
  });

  it('does not delete a sketch when a reference check is unknown', async () => {
    const plan = await createCleanupPlan({
      index: {
        version: 1,
        items: {
          'sketch-1': index().items['sketch-1'],
        },
      },
      loadSketchData: async sketchId => sketch(sketchId, ['block-a', 'block-b']),
      checkReference: async (_sketchId, blockId) => blockId === 'block-a' ? 'invalid' : 'unknown',
    });

    expect(plan.itemsToDelete).toHaveLength(0);
    expect(plan.itemsToUpdate[0]).toMatchObject({
      sketchId: 'sketch-1',
      validBlockIds: [],
      invalidBlockIds: ['block-a'],
      unknownBlockIds: ['block-b'],
    });
  });
});

describe('executeCleanupPlan', () => {
  it('deletes unreferenced sketches and updates sketches that still have valid references', async () => {
    const removedData: string[] = [];
    const removedAssets: string[] = [];
    const saved: Record<string, any> = {};
    const sourceIndex = index();
    const sourceData = sketch('sketch-1', ['block-a', 'block-b']);

    const result = await executeCleanupPlan({
      index: sourceIndex,
      plan: {
        total: 2,
        validCount: 1,
        deleteCount: 1,
        updateCount: 1,
        unknownCount: 0,
        itemsToDelete: [{ sketchId: 'sketch-2', assetName: 'sketch-note-sketch-2.png', invalidBlockIds: ['block-c'] }],
        itemsToUpdate: [{ sketchId: 'sketch-1', validBlockIds: ['block-a'], invalidBlockIds: ['block-b'], unknownBlockIds: [] }],
      },
      loadSketchData: async () => sourceData,
      saveData: async (key, data) => { saved[key] = data; },
      removeData: async key => { removedData.push(key); },
      removeAsset: async path => { removedAssets.push(path); },
      now: 5000,
    });

    expect(result.deleted).toBe(1);
    expect(result.updated).toBe(1);
    expect(removedData).toContain(storageKey('sketch-2'));
    expect(removedAssets).toEqual(['/data/assets/sketch-note-sketch-2.png']);
    expect(saved[storageKey('sketch-1')].id.references).toEqual([{ blockId: 'block-a', updatedAt: 1 }]);
    expect(saved['sketch-index.json'].items['sketch-2']).toBeUndefined();
    expect(saved['sketch-index.json'].items['sketch-1'].blockIds).toEqual(['block-a']);
  });
});

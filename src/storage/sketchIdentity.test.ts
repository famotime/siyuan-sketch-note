import { describe, expect, it } from 'vitest';
import { normalizeSketchDataForSave } from './sketchIdentity';
import type { SketchData } from '@/types/sketch';

function baseData(): SketchData {
  return {
    version: 1,
    template: 'blank',
    canvasWidth: 800,
    canvasHeight: 1200,
    strokes: [],
  };
}

describe('normalizeSketchDataForSave', () => {
  it('upgrades v1 sketch data and records the source block reference', () => {
    const data = normalizeSketchDataForSave(baseData(), {
      now: 1000,
      sketchId: 'sketch-1',
      sourceBlockId: 'block-a',
    });

    expect(data.version).toBe(2);
    expect(data.id).toEqual({
      sketchId: 'sketch-1',
      createdAt: 1000,
      updatedAt: 1000,
      references: [{ blockId: 'block-a', updatedAt: 1000 }],
    });
  });

  it('adds a new block reference without dropping existing references', () => {
    const original = normalizeSketchDataForSave(baseData(), {
      now: 1000,
      sketchId: 'sketch-1',
      sourceBlockId: 'block-a',
    });

    const data = normalizeSketchDataForSave(original, {
      now: 2000,
      sketchId: 'sketch-1',
      sourceBlockId: 'block-b',
    });

    expect(data.id?.createdAt).toBe(1000);
    expect(data.id?.updatedAt).toBe(2000);
    expect(data.id?.references).toEqual([
      { blockId: 'block-a', updatedAt: 1000 },
      { blockId: 'block-b', updatedAt: 2000 },
    ]);
  });

  it('refreshes an existing block reference timestamp', () => {
    const original = normalizeSketchDataForSave(baseData(), {
      now: 1000,
      sketchId: 'sketch-1',
      sourceBlockId: 'block-a',
    });

    const data = normalizeSketchDataForSave(original, {
      now: 3000,
      sketchId: 'sketch-1',
      sourceBlockId: 'block-a',
    });

    expect(data.id?.references).toEqual([{ blockId: 'block-a', updatedAt: 3000 }]);
  });
});

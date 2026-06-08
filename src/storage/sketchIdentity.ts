import type { SketchData, SketchReference } from '@/types/sketch';

export interface NormalizeSketchDataForSaveOptions {
  sketchId: string;
  sourceBlockId?: string | null;
  now?: number;
}

export function normalizeSketchDataForSave(
  data: SketchData,
  options: NormalizeSketchDataForSaveOptions,
): SketchData {
  const now = options.now ?? Date.now();
  const existingId = data.id;
  const references = normalizeReferences(existingId?.references);
  const sourceBlockId = options.sourceBlockId?.trim();

  if (sourceBlockId) {
    const existing = references.find(reference => reference.blockId === sourceBlockId);
    if (existing) {
      existing.updatedAt = now;
    } else {
      references.push({ blockId: sourceBlockId, updatedAt: now });
    }
  }

  return {
    ...data,
    id: {
      sketchId: options.sketchId,
      createdAt: existingId?.createdAt ?? now,
      updatedAt: now,
      references,
    },
    version: 2,
  };
}

export function normalizeReferences(input: unknown): SketchReference[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const references: SketchReference[] = [];
  for (const item of input) {
    const blockId = typeof item?.blockId === 'string' ? item.blockId.trim() : '';
    if (!blockId || seen.has(blockId)) continue;
    seen.add(blockId);
    references.push({
      blockId,
      updatedAt: typeof item?.updatedAt === 'number' ? item.updatedAt : 0,
    });
  }
  return references;
}

export function filterSketchReferences(data: SketchData, blockIdsToKeep: string[], now = Date.now()): SketchData {
  const keep = new Set(blockIdsToKeep);
  const references = normalizeReferences(data.id?.references).filter(reference => keep.has(reference.blockId));
  return {
    ...data,
    id: data.id
      ? { ...data.id, references, updatedAt: now }
      : data.id,
  };
}

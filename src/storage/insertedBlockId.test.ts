import { describe, expect, it } from 'vitest';
import { extractInsertedBlockId } from './insertedBlockId';

describe('extractInsertedBlockId', () => {
  it('extracts the generated block id from SiYuan insertBlock operations', () => {
    expect(extractInsertedBlockId({
      code: 0,
      data: [{
        doOperations: [{
          action: 'insert',
          id: '20211230115020-g02dfx0',
        }],
      }],
    })).toBe('20211230115020-g02dfx0');
  });

  it('returns null when no insert operation id is present', () => {
    expect(extractInsertedBlockId({ code: 0, data: [] })).toBeNull();
  });
});

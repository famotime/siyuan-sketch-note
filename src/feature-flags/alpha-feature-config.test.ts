import { describe, it, expect } from 'vitest';
import {
  isSettingHidden,
  isTopbarHidden,
  getHiddenSettingKeySet,
  getHiddenTopbarKeySet,
} from './alpha-feature-config';

describe('alpha-feature-config', () => {
  it('returns correct hidden setting keys', () => {
    const set = getHiddenSettingKeySet();
    expect(set).toBeInstanceOf(Set);
    expect(set.has('replay')).toBe(true);
  });

  it('returns correct hidden topbar keys', () => {
    const set = getHiddenTopbarKeySet();
    expect(set).toBeInstanceOf(Set);
    expect(set.has('replay')).toBe(true);
    expect(set.has('insertImage')).toBe(true);
    expect(set.has('undo')).toBe(false);
  });

  it('isSettingHidden reflects config', () => {
    expect(isSettingHidden('replay')).toBe(true);
  });

  it('isTopbarHidden reflects config for hidden keys', () => {
    expect(isTopbarHidden('replay')).toBe(true);
    expect(isTopbarHidden('insertImage')).toBe(true);
  });

  it('isTopbarHidden returns false for non-hidden keys', () => {
    expect(isTopbarHidden('undo')).toBe(false);
    expect(isTopbarHidden('redo')).toBe(false);
    expect(isTopbarHidden('zenMode')).toBe(false);
    expect(isTopbarHidden('moreMenu')).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import {
  isSettingHidden,
  isTopbarHidden,
  getHiddenSettingKeySet,
  getHiddenTopbarKeySet,
} from './alpha-feature-config';

describe('alpha-feature-config', () => {
  it('no features are hidden by default', () => {
    expect(getHiddenSettingKeySet().size).toBe(0);
    expect(getHiddenTopbarKeySet().size).toBe(0);
  });

  it('isSettingHidden returns false for all keys by default', () => {
    expect(isSettingHidden('replay')).toBe(false);
  });

  it('isTopbarHidden returns false for all keys by default', () => {
    expect(isTopbarHidden('undo')).toBe(false);
    expect(isTopbarHidden('redo')).toBe(false);
    expect(isTopbarHidden('replay')).toBe(false);
    expect(isTopbarHidden('insertImage')).toBe(false);
    expect(isTopbarHidden('zenMode')).toBe(false);
    expect(isTopbarHidden('moreMenu')).toBe(false);
  });

  it('getHiddenTopbarKeySet returns a Set instance', () => {
    const set = getHiddenTopbarKeySet();
    expect(set).toBeInstanceOf(Set);
    expect(set.has('undo')).toBe(false);
  });

  it('getHiddenSettingKeySet returns a Set instance', () => {
    const set = getHiddenSettingKeySet();
    expect(set).toBeInstanceOf(Set);
    expect(set.has('replay')).toBe(false);
  });
});

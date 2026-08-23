import { describe, it, expect } from 'vitest';
import {
  isSettingHidden,
  isTopbarHidden,
  isMoreMenuHidden,
  getHiddenSettingKeySet,
  getHiddenTopbarKeySet,
  getHiddenMoreMenuKeySet,
} from './alpha-feature-config';

describe('alpha-feature-config', () => {
  it('getHiddenSettingKeySet returns a Set', () => {
    expect(getHiddenSettingKeySet()).toBeInstanceOf(Set);
  });

  it('getHiddenTopbarKeySet returns a Set', () => {
    expect(getHiddenTopbarKeySet()).toBeInstanceOf(Set);
  });

  it('getHiddenMoreMenuKeySet returns a Set', () => {
    expect(getHiddenMoreMenuKeySet()).toBeInstanceOf(Set);
  });

  it('isSettingHidden returns boolean', () => {
    expect(typeof isSettingHidden('replay')).toBe('boolean');
  });

  it('isTopbarHidden returns boolean for each key', () => {
    const keys = ['undo', 'redo', 'replay', 'insertImage', 'zenMode', 'moreMenu'] as const;
    for (const key of keys) {
      expect(typeof isTopbarHidden(key)).toBe('boolean');
    }
  });

  it('isMoreMenuHidden returns boolean for each key', () => {
    const keys = [
      'clear',
      'export',
      'exportSketchData',
      'importSketch',
      'cleanupInvalidSketches',
      'live',
      'template',
      'backgroundFit',
      'stylusOnly',
      'enablePressure',
    ] as const;
    for (const key of keys) {
      expect(typeof isMoreMenuHidden(key)).toBe('boolean');
    }
  });
});

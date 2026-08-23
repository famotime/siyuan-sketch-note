// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import EditorTopBar from './EditorTopBar.vue';

describe('editorTopBar more menu', () => {
  const baseProps = {
    canRedo: false,
    canUndo: false,
    exportIncludeBackground: true,
    exportIncludeSketchData: true,
    hiddenTopbarKeys: new Set<string>(),
    ocrState: 'idle',
    pageOverview: [],
    pageState: { current: 1, total: 1 },
    recovered: false,
    searchResultCount: 0,
    showReplay: false,
    stylusOnly: false,
    enablePressure: true,
    templateId: 'blank',
    themeMode: 'light',
    templates: [{ id: 'blank', nameKey: 'blank' }],
    t: (key: string) => key,
  } as const;

  it('emits cleanupInvalidSketches when the cleanup entry is clicked', async () => {
    const wrapper = mount(EditorTopBar, {
      props: baseProps,
    });

    await wrapper.find('.sketch-btn--more').trigger('click');
    const cleanupEntry = wrapper
      .findAll('.sketch-more-row--action')
      .find((row) => row.text().includes('cleanupInvalidSketches'));

    expect(cleanupEntry).toBeTruthy();
    await cleanupEntry!.trigger('click');

    expect(wrapper.emitted('cleanup-invalid-sketches')).toHaveLength(1);
    expect(wrapper.find('.sketch-more-popover').exists()).toBe(false);
  });

  it('hides specific menu items when configured in hiddenMoreMenuKeys', async () => {
    const wrapper = mount(EditorTopBar, {
      props: {
        ...baseProps,
        hiddenMoreMenuKeys: new Set(['clear', 'cleanupInvalidSketches']),
      },
    });

    await wrapper.find('.sketch-btn--more').trigger('click');
    const text = wrapper.find('.sketch-more-popover').text();

    expect(text).not.toContain('clear');
    expect(text).not.toContain('cleanupInvalidSketches');
    expect(text).toContain('export');
    expect(text).toContain('importSketch');
  });

  it('hides the entire more menu button when all child items are hidden', () => {
    const allMoreKeys = new Set([
      'clear',
      'export',
      'importSketch',
      'cleanupInvalidSketches',
      'live',
      'template',
      'backgroundFit',
      'stylusOnly',
      'enablePressure',
    ]);

    const wrapper = mount(EditorTopBar, {
      props: {
        ...baseProps,
        hiddenMoreMenuKeys: allMoreKeys,
      },
    });

    expect(wrapper.find('.sketch-btn--more').exists()).toBe(false);
  });

  it('does not render divider when only bottom settings are visible', async () => {
    const topActionKeys = new Set([
      'clear',
      'export',
      'importSketch',
      'cleanupInvalidSketches',
      'live',
    ]);

    const wrapper = mount(EditorTopBar, {
      props: {
        ...baseProps,
        hiddenMoreMenuKeys: topActionKeys,
      },
    });

    await wrapper.find('.sketch-btn--more').trigger('click');
    expect(wrapper.find('.sketch-more-divider').exists()).toBe(false);
  });
});

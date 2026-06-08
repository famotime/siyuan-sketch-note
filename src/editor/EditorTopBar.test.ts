// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import EditorTopBar from './EditorTopBar.vue'

describe('EditorTopBar more menu', () => {
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
  } as const

  it('emits cleanupInvalidSketches when the cleanup entry is clicked', async () => {
    const wrapper = mount(EditorTopBar, {
      props: baseProps,
    })

    await wrapper.find('.sketch-btn--more').trigger('click')
    const cleanupEntry = wrapper
      .findAll('.sketch-more-row--action')
      .find(row => row.text().includes('cleanupInvalidSketches'))

    expect(cleanupEntry).toBeTruthy()
    await cleanupEntry!.trigger('click')

    expect(wrapper.emitted('cleanup-invalid-sketches')).toHaveLength(1)
    expect(wrapper.find('.sketch-more-popover').exists()).toBe(false)
  })
})

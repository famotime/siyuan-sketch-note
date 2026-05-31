// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ToolDropdown from './ToolDropdown.vue'
import ToolBar from './ToolBar.vue'

describe('ToolDropdown', () => {
  it('renders trigger slot', () => {
    const wrapper = mount(ToolDropdown, {
      props: { modelValue: false },
      slots: { trigger: '<button>Pen</button>' },
    })
    expect(wrapper.find('.sketch-tool-dropdown__trigger').text()).toBe('Pen')
  })

  it('shows arrow indicator', () => {
    const wrapper = mount(ToolDropdown, {
      props: { modelValue: false },
      slots: { trigger: '<button>Pen</button>' },
    })
    expect(wrapper.find('.sketch-tool-dropdown__arrow').exists()).toBe(true)
  })

  it('does not render dropdown panel when modelValue is false', () => {
    const wrapper = mount(ToolDropdown, {
      props: { modelValue: false },
      slots: { dropdown: '<div>Options</div>' },
    })
    expect(wrapper.find('.sketch-tool-dropdown__panel').exists()).toBe(false)
  })

  it('renders dropdown panel when modelValue is true', () => {
    const wrapper = mount(ToolDropdown, {
      props: { modelValue: true },
      slots: { dropdown: '<div>Options</div>' },
    })
    expect(wrapper.find('.sketch-tool-dropdown__panel').exists()).toBe(true)
  })

  it('does not emit update:modelValue when trigger body is clicked', async () => {
    const wrapper = mount(ToolDropdown, {
      props: { modelValue: false },
      slots: { trigger: '<button>Pen</button>' },
    })
    await wrapper.find('.sketch-tool-dropdown__trigger').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('emits update:modelValue when arrow area is clicked', async () => {
    const wrapper = mount(ToolDropdown, {
      props: { modelValue: false },
      slots: { trigger: '<button>Pen</button>' },
    })
    await wrapper.find('.sketch-tool-dropdown__arrow').trigger('click')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([true])
  })
})

describe('ToolBar dropdown triggers', () => {
  const baseProps = {
    activeTool: 'eraser',
    lastShapeTool: 'line',
    penSubtype: 'ballpoint',
    highlighterSubtype: 'round',
    t: (key: string) => key,
  } as const

  it('selects pen without opening the pen menu when the button body is clicked', async () => {
    const wrapper = mount(ToolBar, {
      props: baseProps,
    })

    await wrapper.find('[data-tool="pen"]').trigger('click')

    expect(wrapper.emitted('selectTool')![0]).toEqual(['pen'])
    expect(wrapper.find('.sketch-tool-dropdown__panel').exists()).toBe(false)
  })

  it('opens the pen menu without selecting pen when the arrow area is clicked', async () => {
    const wrapper = mount(ToolBar, {
      props: baseProps,
    })

    await wrapper.find('.sketch-tool-dropdown__arrow').trigger('click')

    expect(wrapper.emitted('selectTool')).toBeUndefined()
    expect(wrapper.find('.sketch-tool-dropdown__panel').exists()).toBe(true)
  })
})

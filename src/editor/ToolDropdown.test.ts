// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ToolDropdown from './ToolDropdown.vue'

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

  it('emits update:modelValue when trigger is clicked', async () => {
    const wrapper = mount(ToolDropdown, {
      props: { modelValue: false },
      slots: { trigger: '<button>Pen</button>' },
    })
    await wrapper.find('.sketch-tool-dropdown__trigger').trigger('click')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([true])
  })
})

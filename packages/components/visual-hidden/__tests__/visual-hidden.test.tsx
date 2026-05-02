import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import VisualHidden from '../src/visual-hidden.vue'

describe('VisualHidden.vue', () => {
  it('renders accessible slot content with visually hidden styles', () => {
    const wrapper = mount(VisualHidden, {
      attrs: {
        id: 'assistive-text',
      },
      slots: {
        default: 'Only screen readers',
      },
    })

    const element = wrapper.element as HTMLElement
    expect(wrapper.text()).toBe('Only screen readers')
    expect(wrapper.attributes('id')).toBe('assistive-text')
    expect(element.style.position).toBe('absolute')
    expect(element.style.overflow).toBe('hidden')
    expect(element.style.whiteSpace).toBe('nowrap')
  })

  it('merges custom style with hidden boundary styles', () => {
    const wrapper = mount(() => (
      <VisualHidden style={{ color: 'red' }}>merged styles</VisualHidden>
    ))

    const element = wrapper.element as HTMLElement
    const style = wrapper.attributes('style')
    expect(element.style.color).toBe('red')
    expect(style).toContain('position: absolute;')
    expect(style).toContain('clip: rect(0px, 0px, 0px, 0px);')
  })
})

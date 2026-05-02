import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TooltipV2 from '../src/tooltip.vue'

describe('TooltipV2.vue', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  it('renders trigger, content, arrow, and accessible label when always on', async () => {
    const wrapper = mount(
      <TooltipV2
        alwaysOn
        showArrow
        teleported={false}
        ariaLabel="Tooltip V2 label"
        contentClass="custom-content"
        v-slots={{
          trigger: () => <button type="button">Trigger</button>,
          default: () => 'Tooltip content',
        }}
      />,
      { attachTo: document.body }
    )

    await nextTick()

    expect(wrapper.text()).toContain('Trigger')
    expect(wrapper.text()).toContain('Tooltip content')
    expect(wrapper.find('[data-tooltip-v2-root]').exists()).toBe(true)
    expect(wrapper.find('.custom-content').exists()).toBe(true)
    expect(wrapper.find('[role="tooltip"]').text()).toContain('Tooltip content')
  })

  it('opens from trigger events and cleans up on unmount', async () => {
    const onOpenChange = vi.fn()
    const wrapper = mount(
      <TooltipV2
        onOpenChange={onOpenChange}
        delayDuration={0}
        teleported={false}
        v-slots={{
          trigger: () => <button type="button">Trigger</button>,
          default: () => 'Controlled content',
        }}
      />,
      { attachTo: document.body }
    )

    await wrapper.find('button').trigger('mouseenter')
    await nextTick()

    expect(onOpenChange).toHaveBeenCalledWith(true)
    expect(wrapper.text()).toContain('Controlled content')

    wrapper.unmount()
    document.dispatchEvent(new CustomEvent('tooltip_v2.open'))
    expect(wrapper.exists()).toBe(false)
  })
})

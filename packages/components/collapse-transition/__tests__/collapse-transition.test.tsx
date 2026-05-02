import { nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CollapseTransition from '../src/collapse-transition.vue'

describe('CollapseTransition.vue', () => {
  it('renders slot content and toggles without leaking nodes', async () => {
    const visible = ref(true)
    const wrapper = mount({
      setup() {
        return () => (
          <CollapseTransition>
            {visible.value ? <div class="panel">content</div> : null}
          </CollapseTransition>
        )
      },
    })

    expect(wrapper.find('.panel').exists()).toBe(true)

    visible.value = false
    await nextTick()
    expect(wrapper.find('.panel').exists()).toBe(false)

    wrapper.unmount()
    expect(wrapper.find('.panel').exists()).toBe(false)
  })
})

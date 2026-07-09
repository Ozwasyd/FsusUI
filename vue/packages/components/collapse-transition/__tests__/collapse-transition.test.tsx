import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CollapseTransition from '../src/collapse-transition.vue'

const sourcePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/collapse-transition.vue')

describe('CollapseTransition.vue', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 0
    })
  })

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

  it('locks the expanded height before scheduling the collapsed target', () => {
    const source = fs.readFileSync(sourcePath, 'utf8')

    expect(source).toContain('el.style.maxHeight = `${scrollHeight}px`')
    expect(source).toContain('void el.offsetHeight')
    expect(source).toMatch(/requestAnimationFrame\(\(\) => \{\s+el\.style\.maxHeight = 0/)
    expect(source).not.toMatch(/requestAnimationFrame\(\(\) => \{\s+el\.style\.maxHeight = `\$\{scrollHeight\}px`/)
  })
})

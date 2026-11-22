import { nextTick, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, test, vi } from 'vitest'
import Tabs from '../src/tabs'
import TabPane from '../src/tab-pane.vue'

const arrows = ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']

describe('Tabs disabled keyboard navigation', () => {
  test.each(
    arrows.flatMap(
      (code) =>
        [
          [code, true],
          [code, false],
        ] as const,
    ),
  )(
    '%s is inert when the focused pane becomes disabled (all disabled: %s)',
    async (code, allDisabled) => {
      const active = ref('a')
      const disabled = ref(false)
      const errors: unknown[] = []
      const onTabClick = vi.fn()
      const onTabChange = vi.fn()
      const host = document.createElement('div')
      document.body.appendChild(host)
      const wrapper = mount(
        () => (
          <Tabs
            v-model={active.value}
            onTabClick={onTabClick}
            onTabChange={onTabChange}
          >
            {['a', 'b', 'c'].map((name) => (
              <TabPane
                key={name}
                name={name}
                label={name}
                disabled={disabled.value && (allDisabled || name === 'a')}
              />
            ))}
          </Tabs>
        ),
        {
          attachTo: host,
          global: { config: { errorHandler: (error) => errors.push(error) } },
        },
      )
      try {
        await nextTick()
        const tab = wrapper.get<HTMLElement>('#tab-a').element
        tab.focus()
        expect(document.activeElement).toBe(tab)
        disabled.value = true
        await nextTick()
        expect(wrapper.get('#tab-a').element).toBe(tab)
        expect(tab.tabIndex).toBe(-1)
        expect(document.activeElement).toBe(tab)
        const onNativeClick = vi.fn()
        wrapper.findAll('[role="tab"]').forEach((item) => {
          item.element.addEventListener('click', onNativeClick)
        })

        await wrapper.get('#tab-a').trigger('keydown', { code })
        await flushPromises()
        expect(errors).toEqual([])
        expect(document.activeElement).toBe(tab)
        expect(active.value).toBe('a')
        expect(onTabClick).not.toHaveBeenCalled()
        expect(onTabChange).not.toHaveBeenCalled()
        expect(onNativeClick).not.toHaveBeenCalled()
      } finally {
        wrapper.unmount()
        host.remove()
      }
    },
  )

  test.each(arrows)(
    '%s leaves a focusable label descendant alone',
    async (code) => {
      const active = ref('b')
      const errors: unknown[] = []
      const onTabClick = vi.fn()
      const host = document.createElement('div')
      document.body.appendChild(host)
      const wrapper = mount(
        () => (
          <Tabs v-model={active.value} onTabClick={onTabClick}>
            <TabPane name="a" label="a" />
            <TabPane
              name="b"
              v-slots={{ label: () => <button>Label action</button> }}
            />
            <TabPane name="c" label="c" />
          </Tabs>
        ),
        {
          attachTo: host,
          global: { config: { errorHandler: (error) => errors.push(error) } },
        },
      )
      try {
        await nextTick()
        const button = wrapper.get<HTMLButtonElement>('button')
        button.element.focus()
        await button.trigger('keydown', { code })
        await flushPromises()
        expect(errors).toEqual([])
        expect(document.activeElement).toBe(button.element)
        expect(active.value).toBe('b')
        expect(onTabClick).not.toHaveBeenCalled()
      } finally {
        wrapper.unmount()
        host.remove()
      }
    },
  )

  test.each([
    ['ArrowRight', 'a', 'c'],
    ['ArrowDown', 'a', 'c'],
    ['ArrowLeft', 'c', 'a'],
    ['ArrowUp', 'c', 'a'],
    ['ArrowLeft', 'a', 'c'],
    ['ArrowUp', 'a', 'c'],
    ['ArrowRight', 'c', 'a'],
    ['ArrowDown', 'c', 'a'],
  ])(
    '%s skips disabled panes and wraps from %s to %s',
    async (code, from, to) => {
      const active = ref(from)
      const host = document.createElement('div')
      document.body.appendChild(host)
      const wrapper = mount(
        () => (
          <Tabs v-model={active.value}>
            <TabPane name="a" label="a" />
            <TabPane name="b" label="b" disabled />
            <TabPane name="c" label="c" />
          </Tabs>
        ),
        { attachTo: host },
      )
      try {
        await nextTick()
        const disabledClick = vi.fn()
        wrapper.get('#tab-b').element.addEventListener('click', disabledClick)
        wrapper.get<HTMLElement>(`#tab-${from}`).element.focus()
        await wrapper.get(`#tab-${from}`).trigger('keydown', { code })
        await flushPromises()
        expect(document.activeElement).toBe(wrapper.get(`#tab-${to}`).element)
        expect(active.value).toBe(to)
        expect(disabledClick).not.toHaveBeenCalled()
      } finally {
        wrapper.unmount()
        host.remove()
      }
    },
  )

  test.each(arrows)('%s still respects beforeLeave rejection', async (code) => {
    const active = ref('a')
    const beforeLeave = vi.fn(() => false)
    const wrapper = mount(() => (
      <Tabs v-model={active.value} beforeLeave={beforeLeave}>
        <TabPane name="a" label="a" />
        <TabPane name="b" label="b" />
      </Tabs>
    ))
    await nextTick()
    await wrapper.get('#tab-a').trigger('keydown', { code })
    await flushPromises()
    expect(beforeLeave).toHaveBeenCalledWith('b', 'a')
    expect(active.value).toBe('a')
  })
})

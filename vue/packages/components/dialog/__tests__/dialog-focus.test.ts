import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { ElDialog } from '../index'

// Source regression coverage: jsdom does not establish WebKit acceptance.
describe('ElDialog focus restoration', () => {
  const wrappers: ReturnType<typeof mount>[] = []
  const settle = async () => {
    await nextTick()
    await nextTick()
    await nextTick()
  }
  const clickWithoutFocus = (element: Element) => {
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
  }
  const create = (destroyOnClose = false) => {
    const open = ref(false)
    const nested = ref(false)
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h('div', [
            h('input', { 'aria-label': 'Previous focus' }),
            h(
              'button',
              {
                onClick: () => {
                  open.value = true
                },
              },
              [h('span', 'Open')],
            ),
            h(
              ElDialog,
              {
                modelValue: open.value,
                'onUpdate:modelValue': (value: boolean) => {
                  open.value = value
                },
                title: 'Parent',
                appendToBody: true,
                destroyOnClose,
              },
              () => [
                h(
                  'button',
                  {
                    onClick: () => {
                      open.value = false
                    },
                  },
                  'Close',
                ),
                h(
                  'button',
                  {
                    onClick: () => {
                      nested.value = true
                    },
                  },
                  [h('span', 'Nested')],
                ),
              ],
            ),
            h(
              ElDialog,
              {
                modelValue: nested.value,
                'onUpdate:modelValue': (value: boolean) => {
                  nested.value = value
                },
                title: 'Child',
                appendToBody: true,
              },
              () =>
                h(
                  'button',
                  {
                    onClick: () => {
                      nested.value = false
                    },
                  },
                  'Close child',
                ),
            ),
          ]),
      }),
      { attachTo: document.body },
    )
    wrappers.push(wrapper)
    const trigger = wrapper.find('button').element as HTMLButtonElement
    return { wrapper, trigger, open, nested }
  }

  afterEach(() => {
    wrappers
      .splice(0)
      .reverse()
      .forEach((wrapper) => wrapper.unmount())
    document.body.innerHTML = ''
  })

  for (const destroy of [false, true]) {
    it(`restores the actual unfocused pointer opener repeatedly (destroy=${destroy})`, async () => {
      const { wrapper, trigger, open } = create(destroy)
      await settle()
      for (let i = 0; i < 3; i++) {
        ;(wrapper.find('input').element as HTMLInputElement).focus()
        clickWithoutFocus(trigger.firstElementChild!)
        await settle()
        expect(document.activeElement).not.toBe(trigger)
        const close = Array.from(document.querySelectorAll('button')).find(
          (button) => button.textContent === 'Close',
        )!
        clickWithoutFocus(close)
        await settle()
        expect(open.value).toBe(false)
        expect(document.activeElement).toBe(trigger)
      }
    })
  }

  it('preserves keyboard opening and Escape restoration', async () => {
    const { trigger, open } = create()
    await settle()
    trigger.focus()
    trigger.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    )
    open.value = true
    await settle()
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    await settle()
    expect(document.activeElement).toBe(trigger)
  })

  it('restores focus after external close and an interrupted close/reopen', async () => {
    const { trigger, open } = create()
    await settle()
    clickWithoutFocus(trigger)
    await settle()
    open.value = false
    await nextTick()
    open.value = true
    await settle()
    expect(document.activeElement).not.toBe(trigger)
    open.value = false
    await settle()
    expect(document.activeElement).toBe(trigger)
  })

  it('restores a nested opener without releasing the parent focus layer', async () => {
    const { trigger, open, nested } = create()
    await settle()
    clickWithoutFocus(trigger)
    await settle()
    const nestedTrigger = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'Nested',
    )!
    clickWithoutFocus(nestedTrigger.firstElementChild!)
    await settle()
    nested.value = false
    await settle()
    expect(document.activeElement).toBe(nestedTrigger)
    expect(open.value).toBe(true)
    open.value = false
    await settle()
    expect(document.activeElement).toBe(trigger)
  })

  it('does not let a paused parent steal focus from an open child', async () => {
    const { trigger, open, nested } = create()
    await settle()
    clickWithoutFocus(trigger)
    await settle()
    const nestedTrigger = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'Nested',
    )!
    clickWithoutFocus(nestedTrigger)
    await settle()
    const childFocus = document.activeElement
    open.value = false
    await settle()
    expect(nested.value).toBe(true)
    expect(document.activeElement).toBe(childFocus)
  })
})

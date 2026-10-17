import { h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { rAF } from '@element-plus/test-utils/tick'
import Drawer from '../index'

const createDrawer = (buttonCount = 2) =>
  mount(Drawer, {
    attachTo: document.body,
    props: {
      modelValue: true,
      title: 'Keyboard containment',
      withHeader: false,
      showClose: false,
    },
    slots: {
      default: () =>
        Array.from({ length: buttonCount }, (_, index) =>
          h('button', { type: 'button' }, `Action ${index + 1}`)
        ),
    },
  })

const pressTab = (target: HTMLElement, shiftKey = false) => {
  const event = new KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey,
    bubbles: true,
    cancelable: true,
  })
  target.dispatchEvent(event)
  return event
}

const waitForOpening = async () => {
  await nextTick()
  await rAF()
  await nextTick()
}

describe('Drawer programmatic focus boundaries', () => {
  let wrapper: ReturnType<typeof createDrawer> | undefined

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    document.body.innerHTML = ''
  })

  it('wraps at the real buttons after the initial sentinel populated the cache', async () => {
    wrapper = createDrawer()
    await waitForOpening()
    const sentinel = wrapper.get<HTMLElement>('[tabindex="-1"]').element
    const buttons = wrapper.findAll<HTMLButtonElement>('button')
    const first = buttons[0].element
    const last = buttons[1].element
    expect(document.activeElement).toBe(sentinel)
    expect(pressTab(sentinel).defaultPrevented).toBe(false)

    // JSDOM has no native Tab traversal. Position focus explicitly and check
    // the real handler's synchronous prevention/wrap before any rescue timer.
    first.focus()
    expect(pressTab(first, true).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(last)
    expect(pressTab(last).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(first)
    expect(pressTab(first, true).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(last)
  })

  it('preserves reverse traversal directly from the initial sentinel', async () => {
    wrapper = createDrawer()
    await waitForOpening()
    const sentinel = wrapper.get<HTMLElement>('[tabindex="-1"]').element
    const buttons = wrapper.findAll<HTMLButtonElement>('button')
    expect(document.activeElement).toBe(sentinel)
    expect(pressTab(sentinel, true).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(buttons[1].element)
    expect(pressTab(buttons[1].element).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(buttons[0].element)
  })

  it.each([0, 1])(
    'keeps both boundaries trapped with %i real buttons',
    async (buttonCount) => {
      wrapper = createDrawer(buttonCount)
      await waitForOpening()
      const sentinel = wrapper.get<HTMLElement>('[tabindex="-1"]').element
      expect(document.activeElement).toBe(sentinel)
      if (buttonCount === 0) {
        expect(pressTab(sentinel).defaultPrevented).toBe(true)
        expect(document.activeElement).toBe(sentinel)
        expect(pressTab(sentinel, true).defaultPrevented).toBe(true)
        expect(document.activeElement).toBe(sentinel)
      } else {
        expect(pressTab(sentinel).defaultPrevented).toBe(false)
        const button = wrapper.get<HTMLButtonElement>('button').element
        button.focus()
        expect(pressTab(button).defaultPrevented).toBe(true)
        expect(document.activeElement).toBe(button)
        expect(pressTab(button, true).defaultPrevented).toBe(true)
        expect(document.activeElement).toBe(button)
      }
    }
  )
})

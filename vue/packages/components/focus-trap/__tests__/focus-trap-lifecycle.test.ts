import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ElFocusTrap from '../src/focus-trap.vue'

describe('focus-trap lifecycle cancellation', () => {
  const wrappers: ReturnType<typeof mount>[] = []
  const settle = async () => {
    await nextTick()
    await nextTick()
    await nextTick()
  }
  const setup = (handlers = {}) => {
    const trigger = document.createElement('button')
    const container = document.createElement('div')
    container.tabIndex = -1
    document.body.append(trigger, container)
    trigger.focus()
    const wrapper = mount(ElFocusTrap, {
      props: {
        trapped: false,
        focusTrapEl: container,
        focusStartEl: 'container',
        ...handlers,
      },
    })
    wrappers.push(wrapper)
    return { wrapper, trigger, container }
  }

  afterEach(() => {
    wrappers
      .splice(0)
      .reverse()
      .forEach((wrapper) => wrapper.unmount())
    document.body.innerHTML = ''
  })

  it('cancels queued focus when trapping is interrupted by a close', async () => {
    const { wrapper, trigger, container } = setup({
      onFocusAfterTrapped: () => {
        void wrapper.setProps({ trapped: false })
      },
    })
    const focus = vi.spyOn(container, 'focus')
    await wrapper.setProps({ trapped: true })
    await settle()
    expect(focus).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(trigger)
  })

  it('does not focus or emit release from a start canceled by unmount', async () => {
    const released = vi.fn()
    const { wrapper, trigger, container } = setup({
      onFocusAfterReleased: released,
    })
    const focus = vi.spyOn(container, 'focus')
    const pending = wrapper.setProps({ trapped: true })
    wrapper.unmount()
    await pending
    await settle()
    expect(focus).not.toHaveBeenCalled()
    expect(released).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(trigger)
  })

  it('honors canceled restoration', async () => {
    const { wrapper, container } = setup({
      onFocusAfterReleased: (event: Event) => event.preventDefault(),
    })
    await wrapper.setProps({ trapped: true })
    await settle()
    await wrapper.setProps({ trapped: false })
    await settle()
    expect(document.activeElement).toBe(container)
  })

  it('does not reuse a pointer activation for a later programmatic open', async () => {
    const { wrapper, trigger } = setup()
    const other = document.createElement('button')
    document.body.appendChild(other)
    other.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.setProps({ trapped: true })
    await settle()
    await wrapper.setProps({ trapped: false })
    await settle()
    expect(document.activeElement).toBe(trigger)
  })

  it('preserves intentional pointer focus outside the trap on release', async () => {
    const { wrapper } = setup()
    const other = document.createElement('button')
    document.body.appendChild(other)
    await wrapper.setProps({ trapped: true })
    await settle()
    other.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    other.focus()
    await wrapper.setProps({ trapped: false })
    await settle()
    expect(document.activeElement).toBe(other)
  })
})

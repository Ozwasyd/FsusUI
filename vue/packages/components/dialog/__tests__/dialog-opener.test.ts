import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { ElDialog } from '../index'
import { ElDrawer } from '../../drawer'

describe('ElDialog opening-session focus target', () => {
  const wrappers: ReturnType<typeof mount>[] = []
  const settle = async () => {
    await nextTick()
    await nextTick()
    await nextTick()
  }
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
  const create = (conditional = false, openDelay = 0, tabindex = 0) => {
    const open = ref(false)
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h('div', [
            h('input'),
            h(
              'button',
              { tabindex, onClick: () => (open.value = true) },
              'Open',
            ),
            (!conditional || open.value) &&
              h(ElDialog, {
                modelValue: open.value,
                openDelay,
                title: 'Opening session',
                appendToBody: true,
              }),
          ]),
      }),
      { attachTo: document.body },
    )
    wrappers.push(wrapper)
    const input = wrapper.find('input').element as HTMLInputElement
    const trigger = wrapper.find('button').element as HTMLButtonElement
    input.focus()
    const activate = () =>
      trigger.dispatchEvent(
        new MouseEvent('click', { bubbles: true, detail: 1 }),
      )
    return { wrapper, input, trigger, open, activate }
  }

  afterEach(() => {
    wrappers
      .splice(0)
      .reverse()
      .forEach((wrapper) => wrapper.unmount())
    document.body.innerHTML = ''
  })

  // Keep the first test free of any previously mounted trap in this module.
  it('captures the click that first mounts a conditional dialog', async () => {
    const { trigger, open, activate } = create(true)
    activate()
    await settle()
    open.value = false
    await settle()
    expect(document.activeElement).toBe(trigger)
  })

  for (const conditional of [false, true]) {
    it(`retains the unfocused opener across open-delay (conditional=${conditional})`, async () => {
      const { input, trigger, open, activate } = create(conditional, 30)
      await settle()
      activate()
      await settle()
      expect(document.activeElement).toBe(input)
      await wait(40)
      await settle()
      expect(document.activeElement).not.toBe(input)
      open.value = false
      await settle()
      expect(document.activeElement).toBe(trigger)
    })
  }

  it('restores a native focusable button outside the tab order', async () => {
    const { trigger, open, activate } = create(false, 0, -1)
    await settle()
    activate()
    await settle()
    open.value = false
    await settle()
    expect(document.activeElement).toBe(trigger)
  })

  it('cancels a delayed opening before it becomes visible', async () => {
    const { wrapper, input, open, activate } = create(false, 30)
    await settle()
    activate()
    await settle()
    open.value = false
    await settle()
    await wait(40)
    await settle()
    expect(document.activeElement).toBe(input)
    expect(wrapper.findComponent(ElDialog).vm.visible).toBe(false)
  })

  it('does not use an expired pointer activation for a programmatic opening', async () => {
    const { input, trigger, open } = create(false, 30)
    await settle()
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    await settle()
    open.value = false
    await settle()
    await wait(40)
    input.focus()
    open.value = true
    await settle()
    await wait(40)
    await settle()
    open.value = false
    await settle()
    expect(document.activeElement).toBe(input)
  })

  it('does not pass the parent opening target to a descendant Drawer trap', async () => {
    const open = ref(false)
    const childOpen = ref(false)
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h('div', [
            h(
              'button',
              { onClick: () => (open.value = true) },
              'Parent trigger',
            ),
            h(
              ElDialog,
              { modelValue: open.value, title: 'Parent', appendToBody: true },
              () => [
                h(
                  'button',
                  { onClick: () => (childOpen.value = true) },
                  'Drawer trigger',
                ),
                h(ElDrawer, {
                  modelValue: childOpen.value,
                  title: 'Child',
                  appendToBody: true,
                }),
              ],
            ),
          ]),
      }),
      { attachTo: document.body },
    )
    wrappers.push(wrapper)
    await settle()
    const activate = (el: Element) =>
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    const trigger = wrapper.find('button').element
    activate(trigger)
    await settle()
    const childTrigger = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'Drawer trigger',
    )!
    activate(childTrigger)
    await settle()
    childOpen.value = false
    await settle()
    expect(document.activeElement).toBe(childTrigger)
    open.value = false
    await settle()
    expect(document.activeElement).toBe(trigger)
  })
})

import { nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import Form from '../../form/src/form.vue'
import Select from '../src/select.vue'

const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
})

const createSelect = (multiple: boolean) => {
  const disabled = ref(false)
  const value = ref<unknown>(multiple ? [] : undefined)
  const wrapper = mount(
    {
      components: { Form, Select },
      setup: () => ({ disabled, value, multiple }),
      template: `<Form :disabled="disabled"><Select v-model="value" :multiple="multiple"
      :options="[{ value: 0, label: 'Zero' }, { value: 1, label: 'One' }]" /></Form>`,
    },
    { attachTo: document.body },
  )
  wrappers.push(wrapper)
  const select = wrapper.findComponent(Select)
  return { wrapper, select, disabled, value, api: select.vm as any }
}

describe('SelectV2 disabled and input lifecycle', () => {
  for (const multiple of [false, true]) {
    it(`closes an open ${multiple ? 'multiple' : 'single'} popup on inherited disable and reopens cleanly`, async () => {
      const { select, api, disabled, value } = createSelect(multiple)
      await api.toggleMenu()
      await nextTick()
      expect(api.expanded).toBe(true)
      api.onKeyboardNavigate('forward')
      await nextTick()
      const option = document.querySelector('[role="option"]')!
      expect(option.getAttribute('aria-disabled')).toBe('false')

      disabled.value = true
      await nextTick()
      expect(select.find('input').element.disabled).toBe(true)
      expect(option.getAttribute('aria-disabled')).toBe('true')
      option.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      api.onKeyboardSelect()
      expect(value.value).toEqual(multiple ? [] : undefined)
      expect(select.emitted('change')).toBeUndefined()
      expect(api.expanded).toBe(false)
      expect(
        select.find('input').attributes('aria-activedescendant'),
      ).toBeUndefined()

      disabled.value = false
      await nextTick()
      expect(api.expanded).toBe(false)
      await api.toggleMenu()
      api.onKeyboardNavigate('forward')
      api.onKeyboardSelect()
      await nextTick()
      expect(value.value).toEqual(multiple ? [0] : 0)
    })

    it(`rejects stale selection callbacks while ${multiple ? 'multiple' : 'single'} is inherited-disabled`, async () => {
      const { select, api, disabled, value } = createSelect(multiple)
      await api.toggleMenu()
      api.onKeyboardNavigate('forward')
      disabled.value = true
      await nextTick()
      api.onSelect({ value: 0, label: 'Zero' }, 0)
      api.onKeyboardSelect()
      await nextTick()
      expect(value.value).toEqual(multiple ? [] : undefined)
      expect(select.emitted('update:modelValue')).toBeUndefined()
    })
  }

  it('cancels a queued opening across a disabled cycle', async () => {
    const { api, disabled } = createSelect(true)
    api.toggleMenu()
    disabled.value = true
    await nextTick()
    disabled.value = false
    await nextTick()
    expect(api.expanded).toBe(false)
    api.focus()
    expect(document.activeElement).toBe(api.inputRef)
    api.blur()
    await nextTick()
    expect(document.activeElement).not.toBe(api.inputRef)
  })

  it('clears touch hover without losing subsequent keyboard navigation', async () => {
    const { api, select } = createSelect(true)
    await api.toggleMenu()
    api.onKeyboardNavigate('forward')
    await nextTick()
    const option = document.querySelector('[role="option"]')!
    expect(option.classList.contains('hover')).toBe(true)
    expect(select.find('input').attributes('aria-activedescendant')).toBe(
      option.id,
    )

    const touch = new Event('pointerdown', { bubbles: true })
    Object.defineProperty(touch, 'pointerType', { value: 'touch' })
    option.dispatchEvent(touch)
    await nextTick()
    expect(option.classList.contains('hover')).toBe(false)
    expect(
      select.find('input').attributes('aria-activedescendant'),
    ).toBeUndefined()

    const compatibilityMouse = new MouseEvent('mouseenter')
    Object.defineProperty(compatibilityMouse, 'sourceCapabilities', {
      value: { firesTouchEvents: true },
    })
    option.dispatchEvent(compatibilityMouse)
    await nextTick()
    expect(option.classList.contains('hover')).toBe(false)

    api.onKeyboardNavigate('forward')
    await nextTick()
    expect(option.classList.contains('hover')).toBe(true)
    api.blur()
    await api.toggleMenu()
    await nextTick()
    expect(option.classList.contains('hover')).toBe(false)
  })
})

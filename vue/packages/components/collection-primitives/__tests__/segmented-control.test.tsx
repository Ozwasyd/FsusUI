import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'
import SegmentedControl from '../src/segmented-control.vue'

const items = [
  { label: 'Unavailable', value: 'unavailable', disabled: true },
  { label: 'All', value: 'all' },
  { label: 'Closed', value: 'closed', disabled: true },
  { label: 'Open', value: 'open' },
]

describe('segmented control Tab entry', () => {
  test.each([
    ['unavailable', 1],
    ['closed', 1],
    ['missing', 1],
    ['all', 1],
    ['open', 3],
  ])('keeps one enabled Tab stop with modelValue %s', (modelValue, index) => {
    const wrapper = mount(SegmentedControl, {
      props: { items, modelValue, ariaLabel: 'Filter state' },
    })
    const radios = wrapper.findAll('[role="radio"]')

    expect(wrapper.attributes('role')).toBe('radiogroup')
    expect(wrapper.attributes('aria-label')).toBe('Filter state')
    expect(radios.map((radio) => radio.element.tabIndex)).toEqual(
      items.map((_, itemIndex) => (itemIndex === index ? 0 : -1)),
    )
    expect(radios.map((radio) => radio.attributes('aria-checked'))).toEqual(
      items.map((item) => String(item.value === modelValue)),
    )
    expect(
      radios.map((radio) => radio.classes().includes('is-active')),
    ).toEqual(items.map((item) => item.value === modelValue))
    expect(radios.map((radio) => radio.element.disabled)).toEqual([
      true,
      false,
      true,
      false,
    ])
    expect(wrapper.emitted()).toEqual({})
  })

  test.each([false, 0, ''])('preserves enabled falsy selection %s', (value) => {
    const wrapper = mount(SegmentedControl, {
      props: {
        items: [
          { label: 'First', value: 'first' },
          { label: 'Selected', value },
        ],
        modelValue: value,
      },
    })

    expect(
      wrapper.findAll('button').map((radio) => radio.element.tabIndex),
    ).toEqual([-1, 0])
    expect(wrapper.find('[aria-checked="true"]').text()).toBe('Selected')
    expect(wrapper.emitted()).toEqual({})
  })

  test('recomputes Tab entry when selected and fallback items are disabled', async () => {
    const wrapper = mount(SegmentedControl, {
      props: { items, modelValue: 'open' },
    })
    const tabStops = () =>
      wrapper.findAll('button').map((radio) => radio.element.tabIndex)

    expect(tabStops()).toEqual([-1, -1, -1, 0])
    await wrapper.setProps({
      items: items.map((item) => ({ ...item, disabled: item.value !== 'all' })),
    })
    expect(tabStops()).toEqual([-1, 0, -1, -1])
    expect(wrapper.find('[aria-checked="true"]').text()).toBe('Open')

    await wrapper.setProps({
      items: items.map((item) => ({ ...item, disabled: true })),
    })
    expect(tabStops()).toEqual([-1, -1, -1, -1])
    await wrapper.setProps({ items })
    expect(tabStops()).toEqual([-1, -1, -1, 0])
    await wrapper.setProps({ modelValue: 'closed' })
    expect(tabStops()).toEqual([-1, 0, -1, -1])
    await wrapper.setProps({ items: [items[0], items[2], items[3]] })
    expect(tabStops()).toEqual([-1, -1, 0])
    expect(wrapper.props('modelValue')).toBe('closed')
    expect(wrapper.emitted()).toEqual({})
  })

  test('navigates from the fallback, skipping disabled options and wrapping', async () => {
    const wrapper = mount(SegmentedControl, {
      attachTo: document.body,
      props: { items, modelValue: 'closed' },
    })
    const radios = wrapper.findAll('button')
    radios[1].element.focus()
    expect(document.activeElement).toBe(radios[1].element)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    let current = 1
    for (const [key, target] of [
      ['ArrowRight', 3],
      ['ArrowDown', 1],
      ['ArrowLeft', 3],
      ['ArrowUp', 1],
      ['End', 3],
      ['Home', 1],
    ] as const) {
      await radios[current].trigger('keydown', { key })
      expect(document.activeElement).toBe(radios[target].element)
      expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
        items[target].value,
      ])
      expect(wrapper.emitted('change')?.at(-1)).toEqual([items[target].value])
      await wrapper.setProps({ modelValue: items[target].value })
      expect(radios[target].attributes('aria-checked')).toBe('true')
      expect(radios[target].element.tabIndex).toBe(0)
      current = target
    }
    expect(wrapper.emitted('change')).toHaveLength(6)
  })

  test('leaves Tab navigation native and selection controlled', async () => {
    const wrapper = mount(SegmentedControl, {
      attachTo: document.body,
      props: { items, modelValue: 'closed' },
    })
    const fallback = wrapper.findAll('button')[1]
    fallback.element.focus()
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    })
    fallback.element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await fallback.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['all']])
    expect(wrapper.emitted('change')).toEqual([['all']])
    expect(wrapper.find('[aria-checked="true"]').text()).toBe('Closed')
  })

  test('never activates a disabled option', async () => {
    const wrapper = mount(SegmentedControl, {
      props: { items, modelValue: 'closed' },
    })
    for (const radio of wrapper
      .findAll('button')
      .filter((radio) => radio.element.disabled)) {
      radio.element.click()
      radio.element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await radio.trigger('keydown', { key: 'Enter' })
      await radio.trigger('keydown', { key: ' ' })
    }
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('change')).toBeUndefined()
  })

  test('has no Tab stop or activation with every option disabled', async () => {
    const wrapper = mount(SegmentedControl, {
      props: {
        items: items.map((item) => ({ ...item, disabled: true })),
        modelValue: 'closed',
      },
    })
    for (const radio of wrapper.findAll('button')) {
      expect(radio.element.tabIndex).toBe(-1)
      radio.element.click()
      for (const key of [
        'ArrowRight',
        'ArrowDown',
        'ArrowLeft',
        'ArrowUp',
        'Home',
        'End',
        'Enter',
        ' ',
      ]) {
        await radio.trigger('keydown', { key })
      }
    }
    expect(wrapper.find('[aria-checked="true"]').text()).toBe('Closed')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('change')).toBeUndefined()
  })

  test('renders an empty radiogroup without selecting or emitting', async () => {
    const wrapper = mount(SegmentedControl, { props: { modelValue: 'closed' } })
    expect(wrapper.attributes('role')).toBe('radiogroup')
    expect(wrapper.findAll('button')).toHaveLength(0)
    await wrapper.setProps({ items })
    expect(
      wrapper.findAll('button').map((radio) => radio.element.tabIndex),
    ).toEqual([-1, 0, -1, -1])
    await wrapper.setProps({ items: [] })
    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.emitted()).toEqual({})
  })
})

import { h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import dayjs from 'dayjs'
import Input from '../input/src/input.vue'
import Slider from '../slider/src/slider.vue'
import SliderButton from '../slider/src/button.vue'
import DatePicker from '../date-picker/src/date-picker'
import BasicDateTable from '../date-picker/src/date-picker-com/basic-date-table.vue'
import ResponsiveCollection from '../responsive-collection/src/responsive-collection.vue'
import TooltipV2 from '../tooltip-v2/src/tooltip.vue'
import TooltipContent from '../tooltip-v2/src/content.vue'
import TooltipArrow from '../tooltip-v2/src/arrow.vue'

describe('template ref compatibility', () => {
  it('keeps Input named refs and exposed focus tied to the live native input', async () => {
    const wrapper = mount(Input, { attachTo: document.body })
    const refs = wrapper.vm.$refs
    expect(refs.wrapperRef).toBe(wrapper.get('.el-input__wrapper').element)
    expect(refs.input).toBe(wrapper.get('input').element)
    wrapper.vm.focus()
    await nextTick()
    expect(document.activeElement).toBe(wrapper.get('input').element)

    await wrapper.setProps({ type: 'textarea' })
    expect(refs.wrapperRef).toBeNull()
    expect(refs.input).toBeNull()
    expect(refs.textarea).toBe(wrapper.get('textarea').element)
    wrapper.vm.focus()
    await nextTick()
    expect(document.activeElement).toBe(wrapper.get('textarea').element)
    wrapper.unmount()
    expect(refs.textarea).toBeNull()
  })

  it('preserves both Slider handle refs and clears the removed range handle', async () => {
    const wrapper = mount(Slider, {
      attachTo: document.body,
      props: { range: true, modelValue: [20, 80], showTooltip: false },
    })
    const refs = wrapper.vm.$refs
    const handles = wrapper.findAll('.el-slider__button-wrapper')
    const buttons = wrapper.findAllComponents(SliderButton)
    expect(refs.firstButton).toMatchObject({
      setPosition: buttons[0].vm.setPosition,
    })
    expect(refs.secondButton).toMatchObject({
      setPosition: buttons[1].vm.setPosition,
    })
    expect(buttons[0].vm.$refs.button).toBe(handles[0].element)
    expect(buttons[1].vm.$refs.button).toBe(handles[1].element)
    const first = refs.firstButton
    handles[0].element.focus()
    expect(document.activeElement).toBe(handles[0].element)
    await wrapper.setProps({ range: false, modelValue: 20 })
    expect(refs.firstButton).toBe(first)
    expect(refs.secondButton).toBeNull()
    expect(wrapper.findAll('.el-slider__button-wrapper')).toHaveLength(1)
    wrapper.unmount()
    expect(refs.firstButton).toBeNull()
  })

  it('binds TooltipV2 content and injected arrow refs to real elements', async () => {
    const wrapper = mount(TooltipV2, {
      attachTo: document.body,
      props: { alwaysOn: true, showArrow: true, teleported: false },
      slots: {
        trigger: () => h('button', 'Trigger'),
        default: () => 'Accessible content',
      },
    })
    await nextTick()
    const content = wrapper.getComponent(TooltipContent)
    const arrow = wrapper.getComponent(TooltipArrow)
    const contentRefs = content.vm.$refs
    const arrowRefs = arrow.vm.$refs
    expect(contentRefs.contentRef).toBe(content.element)
    expect(arrowRefs.arrowRef).toBe(arrow.element)
    wrapper.get('button').element.focus()
    expect(document.activeElement).toBe(wrapper.get('button').element)
    wrapper.unmount()
    expect(contentRefs.contentRef).toBeNull()
    expect(arrowRefs.arrowRef).toBeNull()
  })

  it('retains the selected date cell focus when the displayed date changes', async () => {
    const selected = dayjs('2026-10-16')
    const picker = mount(DatePicker, {
      attachTo: document.body,
      props: { modelValue: selected.toDate(), teleported: false },
    })
    picker.get('input').element.focus()
    await nextTick()
    await nextTick()
    const wrapper = picker.getComponent(BasicDateTable)
    const refs = wrapper.vm.$refs
    expect(refs.tbodyRef).toBe(wrapper.get('tbody').element)
    wrapper.get('td[tabindex="0"]').element.focus()
    expect(document.activeElement).toBe(wrapper.get('td[tabindex="0"]').element)
    await wrapper.get('td[tabindex="0"]').trigger('keydown', {
      code: 'ArrowRight',
      key: 'ArrowRight',
    })
    await nextTick()
    expect(wrapper.props('date').date()).toBe(17)
    expect(document.activeElement).toBe(wrapper.get('td[tabindex="0"]').element)
    picker.unmount()
    expect(refs.tbodyRef).toBeNull()
  })

  it('does not steal focus outside the date table when its date changes', async () => {
    const selected = dayjs('2026-10-16')
    const picker = mount(DatePicker, {
      attachTo: document.body,
      props: { modelValue: selected.toDate(), teleported: false },
    })
    picker.get('input').element.focus()
    await nextTick()
    await nextTick()
    const outside = document.createElement('button')
    document.body.append(outside)
    outside.focus()
    const next = selected.add(1, 'month')
    await picker.setProps({ modelValue: next.toDate() })
    await nextTick()
    expect(document.activeElement).toBe(outside)
  })
})

function rowTitle(item: unknown) {
  if (item === null || typeof item !== 'object' || !('title' in item)) {
    throw new Error('Expected a row with a title')
  }
  return String(item.title)
}

function rowId(item: unknown) {
  if (item === null || typeof item !== 'object' || !('id' in item)) {
    throw new Error('Expected a row with an id')
  }
  return String(item.id)
}

describe('ResponsiveCollection reactive item identity', () => {
  const original = [
    { id: 'first', title: 'First' },
    { id: 'second', title: 'Second' },
  ]
  const replacement = [
    { id: 'second', title: 'Second updated' },
    { id: 'first', title: 'First updated' },
  ]

  for (const rowKey of ['id', rowId] as const) {
    it(`preserves keyed DOM identity after replacement and reorder (${typeof rowKey})`, async () => {
      const wrapper = mount(ResponsiveCollection, {
        props: { items: original, compact: true, rowKey },
        slots: {
          card: ({ item }: { item: unknown }) => h('article', rowTitle(item)),
          empty: () => h('p', { class: 'empty' }, 'No rows'),
        },
      })
      const before = wrapper.findAll('article').map((row) => row.element)
      await wrapper.setProps({ items: replacement })
      const after = wrapper.findAll('article')
      expect(after.map((row) => row.text())).toEqual([
        'Second updated',
        'First updated',
      ])
      expect(after[0].element).toBe(before[1])
      expect(after[1].element).toBe(before[0])
      await wrapper.setProps({ items: [] })
      expect(wrapper.findAll('article')).toHaveLength(0)
      expect(wrapper.get('.empty').text()).toBe('No rows')
    })
  }

  it.each([undefined, 'missing'])(
    'uses positional identity without a matching key (%s)',
    async (rowKey) => {
      const wrapper = mount(ResponsiveCollection, {
        props: { items: original, compact: true, rowKey },
        slots: {
          card: ({ item }: { item: unknown }) => h('article', rowTitle(item)),
        },
      })
      const before = wrapper.findAll('article').map((row) => row.element)
      await wrapper.setProps({ items: replacement })
      const after = wrapper.findAll('article')
      expect(after.map((row) => row.text())).toEqual([
        'Second updated',
        'First updated',
      ])
      expect(after[0].element).toBe(before[0])
      expect(after[1].element).toBe(before[1])
    },
  )
})

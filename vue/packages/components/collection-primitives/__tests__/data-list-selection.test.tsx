import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'
import DataList from '../src/data-list.vue'

const rows = [
  { id: 'first', name: 'Duplicate label' },
  { id: 'second', name: 'Duplicate label' },
]
const columns = [{ key: 'name', label: 'Name' }]

describe('DataList controlled activation', () => {
  test('keeps list membership separate from native button semantics', () => {
    const wrapper = mount(DataList, {
      props: { rows, columns, activeKey: 'first', showHeader: false },
    })
    expect(wrapper.attributes('role')).toBe('list')
    const items = wrapper.findAll('[role="listitem"]')
    expect(items).toHaveLength(2)
    for (const item of items) {
      const button = item.get('button')
      expect(button.attributes('role')).toBeUndefined()
      expect(button.attributes('type')).toBe('button')
    }
    expect(items[0].get('button').attributes('aria-current')).toBe('true')
    wrapper.unmount()
  })

  test('opts into responsive layout without another collection or activation owner', async () => {
    const wrapper = mount(DataList, { props: { rows, columns, responsive: true } })
    expect(wrapper.classes()).toContain('is-responsive')
    expect(wrapper.findAll('[role="listitem"]')).toHaveLength(2)
    expect(wrapper.findAll('button')).toHaveLength(2)
    await wrapper.findAll('button')[1].trigger('click')
    expect(wrapper.emitted('change')).toHaveLength(1)
    await wrapper.setProps({ responsive: false })
    expect(wrapper.classes()).not.toContain('is-responsive')
    wrapper.unmount()
  })

  test('emits stable keys without moving current identity when declined', async () => {
    const wrapper = mount(DataList, {
      props: { rows, columns, activeKey: 'first' },
    })
    await wrapper.findAll('button')[1].trigger('click')
    expect(wrapper.emitted('change')?.[0]?.slice(0, 2)).toEqual([
      rows[1], 'second',
    ])
    expect(wrapper.emitted('row-click')?.[0]?.[1]).toBe('second')
    expect(wrapper.find('[aria-current="true"]').text()).toBe('Duplicate label')
    await wrapper.setProps({ rows: [...rows].reverse() })
    expect(wrapper.findAll('button')[1].attributes('aria-current')).toBe('true')
    await wrapper.setProps({ activeKey: 'second' })
    expect(wrapper.findAll('button')[0].attributes('aria-current')).toBe('true')
    wrapper.unmount()
  })

  test.each([
    { disabled: true },
    { loading: true },
    { loadingKey: 'second' },
    { disabledKeys: ['second'] },
  ])('rejects activation for public state %j and recovers', async (state) => {
    const wrapper = mount(DataList, { props: { rows, columns, ...state } })
    const button = wrapper.findAll('button')[1]
    expect((button.element as HTMLButtonElement).disabled).toBe(true)
    expect(button.attributes('aria-disabled')).toBe('true')
    // Synthetic dispatch exercises the component guard as well as native disabling.
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    button.element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.emitted('change')).toBeUndefined()
    expect(wrapper.emitted('row-click')).toBeUndefined()
    await wrapper.setProps({
      disabled: false, loading: false, loadingKey: null, disabledKeys: [],
    })
    expect((button.element as HTMLButtonElement).disabled).toBe(false)
    await button.trigger('click')
    expect(wrapper.emitted('change')?.[0]?.[1]).toBe('second')
    wrapper.unmount()
  })

  test('uses typed stable keys and announces busy collection and cell state', async () => {
    const wrapper = mount(DataList, {
      props: {
        rows: [{ id: 1, name: 'Numeric' }, { id: '1', name: 'String' }],
        columns, disabledKeys: [1], loading: true,
      },
      slots: { cell: ({ value, disabled, loading }) =>
        <span>{`${value}:${disabled}:${loading}`}</span>,
      },
    })
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.findAll('button')[0].attributes('aria-busy')).toBe('true')
    expect(wrapper.text()).toContain('String:true:true')
    await wrapper.setProps({ loading: false })
    expect(wrapper.attributes('aria-busy')).toBeUndefined()
    expect((wrapper.findAll('button')[0].element as HTMLButtonElement).disabled).toBe(true)
    expect((wrapper.findAll('button')[1].element as HTMLButtonElement).disabled).toBe(false)
    expect(wrapper.text()).toContain('String:false:false')
    wrapper.unmount()
  })

  test('disabled links retain their role while rejecting navigation and activation', async () => {
    const wrapper = mount(DataList, {
      props: { rows, columns, href: (row) => `#${row.id}`, disabledKeys: ['second'] },
    })
    const link = wrapper.findAll('a')[1]
    expect(link.attributes('role')).toBe('link')
    expect(link.attributes('href')).toBeUndefined()
    expect(link.attributes('tabindex')).toBe('-1')
    expect(link.attributes('aria-disabled')).toBe('true')
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    link.element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.emitted('change')).toBeUndefined()
    await wrapper.setProps({ disabledKeys: [] })
    expect(link.attributes('href')).toBe('#second')
    expect(link.attributes('tabindex')).toBeUndefined()
    await link.trigger('click')
    expect(wrapper.emitted('change')?.[0]?.[1]).toBe('second')
    wrapper.unmount()
  })

  test('passive rows do not emit activation', async () => {
    const wrapper = mount(DataList, { props: { rows, columns, interactive: false } })
    expect(wrapper.find('button').exists()).toBe(false)
    await wrapper.get('[role="listitem"] > div').trigger('click')
    expect(wrapper.emitted('change')).toBeUndefined()
    expect(wrapper.emitted('row-click')).toBeUndefined()
    wrapper.unmount()
  })
})

import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, test, vi } from 'vitest'
import DataList from '../src/data-list.vue'

const rows = [
  { id: 1, name: 'Duplicate' },
  { id: '1', name: 'Duplicate' },
  { id: 'long-stable-record-identity', name: 'Long record name with metadata' },
]
const columns = [{ key: 'name', label: 'Name' }]

afterEach(() => {
  document.body.innerHTML = ''
})

describe('DataList public activation contract', () => {
  test('preserves native row semantics and consumer-controlled typed identity', async () => {
    const wrapper = mount(DataList, { props: { rows, columns, activeKey: 1 } })
    expect(wrapper.attributes('role')).toBe('list')
    expect(wrapper.findAll('[role="listitem"]')).toHaveLength(3)
    const buttons = wrapper.findAll('button')
    expect(buttons[0].attributes('role')).toBeUndefined()
    expect(buttons[0].attributes('aria-current')).toBe('true')
    expect(buttons[1].attributes('aria-current')).toBeUndefined()
    await buttons[1].trigger('click')
    expect(wrapper.emitted('change')?.[0]?.[1]).toBe('1')
    expect(buttons[0].attributes('aria-current')).toBe('true')
    expect(buttons[1].attributes('aria-current')).toBeUndefined()
    await wrapper.setProps({ activeKey: '1' })
    expect(buttons[0].attributes('aria-current')).toBeUndefined()
    expect(buttons[1].attributes('aria-current')).toBe('true')
  })

  test.each([
    { disabled: true },
    { loading: true },
    { disabledKeys: [1, '1', 'long-stable-record-identity'] },
  ])(
    'rejects synthetic button activation when blocked by %o',
    async (state) => {
      const wrapper = mount(DataList, { props: { rows, columns, ...state } })
      for (const button of wrapper.findAll('button')) {
        expect(button.attributes('disabled')).toBeDefined()
        expect(button.attributes('aria-disabled')).toBe('true')
        const event = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        })
        button.element.dispatchEvent(event)
        expect(event.defaultPrevented).toBe(true)
      }
      expect(wrapper.emitted('change')).toBeUndefined()
      expect(wrapper.emitted('row-click')).toBeUndefined()
    },
  )

  test('disables only the typed busy key and exposes disabled/loading slot state', async () => {
    const wrapper = mount(DataList, {
      props: { rows, columns, loadingKey: 1 },
      slots: {
        cell: '<template #cell="cell">{{ cell.disabled }} / {{ cell.loading }}</template>',
      },
    })
    const buttons = wrapper.findAll('button')
    expect(buttons[0].attributes('aria-busy')).toBe('true')
    expect(buttons[0].text()).toBe('true / true')
    expect(buttons[1].attributes('disabled')).toBeUndefined()
    expect(buttons[1].text()).toBe('false / false')
    await buttons[1].trigger('click')
    expect(wrapper.emitted('change')?.[0]?.[1]).toBe('1')
  })

  test('disabled links retain role while rejecting navigation and leaving Tab order', async () => {
    const wrapper = mount(DataList, {
      props: {
        rows,
        columns,
        href: (row) => `#record-${row.id}`,
        loadingKey: 1,
      },
    })
    const links = wrapper.findAll('a')
    expect(links[0].attributes('role')).toBe('link')
    expect(links[0].attributes('href')).toBeUndefined()
    expect(links[0].attributes('tabindex')).toBe('-1')
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    links[0].element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.emitted('change')).toBeUndefined()
    expect(links[1].attributes('href')).toBe('#record-1')
    await links[1].trigger('click')
    expect(wrapper.emitted('change')?.[0]?.[1]).toBe('1')
  })

  test('passive rows reject activation', async () => {
    const wrapper = mount(DataList, {
      props: { rows, columns, interactive: false },
    })
    expect(wrapper.findAll('button, a')).toHaveLength(0)
    await wrapper.find('.el-data-list__row').trigger('click')
    expect(wrapper.emitted('change')).toBeUndefined()
  })

  test.each([0, 1, 1000])('retains all %i rows and metadata cells', (count) => {
    const records = Array.from({ length: count }, (_, index) => ({
      id: index,
      name: `Record ${index}`,
    }))
    const wrapper = mount(DataList, {
      props: { rows: records, columns },
      slots: { empty: 'No records' },
    })
    expect(wrapper.findAll('[role="listitem"]')).toHaveLength(count)
    expect(wrapper.findAll('.el-data-list__row')).toHaveLength(count)
    if (count === 0) expect(wrapper.text()).toContain('No records')
    else
      expect(wrapper.findAll('.el-data-list__cell').at(-1)?.text()).toBe(
        `Record ${count - 1}`,
      )
  })

  test('keeps focus on the typed row through reorder and restores it after collection loading', async () => {
    const wrapper = mount(DataList, {
      props: { rows, columns },
      attachTo: document.body,
    })
    ;(wrapper.findAll('button')[1].element as HTMLButtonElement).focus()
    await wrapper.setProps({ rows: [rows[2], rows[1], rows[0]] })
    await nextTick()
    expect(document.activeElement).toBe(wrapper.findAll('button')[1].element)
    await wrapper.setProps({ loading: true })
    await nextTick()
    expect(document.activeElement).toBe(wrapper.element)
    await wrapper.setProps({ loading: false })
    await nextTick()
    expect(document.activeElement).toBe(wrapper.findAll('button')[1].element)
  })

  test('does not restore scheduled focus after unmount', async () => {
    const wrapper = mount(DataList, {
      props: { rows, columns },
      attachTo: document.body,
    })
    ;(wrapper.findAll('button')[0].element as HTMLButtonElement).focus()
    const update = wrapper.setProps({ rows: rows.slice(1) })
    wrapper.unmount()
    await update
    await nextTick()
    expect(document.activeElement).toBe(document.body)
  })

  test('leaves zero leaked global listeners or nodes across 3x repeated 1000-row mount/unmount cycles (#831)', async () => {
    const activeListeners = new Map<string, Set<EventListenerOrEventListenerObject>>()
    const listenerKey = (
      target: 'window' | 'document',
      type: string,
      options?: boolean | AddEventListenerOptions,
    ) => {
      const capture =
        typeof options === 'boolean' ? options : Boolean(options?.capture)
      return `${target}:${type}:${capture}`
    }

    const origWinAdd = window.addEventListener.bind(window)
    const origWinRemove = window.removeEventListener.bind(window)
    const origDocAdd = document.addEventListener.bind(document)
    const origDocRemove = document.removeEventListener.bind(document)

    const recordAdd = (
      target: 'window' | 'document',
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ) => {
      if (!listener) return
      const key = listenerKey(target, type, options)
      if (!activeListeners.has(key)) activeListeners.set(key, new Set())
      activeListeners.get(key)!.add(listener)
    }
    const recordRemove = (
      target: 'window' | 'document',
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions,
    ) => {
      if (!listener) return
      const key = listenerKey(target, type, options)
      const set = activeListeners.get(key)
      set?.delete(listener)
      if (set && set.size === 0) activeListeners.delete(key)
    }

    const winAddSpy = vi
      .spyOn(window, 'addEventListener')
      .mockImplementation((type, listener, options) => {
        recordAdd('window', type, listener, options)
        return origWinAdd(type, listener, options)
      })
    const winRemoveSpy = vi
      .spyOn(window, 'removeEventListener')
      .mockImplementation((type, listener, options) => {
        recordRemove('window', type, listener, options)
        return origWinRemove(type, listener, options)
      })
    const docAddSpy = vi
      .spyOn(document, 'addEventListener')
      .mockImplementation((type, listener, options) => {
        recordAdd('document', type, listener, options)
        return origDocAdd(type, listener, options)
      })
    const docRemoveSpy = vi
      .spyOn(document, 'removeEventListener')
      .mockImplementation((type, listener, options) => {
        recordRemove('document', type, listener, options)
        return origDocRemove(type, listener, options)
      })

    const largeColumns = [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name' },
      { key: 'version', label: 'Version' },
      { key: 'status', label: 'Status' },
      { key: 'runtime', label: 'Runtime' },
    ]
    const largeRows = Array.from({ length: 1000 }, (_, index) => ({
      id: `pkg-${index}`,
      name: `service-${index}`,
      version: `1.${index % 10}.0`,
      status: index % 5 === 0 ? 'degraded' : 'healthy',
      runtime: index % 2 === 0 ? 'node-22' : 'wasm',
    }))

    try {
      for (let cycle = 0; cycle < 3; cycle++) {
        const wrapper = mount(DataList, {
          props: {
            rows: largeRows,
            columns: largeColumns,
            rowKey: 'id',
            activeKey: `pkg-${cycle}`,
            disabledKeys: ['pkg-2'],
          },
          attachTo: document.body,
        })
        await nextTick()
        const buttons = wrapper.findAll('button')
        expect(buttons).toHaveLength(1000)
        ;(buttons[cycle + 3].element as HTMLButtonElement).focus()
        await buttons[cycle + 3].trigger('click')
        expect(wrapper.emitted('change')?.[0]?.[1]).toBe(`pkg-${cycle + 3}`)
        await wrapper.setProps({ activeKey: `pkg-${cycle + 3}` })
        await nextTick()
        wrapper.unmount()
        await nextTick()
      }

      expect(activeListeners.size).toBe(0)
      expect(document.body.querySelectorAll('[role="list"]')).toHaveLength(0)
      expect(document.body.querySelectorAll('[role="listitem"]')).toHaveLength(
        0,
      )
    } finally {
      winAddSpy.mockRestore()
      winRemoveSpy.mockRestore()
      docAddSpy.mockRestore()
      docRemoveSpy.mockRestore()
    }
  })
})

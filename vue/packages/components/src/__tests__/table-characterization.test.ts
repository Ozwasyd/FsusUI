import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import {
  FsusAutoResizer,
  FsusTable,
  FsusTableColumn,
  type FsusTableColumnDef,
} from '../index'

describe('FsusTable characterization baseline (#1153)', () => {
  it('supports slot-driven FsusTableColumn with grouped headers, scoped cell slots, formatter, and #cell-<key> precedence', () => {
    const data = [
      { id: 1, name: 'Alice', stats: { score: 92, rank: 1 }, note: 'Top' },
      { id: 2, name: 'Bob', stats: { score: 75, rank: 2 }, note: null },
    ]

    const slotWrapper = mount(FsusTable, {
      props: { data, border: true, stripe: true, compact: true },
      slots: {
        default: () => [
          h(
            FsusTableColumn,
            { prop: 'name', label: 'Name', fixed: '', width: 120, sortable: '' },
            {
              default: ({ row, index }: any) => [
                h('strong', { class: 'slot-name' }, `${index}:${row.name}`),
              ],
            },
          ),
          h(FsusTableColumn, { label: 'Stats' }, () => [
            h(FsusTableColumn, { prop: 'stats.score', label: 'Score', align: 'right', width: '100px' }),
            h(FsusTableColumn, { prop: 'stats.rank', label: 'Rank', minWidth: 70 }),
          ]),
          h(FsusTableColumn, { prop: 'note', label: 'Note' }),
        ],
      },
    })

    expect(slotWrapper.attributes('data-border')).toBe('')
    expect(slotWrapper.attributes('data-stripe')).toBe('')
    expect(slotWrapper.attributes('data-compact')).toBe('')

    // Multi-level header structure
    const headRows = slotWrapper.findAll('thead tr')
    expect(headRows).toHaveLength(2)
    expect(headRows[0]!.findAll('th')[0]!.attributes('rowspan')).toBe('2')
    expect(headRows[0]!.findAll('th')[0]!.attributes('data-fixed')).toBe('left')
    expect(headRows[0]!.findAll('th')[0]!.attributes('data-sortable')).toBe('')
    expect(headRows[0]!.findAll('th')[1]!.attributes('colspan')).toBe('2')
    expect(headRows[0]!.findAll('th')[1]!.text()).toContain('Stats')
    expect(headRows[1]!.findAll('th').map((th) => th.text())).toEqual(['Score', 'Rank'])

    // Scoped slot rendering & nested prop path & null value rendering as empty string
    const firstRowTds = slotWrapper.findAll('tbody tr')[0]!.findAll('td')
    expect(firstRowTds[0]!.find('.slot-name').text()).toBe('0:Alice')
    expect(firstRowTds[1]!.text()).toBe('92')
    expect(firstRowTds[2]!.text()).toBe('1')
    expect(firstRowTds[3]!.text()).toBe('Top')
    expect(slotWrapper.findAll('tbody tr')[1]!.findAll('td')[3]!.text()).toBe('')

    // Data-driven columns: #cell-<key> takes precedence over formatter
    const dataCols: FsusTableColumnDef[] = [
      { key: 'name', label: 'Name', formatter: (r) => `FMT:${r.name}` },
      { key: 'note', label: 'Note', formatter: (r) => `FMT:${r.note ?? 'none'}` },
    ]
    const dataWrapper = mount(FsusTable, {
      props: { data, columns: dataCols },
      slots: {
        'cell-name': ({ value, index }: any) => h('em', `SLOT:${index}:${value}`),
      },
    })
    const row0 = dataWrapper.findAll('tbody tr')[0]!.findAll('td')
    expect(row0[0]!.text()).toBe('SLOT:0:Alice')
    expect(row0[1]!.text()).toBe('FMT:Top')
  })

  it('preserves sorting cycle (asc -> desc -> null), null placement, and sortChange payload', async () => {
    const columns: FsusTableColumnDef[] = [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'score', prop: 'meta.score', label: 'Score', sortable: true },
    ]
    const data = [
      { id: 1, name: 'Charlie', meta: { score: 20 } },
      { id: 2, name: 'Alice', meta: { score: null } },
      { id: 3, name: 'Bob', meta: { score: 100 } },
    ]

    const wrapper = mount(FsusTable, { props: { columns, data } })
    const scoreTh = wrapper.findAll('thead th')[1]!

    // asc: numbers sorted numerically, null last
    await scoreTh.trigger('click')
    expect(scoreTh.attributes('aria-sort')).toBe('ascending')
    expect(wrapper.findAll('tbody tr').map((tr) => tr.findAll('td')[0]!.text())).toEqual([
      'Charlie',
      'Bob',
      'Alice',
    ])
    expect(wrapper.emitted('sortChange')?.[0]).toEqual([{ prop: 'meta.score', order: 'asc' }])

    // desc: 100 -> 20 -> null
    await scoreTh.trigger('click')
    expect(scoreTh.attributes('aria-sort')).toBe('descending')
    expect(wrapper.findAll('tbody tr').map((tr) => tr.findAll('td')[0]!.text())).toEqual([
      'Bob',
      'Charlie',
      'Alice',
    ])
    expect(wrapper.emitted('sortChange')?.[1]).toEqual([{ prop: 'meta.score', order: 'desc' }])

    // null: back to original order
    await scoreTh.trigger('click')
    expect(scoreTh.attributes('aria-sort')).toBeUndefined()
    expect(wrapper.findAll('tbody tr').map((tr) => tr.findAll('td')[0]!.text())).toEqual([
      'Charlie',
      'Alice',
      'Bob',
    ])
    expect(wrapper.emitted('sortChange')?.[2]).toEqual([{ prop: '', order: null }])
  })

  it('preserves multi/single filter draft, apply, reset, custom filterMethod, and filterChange payload', async () => {
    const columns: FsusTableColumnDef[] = [
      {
        key: 'role',
        label: 'Role',
        filters: [
          { text: 'Admin', value: 'admin' },
          { text: 'Editor', value: 'editor' },
          { text: 'Viewer', value: 'viewer' },
        ],
      },
      {
        key: 'tier',
        label: 'Tier',
        filterMultiple: false,
        filters: [
          { text: 'High (>=80)', value: 80 },
          { text: 'Mid (>=50)', value: 50 },
        ],
        filterMethod: (val, row) => Number(row.score) >= Number(val),
      },
    ]
    const data = [
      { id: 1, role: 'admin', score: 90 },
      { id: 2, role: 'editor', score: 60 },
      { id: 3, role: 'viewer', score: 30 },
    ]
    const wrapper = mount(FsusTable, { props: { columns, data } })
    const triggers = wrapper.findAll('.fsus-table__filter-trigger')

    // Draft change without apply does not filter rows
    await triggers[0]!.trigger('click')
    expect(triggers[0]!.attributes('aria-expanded')).toBe('true')
    const roleInputs = wrapper.findAll('.fsus-table__filter-item input')
    await roleInputs[0]!.trigger('change')
    expect(wrapper.findAll('tbody .fsus-table__row')).toHaveLength(3)

    // Apply multi-filter
    await wrapper.find('.fsus-table__filter-btn[data-primary]').trigger('click')
    expect(wrapper.findAll('tbody .fsus-table__row')).toHaveLength(1)
    expect(wrapper.emitted('filterChange')?.[0]).toEqual([{ role: ['admin'] }])

    // Reset filter restores all 3 rows
    await triggers[0]!.trigger('click')
    await wrapper.findAll('.fsus-table__filter-btn')[0]!.trigger('click')
    expect(wrapper.findAll('tbody .fsus-table__row')).toHaveLength(3)
    expect(wrapper.emitted('filterChange')?.[1]).toEqual([{ role: [] }])

    // Single-select radio filter with custom filterMethod
    await triggers[1]!.trigger('click')
    const tierInputs = wrapper.findAll('.fsus-table__filter-item input')
    expect(tierInputs[0]!.attributes('type')).toBe('radio')
    await tierInputs[1]!.trigger('change')
    await wrapper.find('.fsus-table__filter-btn[data-primary]').trigger('click')
    expect(wrapper.findAll('tbody .fsus-table__row')).toHaveLength(2)
    expect(wrapper.emitted('filterChange')?.[2]).toEqual([{ role: [], tier: [50] }])
  })

  it('preserves combined filter + sort + tree expansion + detail expansion + selection event order', async () => {
    const emittedOrder: string[] = []
    const columns: FsusTableColumnDef[] = [
      { key: 'name', label: 'Name', sortable: true },
      {
        key: 'group',
        label: 'Group',
        filters: [
          { text: 'Core', value: 'core' },
          { text: 'Extra', value: 'extra' },
        ],
      },
    ]
    const data = [
      {
        id: 'p2',
        name: 'Zulu',
        group: 'core',
        children: [{ id: 'c2', name: 'Zulu Child', group: 'core' }],
      },
      {
        id: 'p1',
        name: 'Alpha',
        group: 'core',
        children: [{ id: 'c1', name: 'Alpha Child', group: 'core' }],
      },
      { id: 'p3', name: 'Beta', group: 'extra' },
    ]

    const wrapper = mount(FsusTable, {
      props: {
        columns,
        data,
        selectable: true,
        selectedKeys: [] as Array<string | number>,
        expandable: true,
        defaultExpandAll: true,
        treeIndent: 16,
        'onUpdate:selectedKeys': (next: Array<string | number>) => {
          emittedOrder.push(`update:selectedKeys:${next.join(',')}`)
          void wrapper.setProps({ selectedKeys: next })
        },
        onSelectionChange: (next: Array<string | number>) => {
          emittedOrder.push(`selectionChange:${next.join(',')}`)
        },
        'onUpdate:expandedRowKeys': (next: Array<string | number>) => {
          emittedOrder.push(`update:expandedRowKeys:${next.join(',')}`)
        },
        onExpandChange: (row: any, expanded: boolean, list: Array<string | number>) => {
          emittedOrder.push(`expandChange:${row.id}:${expanded}:${list.join(',')}`)
        },
      },
      slots: {
        expand: ({ row }: any) => h('div', { class: 'exp-detail' }, `Detail:${row.id}`),
      },
    })

    // defaultExpandAll expands both parent tree rows -> 5 flattened rows initially
    expect(wrapper.findAll('tbody .fsus-table__row')).toHaveLength(5)

    // Filter to group === 'core' -> p2 + c2 + p1 + c1 (4 rows)
    await wrapper.find('.fsus-table__filter-trigger').trigger('click')
    await wrapper.findAll('.fsus-table__filter-item input')[0]!.trigger('change')
    await wrapper.find('.fsus-table__filter-btn[data-primary]').trigger('click')
    expect(wrapper.findAll('tbody .fsus-table__row')).toHaveLength(4)

    // Sort name ascending -> Alpha (p1), Alpha Child (c1), Zulu (p2), Zulu Child (c2)
    await wrapper.find('thead th[data-sortable]').trigger('click')
    expect(
      wrapper.findAll('tbody .fsus-table__row').map((tr) => tr.findAll('td')[2]!.text()),
    ).toEqual(['Alpha', 'Alpha Child', 'Zulu', 'Zulu Child'])

    // Verify child tree indent (1 * 16px)
    const indents = wrapper.findAll('.fsus-table__tree-indent')
    expect(indents[1]!.attributes('style')).toContain('padding-left: 16px')

    // Select-all selects all currently flattened rows in exact order, emitting update:selectedKeys before selectionChange
    await wrapper.find('thead .fsus-table__check-cell input').trigger('change')
    expect(emittedOrder.slice(0, 2)).toEqual([
      'update:selectedKeys:p1,c1,p2,c2',
      'selectionChange:p1,c1,p2,c2',
    ])
    expect(wrapper.emitted('rowClick')).toBeUndefined()

    // Toggle detail expansion on first row emits update:expandedRowKeys before expandChange
    await wrapper.findAll('.fsus-table__expand-btn')[0]!.trigger('click')
    expect(emittedOrder.slice(2, 4)).toEqual([
      'update:expandedRowKeys:p1',
      'expandChange:p1:true:p1',
    ])
    const expandCell = wrapper.find('.fsus-table__expand-content')
    expect(expandCell.text()).toBe('Detail:p1')
    expect(expandCell.attributes('colspan')).toBe('4') // 2 cols + expandable + selectable

    // Controlled expandedRowKeys syncs when updated externally
    await wrapper.setProps({ expandedRowKeys: ['p2'] })
    expect(wrapper.findAll('.exp-detail').map((el) => el.text())).toEqual(['Detail:p2'])

    // Collapse tree row p1 reduces flattened rows from 4 to 3
    await wrapper.findAll('.fsus-table__tree-toggle')[0]!.trigger('click')
    expect(wrapper.findAll('tbody .fsus-table__row')).toHaveLength(3)
  })

  it('preserves fixed left/right sticky offsets (including utility columns), drag-resize minWidth clamping, and scroll-edge attributes', async () => {
    const columns: FsusTableColumnDef[] = [
      { key: 'a', label: 'A', fixed: 'left', width: 100, minWidth: 80, resizable: true },
      { key: 'b', label: 'B', fixed: 'left', width: 120 },
      { key: 'c', label: 'C', width: 200 },
      { key: 'd', label: 'D', fixed: 'right', width: 90 },
      { key: 'e', label: 'E', fixed: 'right', width: 70 },
    ]
    const wrapper = mount(FsusTable, {
      props: {
        columns,
        data: [{ id: 1, a: '1', b: '2', c: '3', d: '4', e: '5' }],
        selectable: true,
        expandable: true,
      },
    })

    // Utility width = expandable(42) + selectable(42) = 84px
    const ths = wrapper.findAll('thead th')
    // Index 0 = expand, 1 = check, 2 = a, 3 = b, 4 = c, 5 = d, 6 = e
    expect(ths[2]!.attributes('style')).toContain('left: 84px')
    expect(ths[2]!.attributes('data-fixed-edge')).toBeUndefined()
    expect(ths[3]!.attributes('style')).toContain('left: 184px')
    expect(ths[3]!.attributes('data-fixed-edge')).toBe('left')
    expect(ths[5]!.attributes('style')).toContain('right: 70px')
    expect(ths[5]!.attributes('data-fixed-edge')).toBe('right')
    expect(ths[6]!.attributes('style')).toContain('right: 0px')
    expect(ths[6]!.attributes('data-fixed-edge')).toBeUndefined()

    // Drag resize column 'a' (measured startW=100) down to 0 -> clamped to minWidth=80, then +40 -> 140
    ths[2]!.element.getBoundingClientRect = () =>
      ({ width: 100, height: 40, top: 0, left: 0, bottom: 40, right: 100, x: 0, y: 0, toJSON: () => {} }) as DOMRect
    const handle = wrapper.find('.fsus-table__resize-handle')
    handle.element.dispatchEvent(new MouseEvent('pointerdown', { clientX: 100, bubbles: true }))
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 0 }))
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 140 }))
    window.dispatchEvent(new MouseEvent('pointerup'))
    await nextTick()

    const resizes = wrapper.emitted('columnResize')
    expect(resizes).toHaveLength(2)
    expect(resizes![0]![0]).toBe(80)
    expect(resizes![1]![0]).toBe(140)
    // Fixed offset for second left-fixed column 'b' updates to 84 + 140 = 224px
    expect(wrapper.findAll('thead th')[3]!.attributes('style')).toContain('left: 224px')

    // Scroll edges update data-scroll-left and data-scroll-right on scroll
    const el = wrapper.element as HTMLElement
    Object.defineProperty(el, 'scrollWidth', { value: 1000, configurable: true })
    Object.defineProperty(el, 'clientWidth', { value: 400, configurable: true })
    Object.defineProperty(el, 'scrollLeft', { value: 50, configurable: true, writable: true })
    await wrapper.trigger('scroll')
    expect(wrapper.attributes('data-scroll-left')).toBe('')
    expect(wrapper.attributes('data-scroll-right')).toBe('')

    el.scrollLeft = 600
    await wrapper.trigger('scroll')
    expect(wrapper.attributes('data-scroll-left')).toBe('')
    expect(wrapper.attributes('data-scroll-right')).toBeUndefined()
  })

  it('preserves virtualization eligibility, exact row-height/overscan slice math, virtual rowClick index, and nonvirtual fallbacks', async () => {
    const columns: FsusTableColumnDef[] = [{ key: 'label', label: 'Label' }]
    const data = Array.from({ length: 200 }, (_, i) => ({ id: i + 1, label: `Row ${i}` }))

    // Virtualized path: height=220, rowHeight=44, virtualThreshold=100, 200 rows
    const virtualWrapper = mount(FsusTable, {
      props: { columns, data, height: 220, rowHeight: 44, virtualThreshold: 100 },
    })
    // Initial scrollTop=0: start=0, count=ceil(220/44)+10=15, end=15, topPad=0, bottomPad=185*44=8140
    expect(virtualWrapper.findAll('tbody .fsus-table__row')).toHaveLength(15)
    expect(virtualWrapper.findAll('tbody tr[aria-hidden="true"]')).toHaveLength(1)
    expect(virtualWrapper.find('tbody tr[aria-hidden="true"]').attributes('style')).toContain(
      'height: 8140px',
    )

    // Scroll to scrollTop = 2200 -> floor(2200/44)-5 = 45, end = 60, topPad = 45*44 = 1980, bottomPad = 140*44 = 6160
    const container = virtualWrapper.element as HTMLElement
    Object.defineProperty(container, 'scrollTop', { value: 2200, configurable: true })
    await virtualWrapper.trigger('scroll')

    const visibleRows = virtualWrapper.findAll('tbody .fsus-table__row')
    expect(visibleRows).toHaveLength(15)
    expect(visibleRows[0]!.text()).toBe('Row 45')
    expect(visibleRows[14]!.text()).toBe('Row 59')
    const spacers = virtualWrapper.findAll('tbody tr[aria-hidden="true"]')
    expect(spacers).toHaveLength(2)
    expect(spacers[0]!.attributes('style')).toContain('height: 1980px')
    expect(spacers[1]!.attributes('style')).toContain('height: 6160px')

    // Clicking first visible virtual row emits realIdx = 45
    await visibleRows[0]!.trigger('click')
    expect(virtualWrapper.emitted('rowClick')?.[0]).toEqual([data[45], 45])

    // Non-virtualized when height is omitted
    const noHeight = mount(FsusTable, { props: { columns, data, virtualThreshold: 100 } })
    expect(noHeight.findAll('tbody .fsus-table__row')).toHaveLength(200)
    expect(noHeight.findAll('tbody tr[aria-hidden="true"]')).toHaveLength(0)

    // Non-virtualized when flatRows.length <= virtualThreshold
    const atThreshold = mount(FsusTable, {
      props: { columns, data: data.slice(0, 100), height: 220, virtualThreshold: 100 },
    })
    expect(atThreshold.findAll('tbody .fsus-table__row')).toHaveLength(100)

    // Non-virtualized when expandable is true
    const withExpand = mount(FsusTable, {
      props: { columns, data: data.slice(0, 120), height: 220, virtualThreshold: 100, expandable: true },
    })
    expect(withExpand.findAll('tbody .fsus-table__row')).toHaveLength(120)

    // Non-virtualized when spanMethod is provided (also supports object return and void)
    const withSpan = mount(FsusTable, {
      props: {
        columns: [
          { key: 'label', label: 'Label' },
          { key: 'id', label: 'ID' },
        ],
        data: data.slice(0, 105),
        height: 220,
        virtualThreshold: 100,
        spanMethod: ({ rowIndex, columnIndex }) => {
          if (rowIndex === 0 && columnIndex === 0) return { rowspan: 1, colspan: 2 }
          if (rowIndex === 0 && columnIndex === 1) return { rowspan: 0, colspan: 0 }
          return undefined
        },
      },
    })
    expect(withSpan.findAll('tbody .fsus-table__row')).toHaveLength(105)
    expect(withSpan.findAll('tbody tr')[0]!.findAll('td')).toHaveLength(1)
    expect(withSpan.findAll('tbody tr')[0]!.findAll('td')[0]!.attributes('colspan')).toBe('2')
  })

  it('preserves empty state, custom #empty slot, custom summaryMethod, and hides summary when empty', () => {
    const columns: FsusTableColumnDef[] = [
      { key: 'name', label: 'Name' },
      { key: 'amount', label: 'Amount' },
    ]

    const emptyDefault = mount(FsusTable, {
      props: { columns, data: [], emptyText: 'No records', showSummary: true },
    })
    expect(emptyDefault.find('.fsus-table__empty').text()).toBe('No records')
    expect(emptyDefault.find('.fsus-table__empty').attributes('colspan')).toBe('2')
    expect(emptyDefault.find('tfoot').exists()).toBe(false)

    const emptySlot = mount(FsusTable, {
      props: { columns, data: [], loading: true },
      slots: { empty: () => h('div', { class: 'custom-empty' }, 'Custom Empty') },
    })
    expect(emptySlot.find('.custom-empty').text()).toBe('Custom Empty')

    const customSummary = mount(FsusTable, {
      props: {
        columns,
        data: [
          { id: 1, name: 'A', amount: 1.5 },
          { id: 2, name: 'B', amount: 2.25 },
        ],
        showSummary: true,
        summaryMethod: ({ data }) => ['TOTAL', `Count:${data.length}`],
      },
    })
    expect(customSummary.findAll('tfoot td').map((td) => td.text())).toEqual(['TOTAL', 'Count:2'])
  })

  it('keeps two mounted FsusTable instances completely independent in interaction state', async () => {
    const columns: FsusTableColumnDef[] = [
      {
        key: 'name',
        label: 'Name',
        sortable: true,
        resizable: true,
        width: 120,
        filters: [
          { text: 'Alpha', value: 'Alpha' },
          { text: 'Beta', value: 'Beta' },
        ],
      },
    ]
    const makeData = () => [
      { id: 1, name: 'Beta', children: [{ id: 11, name: 'Beta Sub' }] },
      { id: 2, name: 'Alpha' },
    ]

    const tableA = mount(FsusTable, {
      props: { columns, data: makeData(), expandable: true },
      slots: { expand: ({ row }: any) => `A:${row.name}` },
    })
    const tableB = mount(FsusTable, {
      props: { columns, data: makeData(), expandable: true },
      slots: { expand: ({ row }: any) => `B:${row.name}` },
    })

    // Sort, expand detail, expand tree, filter, and resize ONLY in Table A
    await tableA.find('thead th[data-sortable]').trigger('click')
    await tableA.find('.fsus-table__expand-btn').trigger('click')
    await tableA.find('.fsus-table__tree-toggle').trigger('click')
    await tableA.find('.fsus-table__filter-trigger').trigger('click')

    expect(tableA.find('thead th[data-sortable]').attributes('aria-sort')).toBe('ascending')
    expect(tableB.find('thead th[data-sortable]').attributes('aria-sort')).toBeUndefined()
    expect(tableA.findAll('.fsus-table__expand-row')).toHaveLength(1)
    expect(tableB.findAll('.fsus-table__expand-row')).toHaveLength(0)
    expect(tableA.text()).toContain('Beta Sub')
    expect(tableB.text()).not.toContain('Beta Sub')
    expect(tableA.find('.fsus-table__filter-panel').exists()).toBe(true)
    expect(tableB.find('.fsus-table__filter-panel').exists()).toBe(false)

    // Verify FsusAutoResizer renders wrapper and default scoped slot
    const resizer = mount(FsusAutoResizer, {
      slots: {
        default: ({ width, height }: any) => h('span', { class: 'dims' }, `${width}x${height}`),
      },
    })
    expect(resizer.find('.fsus-auto-resizer .dims').text()).toBe('0x0')
  })
})

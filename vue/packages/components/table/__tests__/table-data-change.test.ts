// @ts-nocheck
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'

import ElTable from '../src/table.vue'
import ElTableColumn from '../src/table-column'
import { doubleWait, mount } from './table-test-common'

const labels = (wrapper) =>
  wrapper
    .findAll('.el-table__body-wrapper tbody tr td:last-child')
    .map((cell) => cell.text())

const createStrategyTable = (strategy) =>
  mount({
    components: { ElTable, ElTableColumn },
    template: `
      <el-table
        ref="table"
        :data="rows"
        :data-change-strategy="strategy"
        :data-version="version"
      >
        <el-table-column prop="label" />
      </el-table>
    `,
    data: () => ({
      rows: [
        { id: 1, label: 'alpha' },
        { id: 2, label: 'beta' },
      ],
      strategy,
      version: 0,
    }),
  })

describe('Table data change strategies', () => {
  it('identity ignores nested mutations and refreshes on array replacement', async () => {
    const wrapper = createStrategyTable('identity')
    await doubleWait()
    wrapper.vm.rows[0].label = 'mutated'
    await doubleWait()
    expect(labels(wrapper)).toEqual(['alpha', 'beta'])

    wrapper.vm.rows = wrapper.vm.rows.map((row) => ({ ...row }))
    await doubleWait()
    expect(labels(wrapper)).toEqual(['mutated', 'beta'])
    wrapper.unmount()
  })

  it('version refreshes only after the explicit version changes', async () => {
    const wrapper = createStrategyTable('version')
    await doubleWait()
    wrapper.vm.rows[0].label = 'versioned'
    await doubleWait()
    expect(labels(wrapper)).toEqual(['alpha', 'beta'])

    wrapper.vm.version += 1
    await doubleWait()
    expect(labels(wrapper)).toEqual(['versioned', 'beta'])
    wrapper.unmount()
  })

  it('manual refreshes only through the public refresh API', async () => {
    const wrapper = createStrategyTable('manual')
    await doubleWait()
    wrapper.vm.rows[0].label = 'manual'
    await doubleWait()
    expect(labels(wrapper)).toEqual(['alpha', 'beta'])

    wrapper.vm.$refs.table.refresh()
    await doubleWait()
    expect(labels(wrapper)).toEqual(['manual', 'beta'])
    wrapper.unmount()
  })

  it('deep preserves nested mutation compatibility', async () => {
    const wrapper = createStrategyTable('deep')
    await doubleWait()
    const table = wrapper.vm.$refs.table
    const before = table.getLayoutDiagnostics().flushCount
    wrapper.vm.rows[0].label = 'deep'
    wrapper.vm.rows[1].label = 'batch'
    await doubleWait()
    expect(labels(wrapper)).toEqual(['deep', 'batch'])
    expect(table.getLayoutDiagnostics().flushCount).toBe(before + 1)
    expect(table.getLayoutDiagnostics().lastReasons).toContain('data-deep')
    wrapper.unmount()
  })

  it('deduplicates layout work and exposes merged reasons', async () => {
    const wrapper = createStrategyTable('manual')
    await doubleWait()
    const table = wrapper.vm.$refs.table
    await Promise.resolve()
    const before = table.getLayoutDiagnostics().flushCount

    table.refresh()
    table.refresh()
    table.refresh()
    await Promise.resolve()
    await nextTick()

    const diagnostics = table.getLayoutDiagnostics()
    expect(diagnostics.flushCount).toBe(before + 1)
    expect(diagnostics.lastReasons).toContain('data-manual')
    expect(diagnostics.pendingReasons).toEqual([])
    wrapper.unmount()
  })

  it('records column structure and container resize reasons separately', async () => {
    const wrapper = mount({
      components: { ElTable, ElTableColumn },
      template: `
        <el-table ref="table" :data="rows" :fit="false">
          <el-table-column prop="label" />
          <el-table-column v-if="showExtra" prop="extra" />
        </el-table>
      `,
      data: () => ({
        rows: [{ label: 'alpha', extra: 'detail' }],
        showExtra: false,
      }),
    })
    await doubleWait()
    const table = wrapper.vm.$refs.table

    wrapper.vm.showExtra = true
    await doubleWait()
    expect(table.getLayoutDiagnostics().lastReasons).toContain('columns')

    Object.defineProperty(table.$el, 'offsetWidth', {
      configurable: true,
      value: 640,
    })
    window.dispatchEvent(new Event('resize'))
    await doubleWait()
    expect(table.getLayoutDiagnostics().lastReasons).toContain(
      'container-resize',
    )
    wrapper.unmount()
  })

  it('preserves reserve selection by stable row key across replacement', async () => {
    const wrapper = mount({
      components: { ElTable, ElTableColumn },
      template: `
        <el-table
          ref="table"
          :data="rows"
          row-key="id"
          data-change-strategy="identity"
        >
          <el-table-column type="selection" reserve-selection />
          <el-table-column prop="label" />
        </el-table>
      `,
      data: () => ({
        rows: [
          { id: 1, label: 'alpha' },
          { id: 2, label: 'beta' },
        ],
      }),
    })
    await doubleWait()
    const table = wrapper.vm.$refs.table
    table.toggleRowSelection(wrapper.vm.rows[0], true)
    const replacement = wrapper.vm.rows.map((row) => ({
      ...row,
      label: `${row.label}-next`,
    }))
    wrapper.vm.rows = replacement
    await doubleWait()

    expect(table.getSelectionRows()).toEqual([replacement[0]])
    expect(table.store.isSelected(replacement[0])).toBe(true)
    wrapper.unmount()
  })

  it('stores filter results as source row indices before materialization', async () => {
    const wrapper = mount({
      components: { ElTable, ElTableColumn },
      template: `
        <el-table ref="table" :data="rows" data-change-strategy="identity">
          <el-table-column prop="kind" :filter-method="filterKind" />
        </el-table>
      `,
      data: () => ({
        rows: [
          { id: 1, kind: 'keep' },
          { id: 2, kind: 'drop' },
          { id: 3, kind: 'keep' },
        ],
      }),
      methods: {
        filterKind(value, row) {
          return row.kind === value
        },
      },
    })
    await doubleWait()
    const table = wrapper.vm.$refs.table
    const column = table.store.states.columns.value[0]
    table.store.commit('filterChange', {
      column,
      silent: true,
      values: ['keep'],
    })
    await doubleWait()

    expect(table.store.states.filteredRowIndices.value).toEqual(
      Uint32Array.from([0, 2]),
    )
    expect(table.store.states.data.value.map((row) => row.id)).toEqual([1, 3])
    wrapper.unmount()
  })
})

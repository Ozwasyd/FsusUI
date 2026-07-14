// @ts-nocheck
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { controllerCancel, controllerDispose, pendingSorts } = vi.hoisted(
  () => ({
    controllerCancel: vi.fn(),
    controllerDispose: vi.fn(),
    pendingSorts: [] as Array<{
      ascending: boolean
      prop: string
      resolve: (view: { materialize: () => unknown[] } | null) => void
      rows: unknown[]
    }>,
  }),
)

vi.mock('../src/composables/use-wasm-sort', () => ({
  createWasmSortController: () => ({
    cancel: controllerCancel,
    dispose: controllerDispose,
    sort: (rows: unknown[], prop: string, ascending: boolean) =>
      new Promise((resolve) => {
        pendingSorts.push({ ascending, prop, resolve, rows })
      }),
  }),
  shouldUseWasm: (rows: unknown[], column: Record<string, unknown> | null) =>
    Boolean(
      rows?.length >= 3 &&
      column &&
      !column.sortMethod &&
      !column.sortBy &&
      typeof column.sortable !== 'string',
    ),
}))

import ElTable from '../src/table.vue'
import ElTableColumn from '../src/table-column'
import { doubleWait, mount } from './table-test-common'

const flushSort = async () => {
  await Promise.resolve()
  await nextTick()
  await Promise.resolve()
}

const resolveIndices = (
  call: (typeof pendingSorts)[number],
  indices: number[],
) => {
  call.resolve({
    materialize: () => indices.map((index) => call.rows[index]),
  })
}

describe('Table public async sorting', () => {
  beforeEach(() => {
    pendingSorts.length = 0
    controllerCancel.mockClear()
    controllerDispose.mockClear()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('does not synchronously sort eligible data and commits only the latest generation', async () => {
    const wrapper = mount({
      components: { ElTable, ElTableColumn },
      template: `
        <el-table ref="table" :data="rows">
          <el-table-column prop="score" sortable />
        </el-table>
      `,
      data: () => ({
        rows: [{ score: 3 }, { score: 1 }, { score: 2 }],
      }),
    })
    await doubleWait()
    const table = wrapper.vm.$refs.table as any

    table.sort('score', 'ascending')
    expect(pendingSorts).toHaveLength(1)
    expect(table.store.states.data.value.map((row) => row.score)).toEqual([
      3, 1, 2,
    ])

    table.sort('score', 'descending')
    expect(pendingSorts).toHaveLength(2)
    resolveIndices(pendingSorts[1], [0, 2, 1])
    await flushSort()
    expect(table.store.states.data.value.map((row) => row.score)).toEqual([
      3, 2, 1,
    ])

    resolveIndices(pendingSorts[0], [1, 2, 0])
    await flushSort()
    expect(table.store.states.data.value.map((row) => row.score)).toEqual([
      3, 2, 1,
    ])

    wrapper.unmount()
    expect(controllerDispose).toHaveBeenCalledTimes(1)
  })

  it('keeps custom sort methods on the synchronous semantic path', async () => {
    const wrapper = mount({
      components: { ElTable, ElTableColumn },
      template: `
        <el-table ref="table" :data="rows">
          <el-table-column
            prop="score"
            sortable
            :sort-method="sortMethod"
          />
        </el-table>
      `,
      data: () => ({
        rows: [{ score: 3 }, { score: 1 }, { score: 2 }],
      }),
      methods: {
        sortMethod(left, right) {
          return right.score - left.score
        },
      },
    })
    await doubleWait()
    const table = wrapper.vm.$refs.table as any
    table.sort('score', 'ascending')

    expect(pendingSorts).toHaveLength(0)
    expect(controllerCancel).toHaveBeenCalled()
    expect(table.store.states.data.value.map((row) => row.score)).toEqual([
      3, 2, 1,
    ])
    wrapper.unmount()
  })

  it('falls back to the existing JS ordering when indexed sorting is unsupported', async () => {
    const wrapper = mount({
      components: { ElTable, ElTableColumn },
      template: `
        <el-table ref="table" :data="rows">
          <el-table-column prop="label" sortable />
        </el-table>
      `,
      data: () => ({
        rows: [{ label: '广州' }, { label: '上海' }, { label: '北京' }],
      }),
    })
    await doubleWait()
    const table = wrapper.vm.$refs.table as any
    table.sort('label', 'ascending')
    expect(pendingSorts).toHaveLength(1)

    pendingSorts[0].resolve(null)
    await flushSort()
    expect(table.store.states.data.value.map((row) => row.label)).toEqual([
      '上海',
      '北京',
      '广州',
    ])
    wrapper.unmount()
  })
})

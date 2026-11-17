import { computed, defineComponent, h, nextTick, provide, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'
import { configProviderContextKey } from '@element-plus/components/config-provider'
import TableV2 from '../src/table-v2'
import type {
  TableV2HeaderRowCellRendererParams,
  TableV2RowCellRenderParam,
} from '../src/components'

const generateColumns = (length = 10, prefix = 'column-', props?: any) =>
  Array.from({ length }).map((_, columnIndex) => ({
    ...props,
    key: `${prefix}${columnIndex}`,
    dataKey: `${prefix}${columnIndex}`,
    title: `Column ${columnIndex}`,
    width: 150,
  }))

const generateData = (
  columns: ReturnType<typeof generateColumns>,
  length = 200,
  prefix = 'row-'
) =>
  Array.from({ length }).map((_, rowIndex) => {
    return columns.reduce(
      (rowData, column, columnIndex) => {
        rowData[column.dataKey] = `Row ${rowIndex} - Col ${columnIndex}`
        return rowData
      },
      {
        id: `${prefix}${rowIndex}`,
        parentId: null,
      }
    )
  })

describe('TableV2.vue', () => {
  test('slots cell', async () => {
    const columns = ref(generateColumns(10))
    const data = ref(generateData(columns.value, 20))
    const customText = 'custom cell'
    const wrapper = mount(() => (
      <TableV2
        columns={columns.value}
        data={data.value}
        width={700}
        height={400}
        v-slots={{
          cell: () => <span>{customText}</span>,
        }}
      />
    ))
    expect(wrapper.find('.el-table-v2').exists()).toBe(true)
    const cell = wrapper.find('.el-table-v2__row-cell')
    expect(cell.exists()).toBe(true)
    expect(cell.find('span').text()).toBe(customText)
  })

  test('keeps default cell text and applies static and computed cell attributes', async () => {
    const columns = generateColumns(1)
    const data = generateData(columns, 1)
    const wrapper = mount(TableV2, {
      props: {
        columns,
        data,
        width: 700,
        height: 400,
        cellProps: { 'data-static': 'static' },
      },
    })

    const cell = () => wrapper.get('.el-table-v2__row-cell')
    expect(cell().text()).toBe('Row 0 - Col 0')
    expect(cell().attributes('data-static')).toBe('static')

    await wrapper.setProps({
      cellProps: ({ cellData, rowIndex }) => ({
        'data-computed': `${rowIndex}: ${cellData}`,
      }),
    })

    expect(cell().text()).toBe('Row 0 - Col 0')
    expect(cell().attributes('data-static')).toBeUndefined()
    expect(cell().attributes('data-computed')).toBe('0: Row 0 - Col 0')
  })

  test('resolves nested cell keys without overriding literal dotted keys', () => {
    const columns = [{ ...generateColumns(1)[0], dataKey: 'record.label' }]
    const wrapper = mount(TableV2, {
      props: {
        columns,
        data: [
          { id: '1', record: { label: 'nested' } },
          { id: '2', 'record.label': 'literal', record: { label: 'nested' } },
        ],
        width: 700,
        height: 400,
      },
    })
    expect(wrapper.findAll('.el-table-v2__row-cell').map((cell) => cell.text())).toEqual([
      'nested',
      'literal',
    ])
  })

  test('inherits render pipeline budget through virtual grid', async () => {
    const columns = ref(generateColumns(10))
    const data = ref(generateData(columns.value, 200))
    const PipelineTable = defineComponent({
      setup() {
        provide(
          configProviderContextKey,
          computed(
            () =>
              ({
                renderPipeline: {
                  mode: 'enabled',
                  budget: { overscanPx: 300 },
                },
              }) as any,
          ),
        )
        return () => (
          <TableV2
            columns={columns.value}
            data={data.value}
            width={700}
            height={400}
            rowHeight={50}
          />
        )
      },
    })

    const wrapper = mount(PipelineTable)
    await nextTick()

    const grid = wrapper.find('[data-fsus-render-pipeline="virtual-grid"]')
    expect(grid.exists()).toBe(true)
    expect(grid.attributes('data-fsus-render-strategy')).toBe('chunked-main')
    expect(grid.attributes('data-fsus-render-row-cache')).toBe('6')
  })

  test('slots header-cell', async () => {
    const columns = ref(generateColumns(10))
    const data = ref(generateData(columns.value, 20))
    const customText = 'header'
    const wrapper = mount(() => (
      <TableV2
        columns={columns.value}
        data={data.value}
        width={700}
        height={400}
        v-slots={{
          'header-cell': () => <span>{customText}</span>,
        }}
      />
    ))
    expect(wrapper.find('.el-table-v2').exists()).toBe(true)
    const cell = wrapper.find('.el-table-v2__header-cell')
    expect(cell.exists()).toBe(true)
    expect(cell.find('span').text()).toBe(customText)
  })

  test('slots cell scope', async () => {
    const columns = ref(generateColumns(10))
    const data = ref(generateData(columns.value, 20))
    const customText = 'custom cell'
    const wrapper = mount(() => (
      <TableV2
        columns={columns.value}
        data={data.value}
        width={700}
        height={400}
        v-slots={{
          cell: (scope: TableV2RowCellRenderParam) => (
            <span>
              {scope.rowData[scope.column.dataKey!]}
              {customText}
            </span>
          ),
        }}
      />
    ))
    expect(wrapper.find('.el-table-v2').exists()).toBe(true)
    const cell = wrapper.find('.el-table-v2__row-cell')
    expect(cell.exists()).toBe(true)
    expect(cell.find('span').text()).toBe(
      `${data.value[0][columns.value[0].dataKey]}${customText}`
    )
  })

  test('slots header-cell scope', async () => {
    const columns = ref(generateColumns(10))
    const data = ref(generateData(columns.value, 20))
    const customText = 'header'
    const wrapper = mount(() => (
      <TableV2
        columns={columns.value}
        data={data.value}
        width={700}
        height={400}
        v-slots={{
          'header-cell': (scope: TableV2HeaderRowCellRendererParams) => (
            <span>
              {scope.column.title}
              {customText}
            </span>
          ),
        }}
      />
    ))
    expect(wrapper.find('.el-table-v2').exists()).toBe(true)
    const cell = wrapper.find('.el-table-v2__header-cell')
    expect(cell.exists()).toBe(true)
    expect(cell.find('span').text()).toBe(
      `${columns.value[0].title}${customText}`
    )
  })

  test('expandable mode wrongly enabled, by column not key', async () => {
    const columns = ref([
      {
        width: 50,
        title: 'd',
        cellRenderer: ({ rowIndex }: { rowIndex: number }) => {
          return h('span', null, rowIndex)
        },
      },
      {
        width: 50,
        title: 'd',
        key: 'expandColumnKey',
        cellRenderer: ({ rowIndex }: { rowIndex: number }) => {
          return h('span', null, rowIndex)
        },
      },
    ])
    const data = ref(generateData(columns.value, 20))
    const wrapper = mount(() => (
      <TableV2
        columns={columns.value}
        data={data.value}
        width={700}
        height={400}
      />
    ))
    expect(wrapper.find('.el-table-v2').exists()).toBe(true)
    const cell = wrapper.find('.el-table-v2__row-cell')
    expect(cell.exists()).toBe(true)
    expect(cell.find('div [style^=margin-inline-star]').exists()).toBe(false)
  })
})

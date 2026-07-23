import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import ElTable from '../src/table.vue'
import ElTableColumn from '../src/table-column'
import { doubleWait, mount } from './table-test-common'

const createResponsiveTable = (columnCount: number) => {
  const columns = Array.from({ length: columnCount }, (_, index) => ({
    label: `字段 ${index + 1}`,
    prop: `field${index + 1}`,
    priority: index === 0 ? 'primary' : index < 3 ? 'secondary' : 'detail',
  }))
  const row = Object.fromEntries(
    columns.map((column, index) => [
      column.prop,
      index === columnCount - 1
        ? '含有中文与Latin-identifier-that-must-remain-readable'
        : `value-${index + 1}`,
    ]),
  )
  const columnMarkup = columns
    .map(
      (column) =>
        `<el-table-column prop="${column.prop}" label="${column.label}" priority="${column.priority}" />`,
    )
    .join('')

  return mount({
    components: { ElTable, ElTableColumn },
    template: `
      <el-table
        :data="[row]"
        responsive="auto"
        responsive-details-label="显示完整字段"
      >
        ${columnMarkup}
      </el-table>
    `,
    data: () => ({ row }),
  })
}

describe('Table responsive projection', () => {
  for (const columnCount of [3, 8, 15]) {
    it(`keeps ${columnCount} columns available through row details`, async () => {
      const wrapper = createResponsiveTable(columnCount)
      await doubleWait()

      expect(wrapper.findAll('col[data-responsive-priority]')).toHaveLength(
        columnCount * 2,
      )
      expect(wrapper.findAll('td[data-responsive-priority]')).toHaveLength(
        columnCount,
      )
      expect(
        wrapper.findAll('.el-table__responsive-detail-field'),
      ).toHaveLength(columnCount - 1)

      const toggle = wrapper.find('.el-table__responsive-toggle')
      expect(toggle.attributes('aria-label')).toBe('显示完整字段')
      expect(toggle.attributes('aria-expanded')).toBe('false')
      await toggle.trigger('click')
      await nextTick()
      expect(toggle.attributes('aria-expanded')).toBe('true')
      expect(
        wrapper.find('.el-table__responsive-detail-row').classes(),
      ).toContain('is-expanded')
      expect(
        wrapper.find('.el-table__responsive-detail-list').text(),
      ).toContain('含有中文与Latin-identifier-that-must-remain-readable')

      wrapper.unmount()
    })
  }

  it('makes explicit horizontal scroll discoverable and keyboard reachable', async () => {
    const wrapper = mount({
      components: { ElTable, ElTableColumn },
      template: `
        <el-table
          :data="[{ name: 'row' }]"
          responsive="scroll"
          scroll-aria-label="宽数据表"
        >
          <el-table-column prop="name" label="名称" width="800" />
        </el-table>
      `,
    })
    await doubleWait()

    const scrollRegion = wrapper.find('.el-table__body-wrapper')
    expect(scrollRegion.attributes('tabindex')).toBe('0')
    expect(scrollRegion.attributes('role')).toBe('region')
    expect(scrollRegion.attributes('aria-label')).toBe('宽数据表')
    expect(wrapper.find('.el-table__scroll-affordance').exists()).toBe(true)
  })

  it('makes auto mode overflow discoverable when desktop columns exceed the container', async () => {
    const wrapper = createResponsiveTable(8)
    await doubleWait()

    const table = wrapper.findComponent(ElTable)
    table.vm.layout.scrollX.value = true
    await nextTick()

    const scrollRegion = wrapper.find('.el-table__body-wrapper')
    expect(scrollRegion.attributes('tabindex')).toBe('0')
    expect(scrollRegion.attributes('role')).toBe('region')
    expect(scrollRegion.attributes('aria-label')).toBe('Scrollable data table')
    expect(wrapper.find('.el-table__scroll-affordance').exists()).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import {
  FsusAvatar,
  FsusBreadcrumb,
  FsusBreadcrumbItem,
  FsusCarousel,
  FsusCarouselItem,
  FsusCollapse,
  FsusCollapseItem,
  FsusCountdown,
  FsusDescriptions,
  FsusDescriptionsItem,
  FsusImage,
  FsusMenu,
  FsusMenuItem,
  FsusMetricItem,
  FsusMetricList,
  FsusPageHeader,
  FsusPagination,
  FsusPerceptionChallenge,
  FsusPublicShell,
  FsusSegmentedControl,
  FsusSplitPane,
  FsusStatistic,
  FsusStep,
  FsusSteps,
  FsusTable,
  FsusTabPane,
  FsusTabs,
  FsusTimeline,
  FsusTimelineItem,
  FsusTree,
  FsusTreeSelect,
  FsusTypedConfirmField,
  FsusVirtualList,
  FsusWatermark,
} from '../index'

describe('Phase 3 Data, Navigation & Native Primitives', () => {
  it('supports unified FsusTable sorting, selection, and automatic virtualization for 300 rows', async () => {
    const data = Array.from({ length: 300 }, (_, i) => ({
      id: i + 1,
      name: `Row ${String(300 - i).padStart(3, '0')}`,
      score: 300 - i,
    }))
    const w = mount(FsusTable, {
      props: {
        data,
        columns: [
          { key: 'name', prop: 'name', label: 'Name', sortable: true },
          { key: 'score', prop: 'score', label: 'Score', sortable: true },
        ],
        selectable: true,
        height: 240,
        rowHeight: 40,
        virtualThreshold: 50,
      },
    })
    // Virtualized: renders small window of rows instead of 300
    expect(w.findAll('.fsus-table__row').length).toBeLessThan(30)
    await w.find('[data-sortable]').trigger('click')
    expect(w.emitted('sortChange')?.[0]).toEqual([{ prop: 'name', order: 'asc' }])
    expect(w.find('.fsus-table__row').text()).toContain('Row 001')
  })

  it('supports unified FsusTree expansion, filtering, checkable, and FsusTreeSelect', async () => {
    const nodes = [
      {
        id: '1',
        label: 'Docs',
        children: [
          { id: '1-1', label: 'Architecture' },
          { id: '1-2', label: 'Tokens' },
        ],
      },
    ]
    const tree = mount(FsusTree, {
      props: { data: nodes, defaultExpandAll: true, checkable: true },
    })
    expect(tree.findAll('[role="treeitem"]')).toHaveLength(3)
    await tree.setProps({ filterText: 'Token' })
    expect(tree.findAll('[role="treeitem"]')).toHaveLength(2)

    const ts = mount(FsusTreeSelect, { props: { data: nodes, modelValue: '1-2' } })
    expect(ts.text()).toContain('Tokens')
  })

  it('supports FsusVirtualList, FsusPagination, Carousel, Collapse, Display widgets', async () => {
    const vl = mount(FsusVirtualList, {
      props: { items: Array.from({ length: 500 }, (_, i) => `V-${i}`), height: 200, itemHeight: 40 },
      slots: { default: ({ item }: any) => h('span', String(item)) },
    })
    expect(vl.findAll('.fsus-virtual-list__item').length).toBeLessThan(25)

    const pg = mount(FsusPagination, { props: { total: 100, pageSize: 10, currentPage: 1 } })
    await pg.findAll('.fsus-pagination__page')[1]!.trigger('click')
    expect(pg.emitted('update:currentPage')?.[0]).toEqual([2])

    const col = mount(FsusCollapse, {
      props: { modelValue: ['a'] },
      slots: { default: () => h(FsusCollapseItem, { name: 'a', title: 'Panel A' }, () => 'Body A') },
    })
    expect(col.text()).toContain('Body A')

    expect(mount(FsusAvatar, { props: { alt: 'FsusUI' } }).text()).toBe('FS')
    expect(mount(FsusStatistic, { props: { title: 'Users', value: 1200 } }).text()).toContain('Users')
    expect(mount(FsusCountdown, { props: { value: Date.now() + 60000 } }).exists()).toBe(true)
    expect(
      mount(FsusDescriptions, {
        props: { title: 'Info' },
        slots: { default: () => h(FsusDescriptionsItem, { label: 'Version' }, () => '2.0.0') },
      }).text(),
    ).toContain('2.0.0')
    expect(
      mount(FsusTimeline, {
        slots: { default: () => h(FsusTimelineItem, { timestamp: '2026-11-28' }, () => 'v2') },
      }).text(),
    ).toContain('2026-11-28')
    expect(mount(FsusWatermark, { props: { content: 'FsusUI' } }).find('.fsus-watermark__layer').exists()).toBe(true)
    expect(mount(FsusCarousel, { slots: { default: () => h(FsusCarouselItem, {}, () => 'S1') } }).text()).toContain('S1')
    expect(mount(FsusImage, { props: { src: 'https://example.com/a.png', alt: 'Demo' } }).find('img').exists()).toBe(true)
  })

  it('supports Navigation (Menu, Tabs, Breadcrumb, PageHeader, Steps) and Native Primitives', async () => {
    const menu = mount(FsusMenu, {
      props: { defaultActive: 'home' },
      slots: { default: () => [h(FsusMenuItem, { index: 'home' }, () => 'Home'), h(FsusMenuItem, { index: 'about' }, () => 'About')] },
    })
    await menu.findAll('[role="menuitem"]')[1]!.trigger('click')
    expect(menu.emitted('select')?.[0]).toEqual(['about'])

    const tabs = mount(FsusTabs, {
      props: { modelValue: 'one' },
      slots: { default: () => [h(FsusTabPane, { name: 'one', label: 'One' }, () => 'Tab 1'), h(FsusTabPane, { name: 'two', label: 'Two' }, () => 'Tab 2')] },
    })
    expect(tabs.text()).toContain('Tab 1')

    expect(
      mount(FsusBreadcrumb, { slots: { default: () => h(FsusBreadcrumbItem, { current: true }, () => 'Docs') } }).text(),
    ).toContain('Docs')
    expect(mount(FsusPageHeader, { props: { title: 'Workspace', subtitle: 'Overview' } }).text()).toContain('Workspace')
    expect(mount(FsusSteps, { props: { active: 1 }, slots: { default: () => [h(FsusStep, { title: 'One' }), h(FsusStep, { title: 'Two' })] } }).findAll('.fsus-step')).toHaveLength(2)

    expect(mount(FsusPublicShell, { props: { brand: 'FsusUI' }, slots: { default: 'Main' } }).text()).toContain('FsusUI')
    const seg = mount(FsusSegmentedControl, { props: { modelValue: 'a', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] } })
    await seg.findAll('[role="radio"]')[1]!.trigger('click')
    expect(seg.emitted('update:modelValue')?.[0]).toEqual(['b'])

    expect(mount(FsusMetricList, { slots: { default: () => h(FsusMetricItem, { label: 'Latency', value: '12ms' }) } }).text()).toContain('12ms')
    expect(mount(FsusSplitPane, { slots: { start: () => 'List', end: () => 'Thread' } }).text()).toContain('Thread')
    expect(mount(FsusTypedConfirmField, { props: { expected: 'DELETE' } }).find('button').attributes('disabled')).toBeDefined()

    const ch = mount(FsusPerceptionChallenge, {
      props: { assignment: { id: 'c1', kind: 'micro-interaction', prompt: 'Click complete' } },
    })
    await ch.find('button').trigger('click')
    expect(ch.emitted('submit')?.[0]?.[0]).toMatchObject({ assignmentId: 'c1', kind: 'micro-interaction' })
  })
})

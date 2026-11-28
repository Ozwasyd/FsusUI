import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import {
  FsusCarousel,
  FsusCarouselItem,
  FsusCascader,
  FsusCascaderPanel,
  FsusColorPicker,
  FsusDatePicker,
  FsusMenu,
  FsusMenuItem,
  FsusPagination,
  FsusSelect,
  FsusSlider,
  FsusTable,
  FsusTabPane,
  FsusTabs,
  FsusTree,
  FsusUpload,
  type FsusCascaderOption,
  type FsusTableColumnDef,
  type FsusTreeNode,
  type FsusUploadFile,
} from '../index'
import { formatColor, hsvaToRgba, parseColor } from '../color-picker/color-math'

describe('FsusUI 2.0 Advanced Component Upgrades', () => {
  // ─── 1. FsusTable ───────────────────────────────────────────────────────────
  describe('FsusTable full data-grid features', () => {
    it('supports grouped headers, fixed columns, expand rows, tree rows, spanMethod, filter popover, resize, and summary footer', async () => {
      const columns: FsusTableColumnDef[] = [
        { key: 'name', label: 'Name', fixed: 'left', width: 120, resizable: true },
        {
          key: 'metrics',
          label: 'Metrics',
          children: [
            {
              key: 'role',
              label: 'Role',
              width: 100,
              filters: [
                { text: 'Admin', value: 'admin' },
                { text: 'User', value: 'user' },
              ],
            },
            { key: 'score', label: 'Score', width: 100, align: 'right' },
          ],
        },
        { key: 'action', label: 'Action', fixed: 'right', width: 90 },
      ]
      const data = [
        {
          id: 1,
          name: 'Alice',
          role: 'admin',
          score: 80,
          action: 'Edit',
          children: [{ id: 11, name: 'Alice Sub', role: 'admin', score: 20, action: 'Sub' }],
        },
        { id: 2, name: 'Bob', role: 'user', score: 40, action: 'Edit' },
      ]

      const wrapper = mount(FsusTable, {
        props: {
          columns,
          data,
          expandable: true,
          showSummary: true,
          sumText: 'SUM',
        },
        slots: {
          expand: ({ row }: { row: Record<string, any> }) =>
            h('div', { class: 'detail-box' }, `Details for ${row.name}`),
        },
      })

      // Multi-level grouped header: 2 rows in thead, "Metrics" spans 2 cols
      const headRows = wrapper.findAll('thead tr')
      expect(headRows).toHaveLength(2)
      const metricsTh = headRows[0]!.findAll('th').find((th) => th.text().includes('Metrics'))
      expect(metricsTh?.attributes('colspan')).toBe('2')

      // Sticky fixed left & right attributes
      const nameTh = headRows[0]!.findAll('th').find((th) => th.text().includes('Name'))
      expect(nameTh?.attributes('data-fixed')).toBe('left')
      expect(nameTh?.attributes('data-fixed-edge')).toBe('left')
      const actionTh = headRows[0]!.findAll('th').find((th) => th.text().includes('Action'))
      expect(actionTh?.attributes('data-fixed')).toBe('right')
      expect(actionTh?.attributes('data-fixed-edge')).toBe('right')

      // Summary footer sums numeric column (80 + 40 = 120)
      expect(wrapper.find('tfoot').text()).toContain('SUM')
      expect(wrapper.find('tfoot').text()).toContain('120')

      // Expandable detail row
      await wrapper.find('.fsus-table__expand-btn').trigger('click')
      expect(wrapper.find('.detail-box').text()).toBe('Details for Alice')

      // Hierarchical tree row toggle
      expect(wrapper.text()).not.toContain('Alice Sub')
      await wrapper.find('.fsus-table__tree-toggle').trigger('click')
      expect(wrapper.text()).toContain('Alice Sub')
      // Summary now includes child row (80 + 20 + 40 = 140)
      expect(wrapper.find('tfoot').text()).toContain('140')

      // Filter popover: filter Role === 'user'
      await wrapper.find('.fsus-table__filter-trigger').trigger('click')
      const checkboxes = wrapper.findAll('.fsus-table__filter-item input')
      expect(checkboxes).toHaveLength(2)
      await checkboxes[1]!.trigger('change')
      await wrapper.find('.fsus-table__filter-btn[data-primary]').trigger('click')
      expect(wrapper.findAll('tbody .fsus-table__row')).toHaveLength(1)
      expect(wrapper.text()).toContain('Bob')
      expect(wrapper.text()).not.toContain('Alice')

      // Column resize handle emits columnResize
      const handle = wrapper.find('.fsus-table__resize-handle')
      handle.element.dispatchEvent(new MouseEvent('pointerdown', { clientX: 100, bubbles: true }))
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 150 }))
      window.dispatchEvent(new MouseEvent('pointerup'))
      await nextTick()
      expect(wrapper.emitted('columnResize')?.length).toBeGreaterThan(0)
    })

    it('supports cell merging via spanMethod', () => {
      const wrapper = mount(FsusTable, {
        props: {
          columns: [
            { key: 'a', label: 'A' },
            { key: 'b', label: 'B' },
          ],
          data: [
            { id: 1, a: 'Merged', b: 'B1' },
            { id: 2, a: 'Hidden', b: 'B2' },
          ],
          spanMethod: ({ rowIndex, columnIndex }) => {
            if (columnIndex === 0) return rowIndex === 0 ? [2, 1] : [0, 0]
            return [1, 1]
          },
        },
      })
      const rows = wrapper.findAll('tbody tr')
      expect(rows[0]!.findAll('td')[0]!.attributes('rowspan')).toBe('2')
      expect(rows[1]!.findAll('td')).toHaveLength(1)
    })
  })

  // ─── 2. FsusDatePicker & FsusColorPicker ────────────────────────────────────
  describe('FsusDatePicker multi-mode & manual editing', () => {
    it('supports year, month, week, datetime spinners, shortcuts, and manual input parsing', async () => {
      // Year mode
      const yearModel = ref<string | null>(null)
      const yearWrapper = mount(FsusDatePicker, {
        props: {
          mode: 'year',
          modelValue: yearModel.value,
          'onUpdate:modelValue': (v: any) => (yearModel.value = v),
        },
        attachTo: document.body,
      })
      await yearWrapper.find('.fsus-date-picker').trigger('click')
      const yrBtns = document.body.querySelectorAll<HTMLButtonElement>('.fsus-date-panel__cell--wide')
      expect(yrBtns.length).toBe(10)
      yrBtns[2]!.click()
      await nextTick()
      expect(yearModel.value).toMatch(/^\d{4}$/)
      yearWrapper.unmount()

      // Month mode + shortcuts + manual input
      const dtModel = ref<string | null>('2026-05-10 08:15:30')
      const dtWrapper = mount(FsusDatePicker, {
        props: {
          mode: 'datetime',
          modelValue: dtModel.value,
          shortcuts: [{ text: 'New Year', value: new Date(2026, 0, 1, 9, 0, 0) }],
          'onUpdate:modelValue': (v: any) => (dtModel.value = v),
        },
        attachTo: document.body,
      })

      // Manual editable input
      const input = dtWrapper.find('.fsus-date-picker__input')
      await input.setValue('2026-06-15 14:30:00')
      await input.trigger('keydown.enter')
      expect(dtModel.value).toBe('2026-06-15 14:30:00')

      // Open popover, verify shortcuts + time columns, click shortcut
      await dtWrapper.find('.fsus-date-picker').trigger('click')
      const timeCols = document.body.querySelectorAll('.fsus-date-panel__time-col')
      expect(timeCols.length).toBe(3)
      const shortcutBtn = document.body.querySelector<HTMLButtonElement>('.fsus-date-panel__shortcut')
      expect(shortcutBtn?.textContent).toContain('New Year')
      shortcutBtn!.click()
      await nextTick()
      expect(dtModel.value).toBe('2026-01-01 09:00:00')
      dtWrapper.unmount()

      // Week mode
      const wkModel = ref<string | null>(null)
      const wkWrapper = mount(FsusDatePicker, {
        props: {
          mode: 'week',
          modelValue: wkModel.value,
          'onUpdate:modelValue': (v: any) => (wkModel.value = v),
        },
        attachTo: document.body,
      })
      await wkWrapper.find('.fsus-date-picker').trigger('click')
      expect(document.body.querySelectorAll('.fsus-date-panel__week-row').length).toBe(6)
      document.body.querySelector<HTMLButtonElement>('.fsus-date-panel__week-row .fsus-date-panel__cell')!.click()
      await nextTick()
      expect(wkModel.value).toMatch(/^\d{4}-W\d{2}$/)
      wkWrapper.unmount()
    })
  })

  describe('FsusColorPicker pure-TS color engine & interactive canvas', () => {
    it('converts accurately between HEX, RGB, HSL, and HSVA with alpha', () => {
      const parsed = parseColor('rgba(42, 89, 156, 0.5)')
      expect(parsed).not.toBeNull()
      expect(parsed!.a).toBe(0.5)
      const rgba = hsvaToRgba(parsed!)
      expect(rgba.r).toBeCloseTo(42, -1)
      expect(rgba.b).toBeCloseTo(156, -1)
      expect(formatColor(parsed!, 'rgb', true)).toMatch(/^rgba\(/)
      expect(formatColor(parsed!, 'hsl', true)).toMatch(/^hsla\(/)
      expect(formatColor(parsed!, 'hex', true)).toMatch(/^#[0-9A-F]{8}$/)
    })

    it('renders 2D SV canvas, Hue/Alpha sliders, format tabs, and confirms color', async () => {
      const color = ref('#2A599C')
      const wrapper = mount(FsusColorPicker, {
        props: {
          modelValue: color.value,
          showAlpha: true,
          'onUpdate:modelValue': (v: string) => (color.value = v),
        },
        attachTo: document.body,
      })

      await wrapper.find('.fsus-color-picker__trigger').trigger('click')
      expect(document.body.querySelector('.fsus-color-picker__sv')).not.toBeNull()
      expect(document.body.querySelector('.fsus-color-picker__hue')).not.toBeNull()
      expect(document.body.querySelector('.fsus-color-picker__alpha-bar')).not.toBeNull()

      // Switch to RGB format and adjust hue via keyboard
      const tabs = document.body.querySelectorAll<HTMLButtonElement>('.fsus-color-picker__format-tab')
      tabs[1]!.click() // RGB
      await nextTick()
      const hueEl = document.body.querySelector<HTMLElement>('.fsus-color-picker__hue')!
      hueEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
      await nextTick()

      // Confirm
      const confirmBtn = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
        (b) => b.classList.contains('fsus-button') && b.getAttribute('data-variant') === 'primary',
      )
      confirmBtn!.click()
      await nextTick()
      expect(color.value).toMatch(/^rgba\(/)
      wrapper.unmount()
    })
  })

  // ─── 3. FsusTree, FsusSelect, FsusCascader ──────────────────────────────────
  describe('FsusTree tri-state, lazy loading, accordion, DnD, keyboard', () => {
    it('propagates tri-state checkboxes (checked + indeterminate) and supports accordion + keyboard nav', async () => {
      const checkedKeys = ref<Array<string | number>>([])
      const data: FsusTreeNode[] = [
        {
          id: 'p1',
          label: 'Parent 1',
          children: [
            { id: 'c1', label: 'Child 1' },
            { id: 'c2', label: 'Child 2' },
          ],
        },
        {
          id: 'p2',
          label: 'Parent 2',
          children: [{ id: 'c3', label: 'Child 3' }],
        },
      ]

      const wrapper = mount(
        defineComponent({
          setup() {
            return () =>
              h(FsusTree, {
                data,
                checkable: true,
                accordion: true,
                checkedKeys: checkedKeys.value,
                'onUpdate:checkedKeys': (keys: Array<string | number>) => (checkedKeys.value = keys),
              })
          },
        }),
      )

      // Expand Parent 1, then Parent 2 -> accordion collapses Parent 1
      await wrapper.findAll('.fsus-tree__expand')[0]!.trigger('click')
      expect(wrapper.text()).toContain('Child 1')

      // Check only Child 1 -> Parent 1 becomes indeterminate (aria-checked="mixed")
      const child1Check = wrapper.findAll('.fsus-tree__checkbox')[1]!
      await child1Check.trigger('change')
      expect(checkedKeys.value).toEqual(['c1'])
      expect(wrapper.findAll('[role="treeitem"]')[0]!.attributes('aria-checked')).toBe('mixed')

      // Check Child 2 -> Parent 1 becomes fully checked
      await wrapper.findAll('.fsus-tree__checkbox')[2]!.trigger('change')
      expect(checkedKeys.value).toContain('p1')
      expect(wrapper.findAll('[role="treeitem"]')[0]!.attributes('aria-checked')).toBe('true')

      // Expand Parent 2 collapses Parent 1 due to accordion
      const p2Expand = wrapper.findAll('.fsus-tree__expand')[1]!
      await p2Expand.trigger('click')
      expect(wrapper.text()).not.toContain('Child 1')
      expect(wrapper.text()).toContain('Child 3')

      // Keyboard navigation: ArrowLeft collapses Parent 2
      await wrapper.find('.fsus-tree').trigger('keydown', { key: 'ArrowDown' })
      await wrapper.find('.fsus-tree').trigger('keydown', { key: 'ArrowLeft' })
      expect(wrapper.text()).not.toContain('Child 3')
    })

    it('supports async lazy loading and drag-and-drop reordering', async () => {
      const loadFn = vi.fn(async (node: FsusTreeNode) => [{ id: `${node.id}-sub`, label: 'Loaded Child', isLeaf: true }])
      const lazyTree = mount(FsusTree, {
        props: {
          data: [{ id: 'root', label: 'Root Lazy' }],
          lazy: true,
          load: loadFn,
        },
      })
      await lazyTree.find('.fsus-tree__expand').trigger('click')
      await nextTick()
      await nextTick()
      expect(loadFn).toHaveBeenCalledTimes(1)
      expect(lazyTree.text()).toContain('Loaded Child')

      // Drag and drop reordering
      const dragData: FsusTreeNode[] = [
        { id: 'a', label: 'Node A' },
        { id: 'b', label: 'Node B' },
      ]
      const dndTree = mount(FsusTree, { props: { data: dragData, draggable: true } })
      const items = dndTree.findAll('[role="treeitem"]')
      await items[0]!.trigger('dragstart')
      await items[1]!.trigger('dragover', { clientY: 100 })
      await items[1]!.trigger('drop')
      expect(dndTree.emitted('nodeDrop')).toHaveLength(1)
    })
  })

  describe('FsusSelect allowCreate, remote debounce + stale guard, collapseTags', () => {
    it('creates new option on allowCreate and collapses multi-select tags', async () => {
      const selected = ref<string[]>(['a', 'b'])
      const wrapper = mount(FsusSelect, {
        props: {
          modelValue: selected.value,
          multiple: true,
          collapseTags: true,
          maxCollapseTags: 1,
          filterable: true,
          allowCreate: true,
          options: [
            { value: 'a', label: 'Alpha' },
            { value: 'b', label: 'Beta' },
          ],
          'onUpdate:modelValue': (v: any) => (selected.value = v),
        },
        attachTo: document.body,
      })

      expect(wrapper.findAll('.fsus-select__chip')).toHaveLength(2) // Alpha + "+1"
      expect(wrapper.find('.fsus-select__chip--collapse').text()).toBe('+1')

      await wrapper.find('.fsus-select').trigger('click')
      const search = document.body.querySelector<HTMLInputElement>('.fsus-select__search-input')!
      search.value = 'Gamma'
      search.dispatchEvent(new Event('input'))
      await nextTick()

      const createOpt = document.body.querySelector<HTMLButtonElement>('[data-created]')
      expect(createOpt).not.toBeNull()
      createOpt!.click()
      await nextTick()
      expect(wrapper.emitted('create')?.[0]).toEqual(['Gamma'])
      expect(selected.value).toContain('Gamma')
      wrapper.unmount()
    })

    it('invokes remoteMethod with debounce and handles loading cleanly', async () => {
      const remoteMethod = vi.fn(async () => {})
      const wrapper = mount(FsusSelect, {
        props: {
          remote: true,
          remoteDebounce: 0,
          remoteMethod,
          options: [],
        },
        attachTo: document.body,
      })
      await wrapper.find('.fsus-select').trigger('click')
      const search = document.body.querySelector<HTMLInputElement>('.fsus-select__search-input')!
      search.value = 'vue'
      search.dispatchEvent(new Event('input'))
      await nextTick()
      expect(remoteMethod).toHaveBeenCalledWith('vue')
      wrapper.unmount()
    })
  })

  describe('FsusCascader multiple, checkStrictly, lazy, filterable', () => {
    const options: FsusCascaderOption[] = [
      {
        value: 'cn',
        label: 'China',
        children: [
          { value: 'bj', label: 'Beijing' },
          { value: 'sh', label: 'Shanghai' },
        ],
      },
    ]

    it('supports multiple selection with filterable path search and lazyLoad', async () => {
      const val = ref<Array<Array<string | number>>>([])
      const wrapper = mount(FsusCascader, {
        props: {
          modelValue: val.value,
          options,
          multiple: true,
          filterable: true,
          'onUpdate:modelValue': (v: any) => (val.value = v),
        },
        attachTo: document.body,
      })

      await wrapper.find('.fsus-cascader').trigger('click')
      const search = document.body.querySelector<HTMLInputElement>('.fsus-select__search-input')!
      search.value = 'Shanghai'
      search.dispatchEvent(new Event('input'))
      await nextTick()

      const suggestion = document.body.querySelector<HTMLButtonElement>(
        '.fsus-cascader__suggestions [role="option"]',
      )
      expect(suggestion?.textContent).toContain('China / Shanghai')
      suggestion!.click()
      await nextTick()
      expect(val.value).toEqual([['cn', 'sh']])
      wrapper.unmount()

      // Lazy load in FsusCascaderPanel
      const lazyLoad = vi.fn(async () => [{ value: 'leaf1', label: 'Leaf 1', leaf: true }])
      const panel = mount(FsusCascaderPanel, {
        props: {
          options: [{ value: 'root', label: 'Root' }],
          lazy: true,
          lazyLoad,
        },
      })
      await panel.find('.fsus-cascader-panel__item').trigger('click')
      await nextTick()
      await nextTick()
      expect(lazyLoad).toHaveBeenCalledTimes(1)
      expect(panel.text()).toContain('Leaf 1')
    })
  })

  // ─── 4. Upload, Slider, Pagination, Menu, Tabs, Carousel ────────────────────
  describe('FsusUpload XHR engine, manual submit, and picture-card cleanup', () => {
    it('queues files when autoUpload is false and uploads on submit() via XHR with progress', async () => {
      const sentHeaders: Record<string, string> = {}
      class MockXHR {
        status = 200
        responseText = '{"ok":true}'
        withCredentials = false
        upload: { onprogress?: (e: ProgressEvent) => void } = {}
        onload?: () => void
        onerror?: () => void
        onabort?: () => void
        open = vi.fn()
        setRequestHeader = vi.fn((k: string, v: string) => {
          sentHeaders[k] = v
        })
        abort = vi.fn()
        send = vi.fn(() => {
          this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 } as ProgressEvent)
          this.onload?.()
        })
      }
      vi.stubGlobal('XMLHttpRequest', MockXHR)

      const files = ref<FsusUploadFile[]>([])
      const progressEvents: number[] = []
      const successResponses: unknown[] = []
      const uploadRef = ref<InstanceType<typeof FsusUpload> | null>(null)
      const wrapper = mount(
        defineComponent({
          setup() {
            return () =>
              h(FsusUpload, {
                ref: uploadRef,
                action: '/api/upload',
                headers: { Authorization: 'Bearer tok' },
                autoUpload: false,
                listType: 'picture-card',
                fileList: files.value,
                'onUpdate:fileList': (v: FsusUploadFile[]) => (files.value = v),
                onProgress: (pct: number) => progressEvents.push(pct),
                onSuccess: (res: unknown) => successResponses.push(res),
              })
          },
        }),
      )

      const file = new File(['hello'], 'photo.png', { type: 'image/png' })
      const input = wrapper.find('input[type="file"]')
      Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
      await input.trigger('change')
      await nextTick()

      expect(files.value).toHaveLength(1)
      expect(files.value[0]!.status).toBe('ready')

      await uploadRef.value!.submit()
      await nextTick()
      expect(files.value[0]!.status).toBe('success')
      expect(files.value[0]!.progress).toBe(100)
      expect(sentHeaders.Authorization).toBe('Bearer tok')
      expect(progressEvents[0]).toBe(50)
      expect(successResponses[0]).toEqual({ ok: true })

      uploadRef.value!.clearFiles()
      await nextTick()
      expect(files.value).toHaveLength(0)

      vi.unstubAllGlobals()
    })
  })

  describe('FsusSlider vertical, stops, marks, and tooltip', () => {
    it('renders stops, vertical mode, object marks, and custom formatted tooltip', async () => {
      const val = ref(20)
      const wrapper = mount(FsusSlider, {
        props: {
          modelValue: val.value,
          step: 20,
          showStops: true,
          vertical: true,
          height: 180,
          formatTooltip: (v: number) => `${v}%`,
          marks: { 0: '0%', 100: { label: 'MAX' } },
          'onUpdate:modelValue': (v: any) => (val.value = v),
        },
      })

      expect(wrapper.find('.fsus-slider').attributes('data-vertical')).toBe('')
      expect(wrapper.findAll('.fsus-slider__stop')).toHaveLength(4)
      expect(wrapper.find('.fsus-slider__tooltip').text()).toBe('20%')
      expect(wrapper.text()).toContain('MAX')

      await wrapper.find('.fsus-slider__thumb').trigger('keydown.up')
      expect(val.value).toBe(40)
      await wrapper.find('.fsus-slider__thumb').trigger('keydown.end')
      expect(val.value).toBe(100)
    })
  })

  describe('FsusPagination layout, sizes, jumper, hideOnSinglePage', () => {
    it('renders sizes + jumper and emits sizeChange / change', async () => {
      const page = ref(2)
      const size = ref(10)
      const wrapper = mount(FsusPagination, {
        props: {
          total: 100,
          currentPage: page.value,
          pageSize: size.value,
          pageSizes: [10, 25, 50],
          layout: 'total, sizes, prev, pager, next, jumper',
          'onUpdate:currentPage': (p: number) => (page.value = p),
          'onUpdate:pageSize': (s: number) => (size.value = s),
        },
      })

      const select = wrapper.find('.fsus-pagination__sizes')
      await select.setValue('25')
      expect(size.value).toBe(25)
      expect(wrapper.emitted('sizeChange')?.[0]).toEqual([25])

      const jumper = wrapper.find('.fsus-pagination__jumper-input')
      await jumper.setValue('4')
      await jumper.trigger('keydown.enter')
      expect(page.value).toBe(4)

      const hidden = mount(FsusPagination, {
        props: { total: 5, pageSize: 10, hideOnSinglePage: true },
      })
      expect(hidden.find('nav').exists()).toBe(false)
    })
  })

  describe('FsusMenu horizontal ellipsis overflow', () => {
    it('moves overflowing horizontal items into the More submenu', async () => {
      const wrapper = mount(FsusMenu, {
        props: { mode: 'horizontal', ellipsis: true },
        slots: {
          default: () => [
            h(FsusMenuItem, { index: '1' }, () => 'One'),
            h(FsusMenuItem, { index: '2' }, () => 'Two'),
            h(FsusMenuItem, { index: '3' }, () => 'Three'),
          ],
        },
      })

      const ul = wrapper.find('.fsus-menu').element as HTMLElement
      Object.defineProperty(ul, 'clientWidth', { value: 180, configurable: true })
      Array.from(ul.children).forEach((child) => {
        Object.defineProperty(child, 'offsetWidth', { value: 100, configurable: true })
      })

      ;(wrapper.vm as any).recalculateOverflow()
      await nextTick()

      const moreTrigger = wrapper.find('.fsus-menu__more-trigger')
      expect(moreTrigger.exists()).toBe(true)
      await moreTrigger.trigger('click')
      expect(wrapper.find('.fsus-menu__more-list').text()).toContain('Three')
    })
  })

  describe('FsusTabs editable add/remove', () => {
    it('emits tabAdd / tabRemove / edit and unregisters removed panes cleanly', async () => {
      const tabs = ref([
        { name: 't1', label: 'Tab 1' },
        { name: 't2', label: 'Tab 2' },
      ])
      const active = ref('t1')
      const onEdit = vi.fn()

      const wrapper = mount(
        defineComponent({
          setup() {
            return () =>
              h(
                FsusTabs,
                {
                  modelValue: active.value,
                  editable: true,
                  'onUpdate:modelValue': (v: any) => (active.value = v),
                  onEdit,
                },
                () => tabs.value.map((t) => h(FsusTabPane, { key: t.name, name: t.name, label: t.label }, () => t.label)),
              )
          },
        }),
      )

      await wrapper.find('.fsus-tabs__add').trigger('click')
      expect(onEdit).toHaveBeenCalledWith(undefined, 'add')

      await wrapper.findAll('.fsus-tabs__close')[1]!.trigger('click')
      expect(onEdit).toHaveBeenCalledWith('t2', 'remove')

      tabs.value = tabs.value.filter((t) => t.name !== 't2')
      await nextTick()
      expect(wrapper.findAll('[role="tab"]')).toHaveLength(1)
    })
  })

  describe('FsusCarousel card stage & vertical direction', () => {
    it('switches slides by clicking adjacent cards and keyboard arrows', async () => {
      const wrapper = mount(
        defineComponent({
          setup() {
            return () =>
              h(FsusCarousel, { type: 'card', direction: 'horizontal' }, () => [
                h(FsusCarouselItem, () => 'Slide 1'),
                h(FsusCarouselItem, () => 'Slide 2'),
                h(FsusCarouselItem, () => 'Slide 3'),
              ])
          },
        }),
      )
      await nextTick()

      const items = wrapper.findAll('.fsus-carousel__item')
      expect(items[0]!.attributes('data-stage')).toBe('active')
      expect(items[1]!.attributes('data-stage')).toBe('next')
      expect(items[2]!.attributes('data-stage')).toBe('prev')

      // Click next card -> becomes active
      await items[1]!.trigger('click')
      expect(items[1]!.attributes('data-stage')).toBe('active')

      // Keyboard ArrowRight -> advances to Slide 3
      await wrapper.find('.fsus-carousel').trigger('keydown', { key: 'ArrowRight' })
      expect(items[2]!.attributes('data-stage')).toBe('active')
    })
  })
})

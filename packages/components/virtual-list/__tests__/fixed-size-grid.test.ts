import { computed, defineComponent, nextTick, provide, unref } from 'vue'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import makeMount from '@element-plus/test-utils/make-mount'
import makeScroll from '@element-plus/test-utils/make-scroll'
import { configProviderContextKey } from '@element-plus/components/config-provider'
import setupMock from '../setup-mock'
import {
  CENTERED_ALIGNMENT,
  END_ALIGNMENT,
  SMART_ALIGNMENT,
  START_ALIGNMENT,
} from '../src/defaults'
import { FixedSizeGrid } from '..'

import type { GridExposes } from '../src/types'

type GridRef = GridExposes

const onItemRendered = vi.fn()
const WINDOW_KLS = 'window'
const ITEM_KLS = 'item'
const ITEM_SELECTOR = `.${ITEM_KLS}`
const waitForScrollReset = async () => {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await nextTick()
}
const mount = makeMount(
  {
    template: `<fixed-size-grid v-bind="$attrs" ref="gridRef">
    <template #default="{columnIndex, style, rowIndex}">
      <div class="${ITEM_KLS}" :style="style">item {{ rowIndex }} {{ columnIndex }}</div>
    </template>
  </fixed-size-grid>`,
    components: {
      FixedSizeGrid,
    },
  },
  {
    props: {
      className: WINDOW_KLS,
      columnWidth: 50,
      height: 100,
      rowHeight: 25,
      totalColumn: 100,
      totalRow: 100,
      width: 100,
      onItemRendered,
    },
  },
)

const RenderPipelineProvider = defineComponent({
  setup(_, { slots }) {
    provide(
      configProviderContextKey,
      computed(
        () =>
          ({
            renderPipeline: {
              mode: 'enabled',
              budget: { overscanPx: 150 },
            },
          }) as any,
      ),
    )
    return () => slots.default?.()
  },
})

const mountWithPipeline = makeMount(
  {
    template: `
      <render-pipeline-provider>
        <fixed-size-grid v-bind="$attrs" ref="gridRef">
          <template #default="{columnIndex, style, rowIndex}">
            <div class="${ITEM_KLS}" :style="style">item {{ rowIndex }} {{ columnIndex }}</div>
          </template>
        </fixed-size-grid>
      </render-pipeline-provider>
    `,
    components: {
      FixedSizeGrid,
      RenderPipelineProvider,
    },
  },
  {
    props: {
      className: WINDOW_KLS,
      columnWidth: 50,
      height: 100,
      rowHeight: 25,
      totalColumn: 100,
      totalRow: 100,
      width: 100,
      onItemRendered,
    },
  },
)

let cleanup: () => void

describe('<fixed-size-grid />', () => {
  beforeAll(() => {
    cleanup = setupMock()
  })

  afterAll(() => {
    cleanup()
  })

  describe('render testing', () => {
    it('should render correctly', async () => {
      const wrapper = mount()

      await nextTick()

      // 8 visible grid. 2 x 4
      //               total rows  total columns
      //                   |           |
      // 16 cached grid  (2 + 2) x (4 + 2) - (2 x 4)
      expect(wrapper.findAll(ITEM_SELECTOR)).toHaveLength(24)

      const gridRef = wrapper.vm.$refs.gridRef as GridRef
      expect(unref(gridRef.innerRef).style.height).toBe('2500px')
      expect(unref(gridRef.innerRef).style.width).toBe('5000px')
    })

    it('uses the global render pipeline budget when enabled', async () => {
      const wrapper = mountWithPipeline()

      await nextTick()

      const root = wrapper.find('.el-vl__wrapper')
      expect(root.attributes('data-fsus-render-pipeline')).toBe('virtual-grid')
      expect(root.attributes('data-fsus-render-strategy')).toBe('chunked-main')
      expect(root.attributes('data-fsus-render-hardware')).toMatch(
        /gpu-compositor|cpu-threaded/,
      )
      expect(root.attributes('data-fsus-compositor')).toMatch(
        /enabled|disabled/,
      )
      expect(root.attributes('data-fsus-render-column-cache')).toBe('3')
      expect(root.attributes('data-fsus-render-row-cache')).toBe('6')
      expect(wrapper.findAll(ITEM_SELECTOR)).toHaveLength(50)
    })

    it('should render zero row zero column', async () => {
      const wrapper = mount({
        props: {
          totalColumn: 0,
          totalRow: 0,
        },
      })

      await nextTick()
      expect(wrapper.findAll(ITEM_SELECTOR)).toHaveLength(0)
    })
  })

  describe('scroll testing', () => {
    it('should scroll correctly', async () => {
      const wrapper = mount()
      await nextTick()
      expect(wrapper.findAll(ITEM_SELECTOR)).toHaveLength(24)

      const gridRef = wrapper.vm.$refs.gridRef as GridRef

      makeScroll(unref(gridRef.windowRef), 'scrollTop', 100)
      await nextTick()
      expect(wrapper.findAll(ITEM_SELECTOR)).toHaveLength(21)

      makeScroll(unref(gridRef.windowRef), 'scrollLeft', 100)
      await nextTick()
      // 5 (backward cache 1 + visible 2 + forward cache 2)
      // * 7 (backward cache 1 + visible 4 + forward cache 2)
      // 35
      expect(wrapper.findAll(ITEM_SELECTOR)).toHaveLength(35)
    })

    it('should not scroll at all', async () => {
      const wrapper = mount()
      await nextTick()
      expect(wrapper.findAll(ITEM_SELECTOR)).toHaveLength(24)

      const gridRef = wrapper.vm.$refs.gridRef as GridRef
      makeScroll(unref(gridRef.windowRef), 'scrollTop', 0)
      await nextTick()
      expect(wrapper.findAll(ITEM_SELECTOR)).toHaveLength(24)

      makeScroll(unref(gridRef.windowRef), 'scrollLeft', 0)
      await nextTick()
      expect(wrapper.findAll(ITEM_SELECTOR)).toHaveLength(24)
    })

    it('should run scrollTo correctly', async () => {
      const wrapper = mount()
      await nextTick()
      expect(wrapper.findAll(ITEM_SELECTOR)).toHaveLength(24)

      const gridRef = wrapper.vm.$refs.gridRef as GridRef
      gridRef.scrollTo({
        scrollLeft: 100,
        scrollTop: 0,
      })
      await waitForScrollReset()
      // 4 (0 + 2 + 2) * 8 (2 + 4 + 2) grid
      expect(wrapper.findAll(ITEM_SELECTOR)).toHaveLength(36)

      gridRef.scrollTo({
        scrollLeft: 100,
        scrollTop: 100,
      })
      await waitForScrollReset()
      // 6 (2 + 2 + 2) * 8 (2 + 4 + 2) grid
      expect(wrapper.findAll(ITEM_SELECTOR)).toHaveLength(48)
      const prevFirstItem = wrapper.find(ITEM_SELECTOR)
      // should do nothing
      gridRef.scrollTo({
        scrollLeft: 100,
        scrollTop: 100,
      })

      await waitForScrollReset()
      expect(wrapper.findAll(ITEM_SELECTOR)).toHaveLength(48)
      expect(wrapper.find(ITEM_SELECTOR).element).toEqual(prevFirstItem.element)
    })

    it('should scrollToItem with correct alignment', async () => {
      const wrapper = mount()
      await nextTick()
      expect(wrapper.findAll(ITEM_SELECTOR)).toHaveLength(24)

      const gridRef = wrapper.vm.$refs.gridRef as GridRef
      // do nothing scroll
      gridRef.scrollToItem()
      await waitForScrollReset()
      expect(wrapper.findAll(ITEM_SELECTOR)).toHaveLength(24)

      // auto alignment
      gridRef.scrollToItem(10)
      await waitForScrollReset()
      // 8 x 4 grid
      expect(wrapper.findAll(ITEM_SELECTOR)).toHaveLength(32)

      gridRef.scrollToItem(10, 10)
      await waitForScrollReset()
      // 8 x 6 grid
      expect(wrapper.findAll(ITEM_SELECTOR)).toHaveLength(48)

      gridRef.scrollToItem(5, 5, SMART_ALIGNMENT)
      await waitForScrollReset()
      // 8 x 7 grid
      expect(wrapper.findAll(ITEM_SELECTOR)).toHaveLength(56)

      gridRef.scrollToItem(6, 6, SMART_ALIGNMENT)
      await waitForScrollReset()
      // 8 x 6 grid
      expect(wrapper.findAll(ITEM_SELECTOR)).toHaveLength(48)

      gridRef.scrollToItem(6, 6, START_ALIGNMENT)
      await waitForScrollReset()
      // 8 x 6 grid
      expect(wrapper.findAll(ITEM_SELECTOR)).toHaveLength(48)

      gridRef.scrollToItem(5, 5, CENTERED_ALIGNMENT)
      await waitForScrollReset()
      // 9 x 7 grid
      expect(wrapper.findAll(ITEM_SELECTOR)).toHaveLength(63)

      gridRef.scrollToItem(6, 6, CENTERED_ALIGNMENT)
      await waitForScrollReset()
      // 9 x 7 grid
      expect(wrapper.findAll(ITEM_SELECTOR)).toHaveLength(63)

      gridRef.scrollToItem(4, 4, END_ALIGNMENT)
      await waitForScrollReset()
      // 7 x 6 grid
      expect(wrapper.findAll(ITEM_SELECTOR)).toHaveLength(42)
    })
  })

  describe('error handling', () => {
    it('should throw when column-width is not number', () => {
      expect(() =>
        mount({
          props: {
            columnWidth: '1',
          },
          global: {
            config: {
              warnHandler() {
                // suppress warning
              },
            },
          },
        }),
      ).toThrow(/"columnWidth" must be passed as number/i)
    })

    it('should throw when row-height is not number', () => {
      expect(() =>
        mount({
          props: {
            rowHeight: '1',
          },
          global: {
            config: {
              warnHandler() {
                // suppress warning
              },
            },
          },
        }),
      ).toThrow(/"rowHeight" must be passed as number/i)
    })
  })
})

import { createSSRApp, defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { renderToString } from '@vue/server-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  useFsusVirtualWindow,
  type FsusVirtualWindowDiagnosticEvent,
} from '../use-render-pipeline'
import { FsusVirtualSizeIndex } from '../use-render-pipeline/virtual-window-index'

const afterFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

const setElementHeight = (element: HTMLElement, height: number) => {
  Object.defineProperty(element, 'offsetHeight', {
    configurable: true,
    value: height,
  })
}

describe('FsusVirtualSizeIndex', () => {
  it('updates and resolves 100K variable sizes without rebuilding metadata', () => {
    const values = Array.from(
      { length: 100_000 },
      (_, index) => 20 + (index % 5),
    )
    const index = new FsusVirtualSizeIndex(values)
    const rebuild = vi.spyOn(index, 'rebuild')
    const previousTotal = index.total

    expect(index.update(50_000, 80)).toBe(true)
    expect(rebuild).not.toHaveBeenCalled()
    expect(index.total).toBe(previousTotal + 60)
    expect(index.prefixSize(50_001) - index.prefixSize(50_000)).toBe(80)

    const offset = index.prefixSize(75_000)
    expect(index.findFirstEndAtLeast(offset)).toBe(74_999)
    expect(index.findFirstEndGreater(offset)).toBe(75_000)
  })

  it('supports incremental append and tail removal', () => {
    const index = new FsusVirtualSizeIndex([20, 30])
    index.append(40)
    expect(index.total).toBe(90)
    expect(index.prefixSize(2)).toBe(50)

    index.truncate(1)
    expect(index.count).toBe(1)
    expect(index.total).toBe(20)
  })
})

describe('useFsusVirtualWindow incremental measurements', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps the fixed-size path arithmetic-only', async () => {
    const observer = vi.fn()
    vi.stubGlobal('ResizeObserver', observer)
    const units = ref(
      Array.from({ length: 100_000 }, (_, index) => ({ key: `row-${index}` })),
    )
    const estimateSize = vi.fn(() => 40)
    let itemCount = 0
    let total = 0

    const Probe = defineComponent({
      setup() {
        const viewportRef = ref<HTMLElement | null>(null)
        const virtualWindow = useFsusVirtualWindow({
          estimateSize,
          getKey: (unit) => unit.key,
          getViewport: () => viewportRef.value,
          itemSize: 32,
          overscanPx: 0,
          units,
        })
        return () => {
          itemCount = virtualWindow.visibleItems.value.length
          total = virtualWindow.totalSize.value
          return h('div', { ref: viewportRef, style: 'height: 128px' })
        }
      },
    })

    const wrapper = mount(Probe)
    await nextTick()

    expect(total).toBe(3_200_000)
    expect(itemCount).toBeLessThan(100_000)
    expect(estimateSize).not.toHaveBeenCalled()
    expect(observer).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('uses one shared ResizeObserver for all mounted units', async () => {
    const instances: SharedObserver[] = []
    class SharedObserver implements ResizeObserver {
      readonly targets = new Set<Element>()

      constructor(readonly callback: ResizeObserverCallback) {
        instances.push(this)
      }

      disconnect() {
        this.targets.clear()
      }

      observe(target: Element) {
        this.targets.add(target)
      }

      unobserve(target: Element) {
        this.targets.delete(target)
      }
    }
    vi.stubGlobal('ResizeObserver', SharedObserver)
    const units = ref(
      Array.from({ length: 20 }, (_, index) => ({ key: `row-${index}` })),
    )

    const Probe = defineComponent({
      setup() {
        const virtualWindow = useFsusVirtualWindow({
          estimateSize: () => 40,
          getKey: (unit) => unit.key,
          getViewport: () => null,
          minVisibleItems: 4,
          overscanPx: 0,
          units,
        })
        return () =>
          h(
            'div',
            virtualWindow.visibleItems.value.map((item) =>
              h('div', {
                key: item.key,
                ref: (element) =>
                  virtualWindow.setUnitRef(item.key, element as Element),
              }),
            ),
          )
      },
    })

    const wrapper = mount(Probe)
    await nextTick()

    expect(instances).toHaveLength(1)
    expect(instances[0]?.targets.size).toBe(4)
    wrapper.unmount()
    expect(instances[0]?.targets.size).toBe(0)
  })

  it('preserves measured keys across append, delete, insert, and reorder', async () => {
    const units = ref(
      Array.from({ length: 6 }, (_, index) => ({ key: `row-${index}` })),
    )
    const diagnostics: FsusVirtualWindowDiagnosticEvent[] = []
    let virtualWindow: ReturnType<typeof useFsusVirtualWindow<{ key: string }>>

    const Probe = defineComponent({
      setup() {
        virtualWindow = useFsusVirtualWindow({
          estimateSize: () => 40,
          getKey: (unit) => unit.key,
          getViewport: () => null,
          minVisibleItems: 10,
          onDiagnostic: (event) => diagnostics.push(event),
          overscanPx: 0,
          units,
        })
        return () => h('div')
      },
    })

    const wrapper = mount(Probe)
    const measured = document.createElement('div')
    setElementHeight(measured, 72)
    virtualWindow!.setUnitRef('row-2', measured)
    await afterFrame()

    units.value = [...units.value, { key: 'row-6' }]
    expect(
      diagnostics.filter((event) => event.type === 'index-rebuild'),
    ).toHaveLength(0)

    units.value = units.value.slice(0, -1)
    expect(
      diagnostics.filter((event) => event.type === 'index-rebuild'),
    ).toHaveLength(0)

    units.value = [{ key: 'inserted' }, ...units.value]
    virtualWindow!.scrollOffset.value = 0
    expect(
      virtualWindow!.visibleItems.value.find((item) => item.key === 'row-2')
        ?.size,
    ).toBe(72)

    units.value = [...units.value].reverse()
    virtualWindow!.scrollOffset.value = 0
    expect(
      virtualWindow!.visibleItems.value.find((item) => item.key === 'row-2')
        ?.size,
    ).toBe(72)
    expect(
      diagnostics.filter((event) => event.type === 'index-rebuild'),
    ).toHaveLength(2)
    wrapper.unmount()
  })

  it('rejects duplicate keys deterministically', () => {
    const units = ref([{ key: 'duplicate' }, { key: 'duplicate' }])
    expect(() =>
      useFsusVirtualWindow({
        estimateSize: () => 40,
        getKey: (unit) => unit.key,
        getViewport: () => null,
        units,
      }),
    ).toThrow('useFsusVirtualWindow requires unique keys: duplicate')
  })

  it('applies one anchor correction for a measurement batch', async () => {
    const units = ref(
      Array.from({ length: 20 }, (_, index) => ({ key: `row-${index}` })),
    )
    const diagnostics: FsusVirtualWindowDiagnosticEvent[] = []
    let viewport: HTMLElement
    let virtualWindow: ReturnType<typeof useFsusVirtualWindow<{ key: string }>>

    const Probe = defineComponent({
      setup() {
        const viewportRef = ref<HTMLElement | null>(null)
        virtualWindow = useFsusVirtualWindow({
          estimateSize: () => 40,
          getKey: (unit) => unit.key,
          getViewport: () => viewportRef.value,
          measureBatch: 8,
          onDiagnostic: (event) => diagnostics.push(event),
          overscanPx: 0,
          units,
        })
        return () =>
          h('div', {
            ref: (element) => {
              if (!(element instanceof HTMLElement)) return
              viewportRef.value = element as HTMLElement
              viewport = element as HTMLElement
              Object.defineProperty(viewport, 'clientHeight', {
                configurable: true,
                value: 120,
              })
            },
          })
      },
    })

    const wrapper = mount(Probe)
    viewport!.scrollTop = 200
    virtualWindow!.readViewport()
    const first = document.createElement('div')
    const second = document.createElement('div')
    setElementHeight(first, 50)
    setElementHeight(second, 45)
    virtualWindow!.setUnitRef('row-0', first)
    virtualWindow!.setUnitRef('row-1', second)
    await afterFrame()

    expect(viewport!.scrollTop).toBe(215)
    expect(
      diagnostics.filter(
        (event) =>
          event.type === 'scroll-correction' && event.reason === 'measurement',
      ),
    ).toHaveLength(1)
    wrapper.unmount()
  })

  it('keeps the visible key anchored across consecutive insert and delete', () => {
    const original = Array.from({ length: 20 }, (_, index) => ({
      key: `row-${index}`,
    }))
    const units = ref(original)
    const viewport = document.createElement('div')
    Object.defineProperty(viewport, 'clientHeight', {
      configurable: true,
      value: 120,
    })
    viewport.scrollTop = 200
    let virtualWindow: ReturnType<typeof useFsusVirtualWindow<{ key: string }>>

    const Probe = defineComponent({
      setup() {
        virtualWindow = useFsusVirtualWindow({
          estimateSize: () => 40,
          getKey: (unit) => unit.key,
          getViewport: () => viewport,
          overscanPx: 0,
          units,
        })
        virtualWindow.readViewport()
        return () => h('div')
      },
    })

    const wrapper = mount(Probe)
    units.value = [{ key: 'insert-a' }, { key: 'insert-b' }, ...original]
    expect(viewport.scrollTop).toBe(280)
    expect(virtualWindow!.visibleItems.value[0]?.key).toBe('row-4')

    units.value = original
    expect(viewport.scrollTop).toBe(200)
    expect(virtualWindow!.visibleItems.value[0]?.key).toBe('row-4')
    wrapper.unmount()
  })

  it('keeps detached measurement history within the configured bound', async () => {
    const units = ref(
      Array.from({ length: 30 }, (_, index) => ({ key: `row-${index}` })),
    )
    const diagnostics: FsusVirtualWindowDiagnosticEvent[] = []
    let virtualWindow: ReturnType<typeof useFsusVirtualWindow<{ key: string }>>

    const Probe = defineComponent({
      setup() {
        virtualWindow = useFsusVirtualWindow({
          estimateSize: () => 40,
          getKey: (unit) => unit.key,
          getViewport: () => null,
          measurementCacheLimit: 3,
          onDiagnostic: (event) => diagnostics.push(event),
          units,
        })
        return () => h('div')
      },
    })

    const wrapper = mount(Probe)
    for (let index = 0; index < 12; index += 1) {
      const element = document.createElement('div')
      setElementHeight(element, 50 + index)
      virtualWindow!.setUnitRef(`row-${index}`, element)
      await afterFrame()
      virtualWindow!.setUnitRef(`row-${index}`, null)
    }

    const cacheEvents = diagnostics.filter(
      (event) => event.type === 'measurement-cache',
    )
    expect(cacheEvents.at(-1)?.cacheSize).toBeLessThanOrEqual(3)
    wrapper.unmount()
  })

  it('uses deterministic element measurements without ResizeObserver', async () => {
    vi.stubGlobal('ResizeObserver', undefined)
    const units = ref([{ key: 'row-0' }, { key: 'row-1' }])
    let virtualWindow: ReturnType<typeof useFsusVirtualWindow<{ key: string }>>

    const Probe = defineComponent({
      setup() {
        virtualWindow = useFsusVirtualWindow({
          estimateSize: () => 40,
          getKey: (unit) => unit.key,
          getViewport: () => null,
          minVisibleItems: 2,
          units,
        })
        return () => h('div')
      },
    })

    const wrapper = mount(Probe)
    const element = document.createElement('div')
    setElementHeight(element, 60)
    virtualWindow!.setUnitRef('row-0', element)
    await afterFrame()

    expect(virtualWindow!.totalSize.value).toBe(100)
    wrapper.unmount()
  })

  it('renders an estimated window during SSR without observers', async () => {
    const observer = vi.fn()
    vi.stubGlobal('ResizeObserver', observer)
    const units = ref(
      Array.from({ length: 12 }, (_, index) => ({ key: `row-${index}` })),
    )
    const Probe = defineComponent({
      setup() {
        const virtualWindow = useFsusVirtualWindow({
          estimateSize: () => 40,
          getKey: (unit) => unit.key,
          getViewport: () => null,
          minVisibleItems: 2,
          overscanPx: 0,
          units,
        })
        return () =>
          h(
            'div',
            virtualWindow.visibleItems.value.map((item) =>
              h('span', { 'data-row': item.key }, item.key),
            ),
          )
      },
    })

    const html = await renderToString(createSSRApp(Probe))

    expect(html).toContain('data-row="row-0"')
    expect(html).toContain('data-row="row-1"')
    expect(html).not.toContain('data-row="row-2"')
    expect(observer).not.toHaveBeenCalled()
  })

  it('reads a Window viewport without changing the public usage shape', async () => {
    const units = ref(
      Array.from({ length: 30 }, (_, index) => ({ key: `row-${index}` })),
    )
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 120,
    })
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 320,
    })
    let virtualWindow: ReturnType<typeof useFsusVirtualWindow<{ key: string }>>

    const Probe = defineComponent({
      setup() {
        virtualWindow = useFsusVirtualWindow({
          estimateSize: () => 40,
          getKey: (unit) => unit.key,
          getViewport: () => window,
          itemSize: 40,
          overscanPx: 0,
          units,
        })
        return () => h('div')
      },
    })

    const wrapper = mount(Probe)
    await nextTick()
    await nextTick()
    virtualWindow!.readViewport()

    expect(virtualWindow!.visibleItems.value[0]?.key).toBe('row-7')
    wrapper.unmount()
  })
})

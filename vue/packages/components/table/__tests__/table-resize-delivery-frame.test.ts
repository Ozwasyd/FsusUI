import { nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ElTable from '../src/table.vue'
import ElTableColumn from '../src/table-column'
import { mount } from './table-test-common'

const { observations } = vi.hoisted(() => ({
  observations: [] as {
    target: unknown
    callback: ResizeObserverCallback
    stop: ReturnType<typeof vi.fn>
  }[],
}))

vi.mock('@element-plus/hooks/use-runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@element-plus/hooks/use-runtime')>()),
  useResizeObserver: (target: unknown, callback: ResizeObserverCallback) => {
    const stop = vi.fn()
    observations.push({ target, callback, stop })
    return { isSupported: ref(true), stop }
  },
}))

describe('ordinary Table resize delivery frame', () => {
  let frames: Map<number, FrameRequestCallback>
  let frameId: number

  beforeEach(() => {
    observations.length = 0
    frames = new Map()
    frameId = 0
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++frameId, callback)
      return frameId
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  })

  afterEach(() => vi.unstubAllGlobals())

  const flushFrame = async () => {
    const callbacks = [...frames.values()]
    frames.clear()
    callbacks.forEach((callback) => callback(performance.now()))
    await nextTick()
    await nextTick()
  }

  const createTable = async (props = '') => {
    const wrapper = mount({
      components: { ElTable, ElTableColumn },
      template: `<div><el-table :data="[{ name: 'row' }]" ${props}>
        <el-table-column prop="name" min-width="120" fixed />
        <el-table-column prop="name" min-width="120" />
      </el-table></div>`,
    })
    await nextTick()
    await nextTick()
    const table = wrapper.findComponent(ElTable)
    const root = table.element as HTMLElement
    let width = 600
    let height = 260
    let headerHeight = 40
    const readWidth = vi.fn(() => width)
    Object.defineProperties(root, {
      offsetWidth: { configurable: true, get: readWidth },
      clientWidth: { configurable: true, get: () => width },
      offsetHeight: { configurable: true, get: () => height },
    })
    Object.defineProperty(
      table.vm.layout.table.refs.headerWrapper,
      'offsetHeight',
      {
        configurable: true,
        get: () => headerHeight,
      },
    )
    const rootObserver = observations.find((item) => item.target === root)
    const bodyObserver = observations.find(
      (item) => item.target === table.vm.layout.table.refs.bodyWrapper,
    )!
    const deliver = (observer = bodyObserver) =>
      observer.callback([], {} as ResizeObserver)
    deliver()
    await flushFrame()
    await flushFrame()
    return {
      wrapper,
      table,
      root,
      rootObserver,
      bodyObserver,
      deliver,
      readWidth,
      resize: (
        nextWidth: number,
        nextHeight = height,
        nextHeader = headerHeight,
      ) => {
        width = nextWidth
        height = nextHeight
        headerHeight = nextHeader
      },
    }
  }

  it('coalesces root/body notifications and defers reads, column writes and scrollbar updates', async () => {
    const ctx = await createTable()
    const updateColumns = vi.spyOn(ctx.table.vm.layout, 'updateColumnsWidth')
    const updateScrollbar = vi.spyOn(
      ctx.table.vm.layout.table.refs.scrollBarRef,
      'update',
    )
    const scheduleLayout = vi.spyOn(ctx.table.vm.store, 'scheduleLayout')
    ctx.readWidth.mockClear()
    ctx.resize(342)
    ctx.deliver(ctx.rootObserver)
    ctx.deliver()
    ctx.deliver(ctx.rootObserver)
    await nextTick()
    expect(ctx.readWidth).not.toHaveBeenCalled()
    expect(updateColumns).not.toHaveBeenCalled()
    expect(updateScrollbar).not.toHaveBeenCalled()
    expect(scheduleLayout).not.toHaveBeenCalled()

    await flushFrame()
    expect(updateColumns).toHaveBeenCalledTimes(1)
    expect(updateScrollbar).toHaveBeenCalledTimes(1)
    expect(scheduleLayout).toHaveBeenCalledWith(false, true, 'container-resize')
    expect(
      ctx.table.vm.layout.getFlattenColumns().map((column) => column.realWidth),
    ).toEqual([171, 171])
    expect(ctx.table.vm.resizeState.width).toBe(342)
    ctx.wrapper.unmount()
  })

  it('keeps measured container width during overflow and continues width, height and fixed-column updates', async () => {
    const ctx = await createTable('height="260" flexible')
    const updateHeight = vi.spyOn(ctx.table.vm.layout, 'updateElsHeight')
    const updateColumns = vi.spyOn(ctx.table.vm.layout, 'updateColumnsWidth')
    expect(ctx.root.parentElement!.style.minWidth).toBe('0px')
    for (const width of [180, 600, 180, 600, 180, 600]) {
      ctx.resize(width)
      ctx.deliver(ctx.rootObserver)
      await flushFrame()
      const columnWidth = Math.max(120, width / 2)
      expect(ctx.table.vm.layout.bodyWidth.value).toBe(Math.max(240, width))
      expect(ctx.table.vm.resizeState.width).toBe(width)
      expect(ctx.table.vm.layout.fixedWidth.value).toBe(columnWidth)
      expect(ctx.table.vm.layout.scrollX.value).toBe(width < 240)
      const calls = updateColumns.mock.calls.length
      ctx.deliver()
      await flushFrame()
      expect(updateColumns).toHaveBeenCalledTimes(calls)
    }
    updateHeight.mockClear()
    ctx.resize(600, 300, 60)
    ctx.deliver(ctx.rootObserver)
    await flushFrame()
    expect(updateHeight).toHaveBeenCalledTimes(1)
    expect(ctx.table.vm.resizeState.height).toBe(300)
    expect(ctx.table.vm.resizeState.headerHeight).toBe(60)
    ctx.wrapper.unmount()
  })

  it('retains fit=false window resizing and body delivery', async () => {
    const ctx = await createTable(':fit="false"')
    expect(ctx.rootObserver).toBeUndefined()
    ctx.resize(180)
    window.dispatchEvent(new Event('resize'))
    await nextTick()
    expect(ctx.table.vm.layout.bodyWidth.value).toBe(240)
    expect(ctx.table.vm.layout.scrollX.value).toBe(true)
    ctx.resize(600)
    ctx.deliver()
    await flushFrame()
    expect(ctx.table.vm.layout.scrollX.value).toBe(false)
    ctx.wrapper.unmount()
  })

  it('stops its observers/listeners and cancels pending resize work on unmount', async () => {
    const ctx = await createTable()
    const updateColumns = vi.spyOn(ctx.table.vm.layout, 'updateColumnsWidth')
    const updateScrollbar = vi.spyOn(
      ctx.table.vm.layout.table.refs.scrollBarRef,
      'update',
    )
    ctx.resize(342)
    ctx.deliver(ctx.rootObserver)
    ctx.deliver()
    ctx.wrapper.unmount()
    expect(ctx.rootObserver!.stop).toHaveBeenCalledTimes(1)
    expect(ctx.bodyObserver.stop).toHaveBeenCalledTimes(1)
    await flushFrame()
    ctx.deliver()
    window.dispatchEvent(new Event('resize'))
    await flushFrame()
    expect(updateColumns).not.toHaveBeenCalled()
    expect(updateScrollbar).not.toHaveBeenCalled()
  })
})

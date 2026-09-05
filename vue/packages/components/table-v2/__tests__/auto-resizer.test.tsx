import { h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AutoResizer from '../src/components/auto-resizer'

describe('AutoResizer', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports observed dimensions and preserves disabled axes', async () => {
    let callback: ResizeObserverCallback | undefined
    const observer = {
      disconnect: vi.fn(),
      observe: vi.fn(),
      unobserve: vi.fn(),
    } as unknown as ResizeObserver
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(next: ResizeObserverCallback) {
          callback = next
        }
        disconnect = observer.disconnect
        observe = observer.observe
        unobserve = observer.unobserve
      },
    )
    const onResize = vi.fn()
    const wrapper = mount(AutoResizer, {
      props: { disableWidth: true, onResize },
      slots: {
        default: ({ width, height }: { width: number; height: number }) =>
          h('span', { class: 'size' }, `${width}x${height}`),
      },
    })
    const target = wrapper.find('.el-auto-resizer').element

    callback?.(
      [{ target, contentRect: { width: 320, height: 180 } } as ResizeObserverEntry],
      observer,
    )
    await nextTick()

    expect(wrapper.find('.size').text()).toBe('0x180')
    expect(onResize).toHaveBeenLastCalledWith({ width: 0, height: 180 })

    await wrapper.setProps({ disableWidth: false, disableHeight: true })
    callback?.(
      [{ target, contentRect: { width: 640, height: 360 } } as ResizeObserverEntry],
      observer,
    )
    await nextTick()

    expect(wrapper.find('.size').text()).toBe('640x180')
    expect(onResize).toHaveBeenLastCalledWith({ width: 640, height: 180 })
  })
})

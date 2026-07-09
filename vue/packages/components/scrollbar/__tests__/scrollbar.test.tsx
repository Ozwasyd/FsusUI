import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, test, vi } from 'vitest'
import makeScroll from '@element-plus/test-utils/make-scroll'
import defineGetter from '@element-plus/test-utils/define-getter'
import { rAF } from '@element-plus/test-utils/tick'
import Scrollbar from '../src/scrollbar.vue'

const rect = (overrides: Partial<DOMRect> = {}) =>
  ({
    x: 0,
    y: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: 0,
    height: 0,
    toJSON: () => ({}),
    ...overrides,
  }) as DOMRect

const createPointerEvent = (
  type: string,
  init: PointerEventInit & { pointerType?: string } = {},
) => {
  const event =
    typeof PointerEvent === 'function'
      ? new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          button: 0,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
          ...init,
        })
      : new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX: init.clientX,
          clientY: init.clientY,
        })

  Object.defineProperties(event, {
    pointerId: {
      configurable: true,
      value: init.pointerId ?? 1,
    },
    pointerType: {
      configurable: true,
      value: init.pointerType ?? 'mouse',
    },
    isPrimary: {
      configurable: true,
      value: init.isPrimary ?? true,
    },
  })

  return event as PointerEvent
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ScrollBar', () => {
  test('vertical', async () => {
    const outerHeight = 204
    const innerHeight = 500
    const wrapper = mount(() => (
      <Scrollbar style={`height: ${outerHeight}px;`}>
        <div style={`height: ${innerHeight}px;`}></div>
      </Scrollbar>
    ))

    const scrollDom = wrapper.find('.el-scrollbar__wrap').element

    const offsetHeightRestore = defineGetter(
      scrollDom,
      'offsetHeight',
      outerHeight,
    )
    const scrollHeightRestore = defineGetter(
      scrollDom,
      'scrollHeight',
      innerHeight,
    )

    await makeScroll(scrollDom, 'scrollTop', 100)
    expect(wrapper.find('.is-vertical div').attributes('style')).toContain(
      'height: 70.688px; transform: translateY(53.191489361702125%);',
    )
    await makeScroll(scrollDom, 'scrollTop', 300)
    expect(wrapper.find('.is-vertical div').attributes('style')).toContain(
      'height: 70.688px; transform: translateY(159.5744680851064%);',
    )
    offsetHeightRestore()
    scrollHeightRestore()
  })

  test('horizontal', async () => {
    const outerWidth = 204
    const innerWidth = 500
    const wrapper = mount(() => (
      <Scrollbar style={`height: 100px; width: ${outerWidth}px;`}>
        <div style={`height: 100px; width: ${innerWidth}px;`}></div>
      </Scrollbar>
    ))

    const scrollDom = wrapper.find('.el-scrollbar__wrap').element

    const offsetWidthRestore = defineGetter(
      scrollDom,
      'offsetWidth',
      outerWidth,
    )
    const scrollWidthRestore = defineGetter(
      scrollDom,
      'scrollWidth',
      innerWidth,
    )

    await makeScroll(scrollDom, 'scrollLeft', 100)
    expect(wrapper.find('.is-horizontal div').attributes('style')).toContain(
      'width: 70.688px; transform: translateX(53.191489361702125%);',
    )
    await makeScroll(scrollDom, 'scrollLeft', 300)
    expect(wrapper.find('.is-horizontal div').attributes('style')).toContain(
      'width: 70.688px; transform: translateX(159.5744680851064%);',
    )
    offsetWidthRestore()
    scrollWidthRestore()
  })

  test('both vertical and horizontal', async () => {
    const outerHeight = 204
    const innerHeight = 500
    const outerWidth = 204
    const innerWidth = 500
    const wrapper = mount(() => (
      <Scrollbar style={`height: ${outerHeight}px; width: ${outerWidth}px;`}>
        <div style={`height: ${innerHeight}px; width: ${innerWidth}px;`}></div>
      </Scrollbar>
    ))

    const scrollDom = wrapper.find('.el-scrollbar__wrap').element

    const offsetHeightRestore = defineGetter(
      scrollDom,
      'offsetHeight',
      outerHeight,
    )
    const scrollHeightRestore = defineGetter(
      scrollDom,
      'scrollHeight',
      innerHeight,
    )
    const offsetWidthRestore = defineGetter(
      scrollDom,
      'offsetWidth',
      outerWidth,
    )
    const scrollWidthRestore = defineGetter(
      scrollDom,
      'scrollWidth',
      innerWidth,
    )

    await makeScroll(scrollDom, 'scrollTop', 100)
    await makeScroll(scrollDom, 'scrollLeft', 100)
    expect(wrapper.find('.is-vertical div').attributes('style')).toContain(
      'height: 70.688px; transform: translateY(53.191489361702125%);',
    )
    expect(wrapper.find('.is-horizontal div').attributes('style')).toContain(
      'width: 70.688px; transform: translateX(53.191489361702125%);',
    )
    await makeScroll(scrollDom, 'scrollTop', 300)
    await makeScroll(scrollDom, 'scrollLeft', 300)
    expect(wrapper.find('.is-vertical div').attributes('style')).toContain(
      'height: 70.688px; transform: translateY(159.5744680851064%);',
    )
    expect(wrapper.find('.is-horizontal div').attributes('style')).toContain(
      'width: 70.688px; transform: translateX(159.5744680851064%);',
    )

    offsetHeightRestore()
    scrollHeightRestore()
    offsetWidthRestore()
    scrollWidthRestore()
  })

  test('should render height props', async () => {
    const outerHeight = 204
    const innerHeight = 500
    const wrapper = mount(() => (
      <Scrollbar height={`${outerHeight}px`}>
        <div style={`height: ${innerHeight}px;`}></div>
      </Scrollbar>
    ))

    expect(wrapper.find('.el-scrollbar__wrap').attributes('style')).toContain(
      'height: 204px;',
    )
  })

  test('should render max-height props', async () => {
    const outerHeight = 204
    const innerHeight = 100
    const wrapper = mount(() => (
      <Scrollbar max-height={`${outerHeight}px`}>
        <div style={`height: ${innerHeight}px;`}></div>
      </Scrollbar>
    ))

    expect(wrapper.find('.el-scrollbar__wrap').attributes('style')).toContain(
      'max-height: 204px;',
    )
  })

  test('should render always props', async () => {
    const outerHeight = 204
    const innerHeight = 500
    const wrapper = mount(() => (
      <Scrollbar height={`${outerHeight}px`} always>
        <div style={`height: ${innerHeight}px;`}></div>
      </Scrollbar>
    ))

    expect(wrapper.find('.el-scrollbar__bar').attributes('style')).toBeFalsy()
  })

  test('set scrollTop & scrollLeft', async () => {
    const outerHeight = 204
    const innerHeight = 500
    const outerWidth = 204
    const innerWidth = 500
    const wrapper = mount({
      setup() {
        return () => (
          <Scrollbar
            ref="scrollbar"
            style={`height: ${outerHeight}px; width: ${outerWidth}px;`}
            always
          >
            <div
              style={`height: ${innerHeight}px; width: ${innerWidth}px;`}
            ></div>
          </Scrollbar>
        )
      },
    })

    const scrollbar = wrapper.findComponent({ ref: 'scrollbar' }).vm
    const scrollDom = wrapper.find('.el-scrollbar__wrap').element

    const offsetHeightRestore = defineGetter(
      scrollDom,
      'offsetHeight',
      outerHeight,
    )
    const scrollHeightRestore = defineGetter(
      scrollDom,
      'scrollHeight',
      innerHeight,
    )
    const offsetWidthRestore = defineGetter(
      scrollDom,
      'offsetWidth',
      outerWidth,
    )
    const scrollWidthRestore = defineGetter(
      scrollDom,
      'scrollWidth',
      innerWidth,
    )

    scrollbar.setScrollTop(100)
    await nextTick()
    scrollbar.setScrollLeft(100)
    await nextTick()
    expect(wrapper.find('.is-vertical div').attributes('style')).toContain(
      'height: 70.688px; transform: translateY(0%);',
    )
    expect(wrapper.find('.is-horizontal div').attributes('style')).toContain(
      'width: 70.688px; transform: translateX(0%);',
    )

    offsetHeightRestore()
    scrollHeightRestore()
    offsetWidthRestore()
    scrollWidthRestore()
  })

  test('should render min-size props', async () => {
    const outerHeight = 204
    const innerHeight = 10000
    const wrapper = mount(() => (
      <Scrollbar style={`height: ${outerHeight}px;`}>
        <div style={`height: ${innerHeight}px;`}></div>
      </Scrollbar>
    ))

    const scrollDom = wrapper.find('.el-scrollbar__wrap').element

    const offsetHeightRestore = defineGetter(
      scrollDom,
      'offsetHeight',
      outerHeight,
    )
    const scrollHeightRestore = defineGetter(
      scrollDom,
      'scrollHeight',
      innerHeight,
    )

    await makeScroll(scrollDom, 'scrollTop', 0)
    expect(wrapper.find('.is-vertical div').attributes('style')).toContain(
      'height: 20px; transform: translateY(0%);',
    )
    offsetHeightRestore()
    scrollHeightRestore()
  })

  test('should render tag props', async () => {
    const wrapper = mount(() => (
      <Scrollbar tag="ul">
        {[1, 2, 3].map((item) => (
          <li>{item}</li>
        ))}
      </Scrollbar>
    ))

    expect(
      wrapper.find('.el-scrollbar__view').element instanceof HTMLUListElement,
    ).toBeTruthy()
  })

  test('should render wrap-style props', async () => {
    const wrapStyle = 'background: red;'
    const wrapper = mount(() => <Scrollbar wrap-style={wrapStyle} />)

    expect(wrapper.find('.el-scrollbar__wrap').attributes('style')).toContain(
      wrapStyle,
    )
  })

  test('should render wrap-class props', async () => {
    const wrapClass = 'test-wrap-class'
    const wrapper = mount(() => <Scrollbar wrap-class={wrapClass} />)

    expect(wrapper.find('.el-scrollbar__wrap').classes()).toContain(wrapClass)
  })

  test('should render view-style props', async () => {
    const viewStyle = 'display: inline-block;'
    const wrapper = mount(() => <Scrollbar view-style={viewStyle} />)

    expect(wrapper.find('.el-scrollbar__view').attributes('style')).toContain(
      viewStyle,
    )
  })

  test('should render view-class props', async () => {
    const viewClass = 'test-view-class'
    const wrapper = mount(() => <Scrollbar view-class={viewClass} />)

    expect(wrapper.find('.el-scrollbar__view').classes()).toContain(viewClass)
  })

  test('should cleanup document listeners when thumb unmounts during drag', async () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')

    const wrapper = mount(() => (
      <Scrollbar style="height: 200px;" always>
        <div style="height: 500px;"></div>
      </Scrollbar>
    ))

    await nextTick()
    wrapper
      .find('.el-scrollbar__thumb')
      .element.dispatchEvent(createPointerEvent('pointerdown', { clientY: 10 }))

    wrapper.unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'pointermove',
      expect.any(Function),
    )
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'pointerup',
      expect.any(Function),
    )
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'pointercancel',
      expect.any(Function),
    )
  })

  test('should render opt-in overscroll containment class', () => {
    const wrapper = mount(() => <Scrollbar overscroll="contain" />)

    expect(wrapper.find('.el-scrollbar').classes()).toContain(
      'el-scrollbar--contain-overscroll',
    )
  })

  for (const pointerType of ['mouse', 'touch'] as const) {
    test(`should drag vertical thumb with ${pointerType} pointer from a zero edge offset`, async () => {
      const outerHeight = 204
      const innerHeight = 1000
      const wrapper = mount(() => (
        <Scrollbar style={`height: ${outerHeight}px;`} always>
          <div style={`height: ${innerHeight}px;`}></div>
        </Scrollbar>
      ))
      const scrollDom = wrapper.find('.el-scrollbar__wrap')
        .element as HTMLElement
      const track = wrapper.find('.el-scrollbar__bar.is-vertical')
        .element as HTMLDivElement
      const thumb = wrapper.find(
        '.el-scrollbar__bar.is-vertical .el-scrollbar__thumb',
      ).element as HTMLDivElement

      const offsetHeightRestore = defineGetter(
        scrollDom,
        'offsetHeight',
        outerHeight,
      )
      const clientHeightRestore = defineGetter(
        scrollDom,
        'clientHeight',
        outerHeight,
      )
      const scrollHeightRestore = defineGetter(
        scrollDom,
        'scrollHeight',
        innerHeight,
      )
      const trackHeightRestore = defineGetter(track, 'offsetHeight', 196)
      const thumbHeightRestore = defineGetter(thumb, 'offsetHeight', 40)
      vi.spyOn(track, 'getBoundingClientRect').mockReturnValue(
        rect({ top: 0, bottom: 196, height: 196 }),
      )
      vi.spyOn(thumb, 'getBoundingClientRect').mockReturnValue(
        rect({ top: 0, bottom: 40, height: 40 }),
      )
      const setPointerCapture = vi.fn()
      const releasePointerCapture = vi.fn()
      Object.defineProperties(thumb, {
        setPointerCapture: {
          configurable: true,
          value: setPointerCapture,
        },
        releasePointerCapture: {
          configurable: true,
          value: releasePointerCapture,
        },
      })

      await makeScroll(scrollDom, 'scrollTop', 0)
      thumb.dispatchEvent(
        createPointerEvent('pointerdown', {
          clientY: 40,
          pointerId: 7,
          pointerType,
        }),
      )
      document.dispatchEvent(
        createPointerEvent('pointermove', {
          clientY: 84,
          pointerId: 7,
          pointerType,
        }),
      )

      await rAF()

      expect(scrollDom.scrollTop).toBeGreaterThan(0)
      expect(wrapper.find('.el-scrollbar').classes()).toContain(
        'is-thumb-dragging',
      )

      document.dispatchEvent(
        createPointerEvent('pointerup', {
          clientY: 84,
          pointerId: 7,
          pointerType,
        }),
      )
      await rAF()

      expect(wrapper.find('.el-scrollbar').classes()).not.toContain(
        'is-thumb-dragging',
      )
      expect(setPointerCapture).toHaveBeenCalledWith(7)
      expect(releasePointerCapture).toHaveBeenCalledWith(7)

      offsetHeightRestore()
      clientHeightRestore()
      scrollHeightRestore()
      trackHeightRestore()
      thumbHeightRestore()
    })
  }

  test('should cleanup pointer drag state on pointercancel', async () => {
    const wrapper = mount(() => (
      <Scrollbar style="height: 204px;" always>
        <div style="height: 1000px;"></div>
      </Scrollbar>
    ))
    const scrollDom = wrapper.find('.el-scrollbar__wrap').element as HTMLElement
    const track = wrapper.find('.el-scrollbar__bar.is-vertical')
      .element as HTMLDivElement
    const thumb = wrapper.find(
      '.el-scrollbar__bar.is-vertical .el-scrollbar__thumb',
    ).element as HTMLDivElement

    const offsetHeightRestore = defineGetter(scrollDom, 'offsetHeight', 204)
    const clientHeightRestore = defineGetter(scrollDom, 'clientHeight', 204)
    const scrollHeightRestore = defineGetter(scrollDom, 'scrollHeight', 1000)
    const trackHeightRestore = defineGetter(track, 'offsetHeight', 196)
    const thumbHeightRestore = defineGetter(thumb, 'offsetHeight', 40)
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue(
      rect({ top: 0, bottom: 196, height: 196 }),
    )
    vi.spyOn(thumb, 'getBoundingClientRect').mockReturnValue(
      rect({ top: 0, bottom: 40, height: 40 }),
    )

    await makeScroll(scrollDom, 'scrollTop', 0)
    thumb.dispatchEvent(
      createPointerEvent('pointerdown', {
        clientY: 20,
        pointerId: 12,
        pointerType: 'touch',
      }),
    )
    expect(wrapper.find('.el-scrollbar').classes()).toContain(
      'is-thumb-dragging',
    )

    document.dispatchEvent(
      createPointerEvent('pointercancel', {
        clientY: 20,
        pointerId: 12,
        pointerType: 'touch',
      }),
    )
    await rAF()

    expect(wrapper.find('.el-scrollbar').classes()).not.toContain(
      'is-thumb-dragging',
    )

    offsetHeightRestore()
    clientHeightRestore()
    scrollHeightRestore()
    trackHeightRestore()
    thumbHeightRestore()
  })

  test('should not trigger motion classes for silent programmatic scroll', async () => {
    const outerHeight = 204
    const innerHeight = 500
    const wrapper = mount(() => (
      <Scrollbar style={`height: ${outerHeight}px;`}>
        <div style={`height: ${innerHeight}px;`}></div>
      </Scrollbar>
    ))
    const scrollDom = wrapper.find('.el-scrollbar__wrap').element as HTMLElement

    const offsetHeightRestore = defineGetter(
      scrollDom,
      'offsetHeight',
      outerHeight,
    )
    const scrollHeightRestore = defineGetter(
      scrollDom,
      'scrollHeight',
      innerHeight,
    )

    scrollDom.dataset.fsusSilentScroll = 'true'
    await makeScroll(scrollDom, 'scrollTop', 160)

    expect(wrapper.find('.el-scrollbar').classes()).not.toContain(
      'is-scrolling-y-forward',
    )
    expect(wrapper.find('.el-scrollbar').classes()).not.toContain(
      'is-scrolling-y-backward',
    )
    expect(wrapper.find('.is-vertical div').attributes('style')).toContain(
      'transform: translateY(85.1063829787234%);',
    )

    offsetHeightRestore()
    scrollHeightRestore()
  })

  test('smooths notched mouse wheel distance', async () => {
    const outerHeight = 204
    const innerHeight = 1000
    const wrapper = mount(() => (
      <Scrollbar style={`height: ${outerHeight}px;`}>
        <div style={`height: ${innerHeight}px;`}></div>
      </Scrollbar>
    ))
    const scrollDom = wrapper.find('.el-scrollbar__wrap').element as HTMLElement

    const clientHeightRestore = defineGetter(
      scrollDom,
      'clientHeight',
      outerHeight,
    )
    const scrollHeightRestore = defineGetter(
      scrollDom,
      'scrollHeight',
      innerHeight,
    )

    const prevented = !scrollDom.dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaY: 120,
      }),
    )

    expect(prevented).toBe(true)
    expect(scrollDom.scrollTop).toBe(0)
    await rAF()
    expect(scrollDom.scrollTop).toBeGreaterThan(0)
    expect(scrollDom.scrollTop).toBeLessThan(56)

    for (let i = 0; i < 12; i++) {
      await rAF()
    }
    expect(scrollDom.scrollTop).toBeCloseTo(56, 0)

    const trackpadPrevented = !scrollDom.dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaY: 18,
      }),
    )

    expect(trackpadPrevented).toBe(false)
    expect(scrollDom.scrollTop).toBeCloseTo(56, 0)

    clientHeightRestore()
    scrollHeightRestore()
  })
})

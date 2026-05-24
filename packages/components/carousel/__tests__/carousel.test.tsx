import { nextTick, reactive } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clickActionButton } from '../../../test-utils/dom'
import Carousel from '../src/carousel.vue'
import CarouselItem from '../src/carousel-item.vue'

import type { VueWrapper } from '@vue/test-utils'
import type { CarouselInstance } from '../src/instance'

const wait = (ms = 100) =>
  new Promise((resolve) => setTimeout(() => resolve(0), ms))

const waitForActiveItem = async (
  wrapper: VueWrapper<any>,
  index: number,
  timeout = 300
) => {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeout) {
    await nextTick()
    await wait(10)
    const items = wrapper.vm.$el.querySelectorAll('.el-carousel__item')
    if (items[index]?.classList.contains('is-active')) {
      return items
    }
  }

  return wrapper.vm.$el.querySelectorAll('.el-carousel__item')
}

const generateCarouselItems = (count = 3, hasLabel = false) => {
  const list = Array.from({ length: count }, (_, index) => index + 1)
  return list.map((i) =>
    hasLabel ? <CarouselItem key={i} label={i} /> : <CarouselItem key={i} />
  )
}

describe('Carousel', () => {
  let wrapper: VueWrapper<any>

  const createComponent = (
    props: any = {},
    count?: number,
    hasLabel?: boolean
  ) => {
    return mount({
      setup() {
        return () => (
          <div>
            <Carousel {...props}>
              {generateCarouselItems(count, hasLabel)}
            </Carousel>
          </div>
        )
      },
    })
  }

  afterEach(() => {
    wrapper.unmount()
    delete document.documentElement.dataset.fsusMotion
  })

  it('create', () => {
    wrapper = createComponent({
      ref: 'carousel',
    })

    const carousel = wrapper.findComponent({ ref: 'carousel' })
      .vm as CarouselInstance
    expect(carousel.direction).toBe('horizontal')
    expect(wrapper.findAll('.el-carousel__item').length).toEqual(3)
  })

  it('auto play', async () => {
    wrapper = createComponent({
      interval: 50,
    })

    const items = await waitForActiveItem(wrapper, 0)
    expect(items[0].classList.contains('is-active')).toBeTruthy()
    await waitForActiveItem(wrapper, 1, 500)
    expect(items[1].classList.contains('is-active')).toBeTruthy()
  })

  it('initial index', async () => {
    wrapper = createComponent({
      autoplay: false,
      'initial-index': 1,
    })

    await nextTick()
    await wait(10)

    expect(
      wrapper.vm.$el
        .querySelectorAll('.el-carousel__item')[1]
        .classList.contains('is-active')
    ).toBeTruthy()
  })

  it('reset timer', async () => {
    wrapper = createComponent({
      interval: 500,
    })
    await nextTick()
    const items = wrapper.vm.$el.querySelectorAll('.el-carousel__item')
    await wrapper.trigger('mouseenter')
    await nextTick()
    expect(items[0].classList.contains('is-active')).toBeTruthy()
    await wrapper.trigger('mouseleave')
    await nextTick()
    await wait(700)
    expect(items[1].classList.contains('is-active')).toBeTruthy()
  })

  it('change', async () => {
    const state = reactive({
      val: -1,
      oldVal: -1,
    })

    wrapper = createComponent({
      onChange(val: number, prevVal: number) {
        state.val = val
        state.oldVal = prevVal
      },
      interval: 50,
    })

    await nextTick()
    await wait(50)
    expect(state.val).toBe(1)
    expect(state.oldVal).toBe(0)
  })

  it('label', async () => {
    wrapper = createComponent(undefined, 3, true)
    await nextTick()
    expect(wrapper.find('.el-carousel__button').text()).toBe('1')
  })

  describe('manual control', () => {
    it('hover', async () => {
      wrapper = createComponent({
        autoplay: false,
      })

      await nextTick()
      await wait()
      await wrapper.findAll('.el-carousel__indicator')[1].trigger('mouseenter')
      await nextTick()
      await wait()
      expect(
        wrapper.vm.$el
          .querySelectorAll('.el-carousel__item')[1]
          .classList.contains('is-active')
      ).toBeTruthy()
    })
  })

  it('card', async () => {
    wrapper = createComponent(
      {
        autoplay: false,
        type: 'card',
      },
      7
    )

    await nextTick()
    await wait()
    const items = wrapper.vm.$el.querySelectorAll('.el-carousel__item')
    expect(items[0].classList.contains('is-active')).toBeTruthy()
    expect(items[1].classList.contains('is-in-stage')).toBeTruthy()
    expect(items[6].classList.contains('is-in-stage')).toBeTruthy()
    await clickActionButton(items[1] as HTMLElement)
    await wait()
    expect(items[1].classList.contains('is-active')).toBeTruthy()
    await clickActionButton(
      wrapper.vm.$el.querySelector('.el-carousel__arrow--left') as HTMLElement
    )
    await wait()
    expect(items[0].classList.contains('is-active')).toBeTruthy()
    await clickActionButton(items[6] as HTMLElement)
    await wait()
    expect(items[6].classList.contains('is-active')).toBeTruthy()
  })

  it('vertical direction', () => {
    wrapper = createComponent({
      ref: 'carousel',
      autoplay: false,
      direction: 'vertical',
      height: '100px',
    })
    const items = wrapper.vm.$el.querySelectorAll('.el-carousel__item')
    const carousel = wrapper.findComponent({ ref: 'carousel' })
      .vm as CarouselInstance
    expect(carousel.direction).toBe('vertical')
    expect(items[0].style.transform.includes('translateY')).toBeTruthy()
  })

  it('pause auto play on hover', async () => {
    wrapper = createComponent({
      interval: 100,
      'pause-on-hover': false,
    })

    await waitForActiveItem(wrapper, 0, 500)
    await wrapper.find('.el-carousel').trigger('mouseenter')
    const items = await waitForActiveItem(wrapper, 1, 1200)
    expect(items[1].classList.contains('is-active')).toBeTruthy()
  })
  it('uses drag threshold to settle to the next item', async () => {
    document.documentElement.dataset.fsusMotion = 'disabled'
    wrapper = createComponent(
      {
        autoplay: false,
      },
      3
    )

    await waitForActiveItem(wrapper, 0)

    const carousel = wrapper.find<HTMLElement>('.el-carousel')
    vi.spyOn(carousel.element, 'offsetWidth', 'get').mockImplementation(() => 300)

    const createPointerEvent = (type: string, clientX: number) => {
      const event = new MouseEvent(type, {
        bubbles: true,
        button: 0,
        cancelable: true,
        clientX,
        clientY: 10,
      }) as PointerEvent
      Object.defineProperty(event, 'pointerId', {
        configurable: true,
        value: 1,
      })
      return event
    }

    carousel.element.dispatchEvent(createPointerEvent('pointerdown', 220))
    carousel.element.dispatchEvent(createPointerEvent('pointermove', 120))
    await nextTick()

    expect(carousel.classes()).toContain('is-dragging')
    expect(
      (carousel.element.querySelector('.el-carousel__item') as HTMLElement).style
        .transform
    ).toContain('translateX(-100px)')

    carousel.element.dispatchEvent(createPointerEvent('pointerup', 120))
    await nextTick()

    const items = carousel.element.querySelectorAll('.el-carousel__item')
    expect(items[1].classList.contains('is-active')).toBeTruthy()
    expect(carousel.classes()).not.toContain('is-dragging')
  })
  it('should guarantee order of indicators', async () => {
    const data = reactive([1, 2, 3, 4])
    wrapper = mount({
      setup() {
        return () => (
          <div>
            <Carousel>
              {data.map((value) => (
                <CarouselItem label={value} key={value}>
                  {value}
                </CarouselItem>
              ))}
            </Carousel>
          </div>
        )
      },
    })
    await nextTick()

    data.splice(1, 0, 5)
    await nextTick()
    const indicators = wrapper.findAll('.el-carousel__button')
    data.forEach((value, index) => {
      expect(indicators[index].element.textContent).toEqual(value.toString())
    })
  })
  it('height is set to auto', async () => {
    const data = [1, 2, 3]

    wrapper = mount({
      setup() {
        return () => (
          <div>
            <Carousel height={'auto'} autoplay={false}>
              {data.map((value) => (
                <CarouselItem label={value} key={value} style="height: 100px">
                  {value}
                </CarouselItem>
              ))}
            </Carousel>
          </div>
        )
      },
    })

    const items = wrapper.vm.$el.querySelectorAll('.el-carousel__item')

    Array.from<HTMLElement>(items).forEach((item) => {
      vi.spyOn(item, 'offsetHeight', 'get').mockImplementation(() => {
        return Number.parseFloat(window.getComputedStyle(item).height) || 0
      })
    })

    await nextTick()
    expect(items[0].classList.contains('is-active')).toBeTruthy()

    const container = wrapper.find<HTMLElement>(
      '.el-carousel__container'
    ).element

    expect(container.style.height).toBe('100px')
  })
  it('set to automatic when item is of different height', async () => {
    const data = [100, 200, 300]

    wrapper = mount({
      setup() {
        return () => (
          <div>
            <Carousel height={'auto'} autoplay={false} ref={'carousel'}>
              {data.map((value) => (
                <CarouselItem
                  label={value}
                  key={value}
                  style={`height: ${value}px`}
                >
                  {value}
                </CarouselItem>
              ))}
            </Carousel>
          </div>
        )
      },
    })

    const items = wrapper.vm.$el.querySelectorAll('.el-carousel__item')

    Array.from<HTMLElement>(items).forEach((item) => {
      vi.spyOn(item, 'offsetHeight', 'get').mockImplementation(() => {
        return Number.parseFloat(window.getComputedStyle(item).height) || 0
      })
    })

    await nextTick()

    const carousel = wrapper.findComponent({ ref: 'carousel' })
      .vm as CarouselInstance

    const container = wrapper.find<HTMLElement>(
      '.el-carousel__container'
    ).element

    expect(items[0].classList.contains('is-active')).toBeTruthy()
    expect(container.style.height).toBe('100px')

    carousel.next()
    await nextTick()

    expect(items[1].classList.contains('is-active')).toBeTruthy()
    expect(container.style.height).toBe('200px')

    carousel.next()
    await nextTick()

    expect(items[2].classList.contains('is-active')).toBeTruthy()
    expect(container.style.height).toBe('300px')

    carousel.next()
    await nextTick()

    expect(items[0].classList.contains('is-active')).toBeTruthy()
    expect(container.style.height).toBe('100px')
  })
})

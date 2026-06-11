import { defineComponent, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FsuMotion, {
  FsuTransition,
  createMotionRouteCleanup,
  getGsap,
  isScrollTriggerRegistered,
  motionPresets,
  motionTokens,
  useGsapContext,
  useScrollReveal,
  useTimeline,
  vMotion,
} from '..'

const flushMotionFrame = async () => {
  vi.runOnlyPendingTimers()
  await nextTick()
}

describe('motion primitives', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.documentElement.dataset.fsusMotion = 'enabled'
    Object.defineProperty(window, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    delete document.documentElement.dataset.fsusMotion
    document.body.innerHTML = ''
  })

  it('centralizes the first-party token and preset contracts', () => {
    expect(motionTokens.duration.base).toBe('220ms')
    expect(motionTokens.distance.md).toBe('16px')
    expect(Object.keys(motionPresets)).toEqual([
      'fade-in',
      'fade-up',
      'fade-down',
      'fade-left',
      'fade-right',
      'scale-fade',
      'slide-left',
      'slide-right',
      'slide-up',
      'list-stagger',
      'route-fade',
      'card-hover',
    ])
  })

  it('runs v-motion with string syntax', async () => {
    const wrapper = mount(() => <div v-motion={'fade-up'}>content</div>, {
      global: {
        directives: {
          motion: vMotion,
        },
      },
    })

    await nextTick()
    await flushMotionFrame()
    const el = wrapper.element as HTMLElement

    expect(el.dataset.fsusMotionPreset).toBe('fade-up')
    expect(el.style.transition).toContain('opacity')
    expect(el.style.transition).toContain('transform')
    expect(el.style.transform).toBe('translate3d(0, 0, 0)')
  })

  it('runs v-motion with object syntax and list stagger', async () => {
    const wrapper = mount(
      () => (
        <div>
          <span v-motion={{ name: 'list-stagger', index: 2, duration: 120 }}>
            item
          </span>
        </div>
      ),
      {
        global: {
          directives: {
            motion: vMotion,
          },
        },
      },
    )

    await nextTick()
    await flushMotionFrame()
    const el = wrapper.find('span').element as HTMLElement

    expect(el.dataset.fsusMotionPreset).toBe('list-stagger')
    expect(el.style.transition).toContain('120ms')
    expect(el.style.transition).toContain('calc(var(--fsus-motion-stagger')
  })

  it('finishes immediately when global motion is reduced', async () => {
    document.documentElement.dataset.fsusMotion = 'reduced'

    const wrapper = mount(() => <div v-motion={'scale-fade'}>content</div>, {
      global: {
        directives: {
          motion: vMotion,
        },
      },
    })

    await nextTick()
    const el = wrapper.element as HTMLElement

    expect(el.style.transition).toBe('')
    expect(el.style.opacity).toBe('1')
    expect(el.style.transform).toBe('scale(1)')
  })

  it('wraps Vue Transition with preset-based enter and leave hooks', async () => {
    const visible = ref(true)
    const wrapper = mount(
      defineComponent({
        setup() {
          return () => (
            <FsuTransition name="scale-fade" duration={1}>
              {visible.value ? <div class="panel">panel</div> : null}
            </FsuTransition>
          )
        },
      }),
      { attachTo: document.body },
    )

    await nextTick()
    visible.value = false
    await nextTick()
    vi.advanceTimersByTime(16)
    await nextTick()

    const panel = document.body.querySelector('.panel') as HTMLElement
    expect(panel.style.transition).toContain('1ms')
    expect(panel.style.transform).toBe('scale(0.98)')

    vi.runAllTimers()
    await nextTick()
    expect(document.body.querySelector('.panel')).toBeNull()
    wrapper.unmount()
  })

  it('installs the directive and transition component as a plugin', () => {
    const Root = defineComponent({
      template: `
        <FsuTransition>
          <div v-motion="'fade-in'">ready</div>
        </FsuTransition>
      `,
    })

    const wrapper = mount(Root, {
      global: {
        plugins: [FsuMotion],
      },
    })

    expect(wrapper.text()).toBe('ready')
    expect(wrapper.element.dataset.fsusMotionPreset).toBe('fade-in')
  })

  it('installs scroll reveal as a reduced-motion safe directive', () => {
    document.documentElement.dataset.fsusMotion = 'reduced'
    const Root = defineComponent({
      template: `<section v-scroll-reveal="'fade-up'">ready</section>`,
    })

    const wrapper = mount(Root, {
      global: {
        plugins: [FsuMotion],
      },
    })
    const el = wrapper.element as HTMLElement

    expect(el.dataset.fsusScrollRevealPreset).toBe('fade-up')
    expect(el.style.opacity).toBe('1')
    expect(el.style.transform).toBe('translate3d(0, 0, 0)')
  })

  it('wraps gsap context creation and deterministic cleanup', () => {
    const el = document.createElement('div')
    document.body.append(el)
    const context = useGsapContext(el)

    context.create(() => {
      getGsap().set(el, { opacity: 0.5 })
    })

    expect(context.contexts.size).toBe(1)
    expect(el.style.opacity).toBe('0.5')

    context.revert()

    expect(context.contexts.size).toBe(0)
    expect(el.style.opacity).toBe('')
  })

  it('builds preset-based gsap timelines without raw page-level gsap calls', () => {
    const el = document.createElement('div')
    const timeline = useTimeline()

    timeline.add({ target: el, preset: 'fade-up', duration: 120 })

    expect(timeline.timeline.getChildren()).toHaveLength(1)
    expect(timeline.timeline.duration()).toBeCloseTo(0.12)

    timeline.clear()
    expect(timeline.timeline.getChildren()).toHaveLength(0)
  })

  it('reveals scroll content through a managed ScrollTrigger wrapper', () => {
    const el = document.createElement('div')
    document.body.append(el)
    const reveal = useScrollReveal({ target: el, name: 'fade-up' })

    const tween = reveal.reveal()

    expect(isScrollTriggerRegistered()).toBe(true)
    expect(
      (tween?.vars.scrollTrigger as ScrollTrigger.StaticVars).trigger,
    ).toBe(el)
    expect(reveal.tweens.size).toBe(1)

    reveal.kill()
    expect(reveal.tweens.size).toBe(0)
  })

  it('finishes scroll reveal immediately when motion is reduced', () => {
    document.documentElement.dataset.fsusMotion = 'reduced'
    const el = document.createElement('div')
    const reveal = useScrollReveal({ target: el, name: 'fade-up' })

    const tween = reveal.reveal()

    expect(tween).toBeUndefined()
    expect(el.style.opacity).toBe('1')
    expect(el.style.transform).toBe('translate3d(0, 0, 0)')
  })

  it('provides a route cleanup bucket for route leave hooks', () => {
    const first = vi.fn()
    const second = vi.fn()
    const routeCleanup = createMotionRouteCleanup()
    const removeFirst = routeCleanup.add(first)
    routeCleanup.add(second)

    expect(routeCleanup.size).toBe(2)
    removeFirst()
    expect(routeCleanup.size).toBe(1)

    routeCleanup.cleanup()

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
    expect(routeCleanup.size).toBe(0)
  })
})

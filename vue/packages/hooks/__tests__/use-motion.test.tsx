import { defineComponent, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyFsusInteractiveMotionVars,
  fsusDecayOverflow,
  getFsusMotionRuntime,
  normalizeFsusWheelDelta,
  resolveFsusInteractiveMotion,
  useFsusDrag,
  useFsusInertia,
  useFsusMotionRuntime,
  useFsusSpring,
} from '../use-motion'

const motionTokens = [
  '--fsus-motion-control',
  '--fsus-motion-control-fast',
  '--fsus-motion-drag-blur',
  '--fsus-motion-drag-max-offset',
  '--fsus-motion-drag-scale',
  '--fsus-motion-drag-trail-opacity',
  '--fsus-motion-scroll-idle',
  '--fsus-motion-scroll-max-offset',
  '--fsus-motion-scroll-settle',
  '--fsus-motion-scroll-trail-opacity',
  '--fsus-motion-spring-damping',
  '--fsus-motion-spring-mass',
  '--fsus-motion-spring-stiffness',
]

const resetMotionRoot = () => {
  const root = document.documentElement
  delete root.dataset.fsusMotion
  delete root.dataset.fsusMotionPreset
  for (const token of motionTokens) root.style.removeProperty(token)
}

describe('use-motion', () => {
  afterEach(() => {
    resetMotionRoot()
    vi.restoreAllMocks()
  })

  it('uses the quiet standard runtime when no root override is present', () => {
    const runtime = getFsusMotionRuntime()

    expect(runtime.preset).toBe('standard')
    expect(runtime.controlFastMs).toBe(140)
    expect(runtime.controlMs).toBe(220)
    expect(runtime.dragBlurPx).toBe(0)
    expect(runtime.dragScaleDelta).toBe(0)
    expect(runtime.dragTrailOpacity).toBe(0)
    expect(runtime.scrollTrailOpacity).toBe(0)
    expect(runtime.spring).toEqual({
      damping: 28,
      mass: 0.9,
      stiffness: 260,
    })
  })

  it('reads root motion tokens into a normalized runtime', () => {
    const root = document.documentElement
    root.dataset.fsusMotion = 'enabled'
    root.dataset.fsusMotionPreset = 'expressive'
    root.style.setProperty('--fsus-motion-control', '310ms')
    root.style.setProperty('--fsus-motion-control-fast', '180ms')
    root.style.setProperty('--fsus-motion-drag-blur', '0.5px')
    root.style.setProperty('--fsus-motion-drag-max-offset', '7px')
    root.style.setProperty('--fsus-motion-drag-scale', '0.12')
    root.style.setProperty('--fsus-motion-drag-trail-opacity', '0.7')
    root.style.setProperty('--fsus-motion-scroll-idle', '420ms')
    root.style.setProperty('--fsus-motion-scroll-max-offset', '6px')
    root.style.setProperty('--fsus-motion-scroll-settle', '180ms')
    root.style.setProperty('--fsus-motion-scroll-trail-opacity', '0.6')
    root.style.setProperty('--fsus-motion-spring-damping', '22')
    root.style.setProperty('--fsus-motion-spring-mass', '0.7')
    root.style.setProperty('--fsus-motion-spring-stiffness', '360')

    const runtime = getFsusMotionRuntime()

    expect(runtime.enabled).toBe(true)
    expect(runtime.preset).toBe('expressive')
    expect(runtime.controlMs).toBe(310)
    expect(runtime.dragBlurPx).toBe(0.5)
    expect(runtime.dragMaxOffsetPx).toBe(7)
    expect(runtime.dragScaleDelta).toBe(0.12)
    expect(runtime.dragTrailOpacity).toBe(0.7)
    expect(runtime.scrollIdleMs).toBe(420)
    expect(runtime.scrollMaxOffsetPx).toBe(6)
    expect(runtime.scrollSettleMs).toBe(180)
    expect(runtime.scrollTrailOpacity).toBe(0.6)
    expect(runtime.spring).toEqual({
      damping: 22,
      mass: 0.7,
      stiffness: 360,
    })
  })

  it('damps overflow using a bounded decay curve', () => {
    expect(fsusDecayOverflow(0, 24)).toBe(0)
    expect(fsusDecayOverflow(12, 24)).toBeGreaterThan(0)
    expect(fsusDecayOverflow(120, 24)).toBeLessThanOrEqual(24)
  })

  it('normalizes notched wheel deltas without damping trackpad deltas', () => {
    expect(normalizeFsusWheelDelta(18)).toBe(18)
    expect(normalizeFsusWheelDelta(120)).toBe(48)
    expect(normalizeFsusWheelDelta(-120)).toBe(-48)
    expect(
      normalizeFsusWheelDelta(3, {
        deltaMode: 1,
      }),
    ).toBe(48)
    expect(
      normalizeFsusWheelDelta(240, {
        maxDiscreteDeltaPx: 32,
      }),
    ).toBe(32)
  })

  it('normalizes interactive scroll motion into shared css variables', () => {
    const element = document.createElement('div')
    const metrics = resolveFsusInteractiveMotion({
      deltaY: 96,
      elapsedMs: 16,
      kind: 'scroll',
      runtime: {
        enabled: true,
        scrollMaxOffsetPx: 5,
        scrollTrailOpacity: 0.5,
      },
    })

    expect(metrics.offsetPx).toBeGreaterThan(0)
    expect(metrics.offsetPx).toBeLessThanOrEqual(5)
    expect(metrics.offsetY).toBeLessThan(0)
    expect(metrics.trailOpacity).toBeGreaterThan(0)

    applyFsusInteractiveMotionVars(element, metrics)

    expect(
      Number.parseFloat(
        element.style.getPropertyValue('--fsus-interactive-motion-strength'),
      ),
    ).toBeGreaterThan(0)
    expect(
      element.style.getPropertyValue('--fsus-interactive-motion-offset-y'),
    ).toContain('-')
  })

  it('resolves shared interactive motion and caps heavy DOM movement', () => {
    const normal = resolveFsusInteractiveMotion({
      deltaY: 180,
      elapsedMs: 16,
      kind: 'scroll',
      runtime: {
        enabled: true,
        dragBlurPx: 0.4,
        dragMaxOffsetPx: 6,
        dragScaleDelta: 0.1,
        dragTrailOpacity: 0.6,
        scrollMaxOffsetPx: 6,
        scrollSettleMs: 160,
        scrollTrailOpacity: 0.6,
      },
    })
    const heavy = resolveFsusInteractiveMotion({
      deltaY: 180,
      elapsedMs: 16,
      heavyDom: true,
      kind: 'scroll',
      runtime: {
        enabled: true,
        dragBlurPx: 0.4,
        scrollMaxOffsetPx: 6,
        scrollSettleMs: 160,
        scrollTrailOpacity: 0.6,
      },
    })
    const element = document.createElement('div')

    expect(normal.offsetPx).toBeGreaterThan(heavy.offsetPx)
    expect(heavy.offsetPx).toBeLessThanOrEqual(1.35)
    expect(heavy.blurPx).toBe(0)

    applyFsusInteractiveMotionVars(element, heavy)

    expect(
      element.style.getPropertyValue('--fsus-interactive-motion-blur'),
    ).toBe('0.00px')
    expect(
      element.style.getPropertyValue('--fsus-interactive-motion-offset-y'),
    ).toContain('-')
  })

  it('updates runtime when root motion attributes change', async () => {
    let runtime!: ReturnType<typeof useFsusMotionRuntime>
    const wrapper = mount(
      defineComponent({
        setup() {
          runtime = useFsusMotionRuntime()
          return () => null
        },
      }),
    )

    document.documentElement.dataset.fsusMotion = 'disabled'
    await nextTick()
    await nextTick()

    expect(runtime.value.disabled).toBe(true)
    expect(runtime.value.enabled).toBe(false)

    wrapper.unmount()
  })

  it('tracks drag velocity without leaking document listeners', () => {
    let drag!: ReturnType<typeof useFsusDrag>
    const wrapper = mount(
      defineComponent({
        setup() {
          drag = useFsusDrag()
          return () => null
        },
      }),
    )

    drag.start({ x: 0, y: 0 }, 0)
    const movement = drag.move({ x: 12, y: 16 }, 20)

    expect(drag.isDragging.value).toBe(true)
    expect(movement.totalX).toBe(12)
    expect(movement.totalY).toBe(16)
    expect(drag.velocity.value).toBe(1)
    expect(drag.end()).toBe(1)
    expect(drag.isDragging.value).toBe(false)

    wrapper.unmount()
  })

  it('jumps springs immediately when motion is disabled', async () => {
    document.documentElement.dataset.fsusMotion = 'disabled'
    const source = ref(0)
    let spring!: ReturnType<typeof useFsusSpring>
    const wrapper = mount(
      defineComponent({
        setup() {
          spring = useFsusSpring(source)
          return () => null
        },
      }),
    )

    spring.set(42)
    await nextTick()

    expect(spring.value.value).toBe(42)
    wrapper.unmount()
  })

  it('completes inertia immediately when motion is disabled', () => {
    document.documentElement.dataset.fsusMotion = 'disabled'
    const update = vi.fn()
    const complete = vi.fn()
    let inertia!: ReturnType<typeof useFsusInertia>
    const wrapper = mount(
      defineComponent({
        setup() {
          inertia = useFsusInertia()
          return () => null
        },
      }),
    )

    inertia.start({
      initialVelocity: 1,
      onComplete: complete,
      onUpdate: update,
    })

    expect(update).not.toHaveBeenCalled()
    expect(complete).toHaveBeenCalledOnce()
    wrapper.unmount()
  })
})

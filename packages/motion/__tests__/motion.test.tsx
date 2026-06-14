import { defineComponent, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FsuMotion, {
  FsuMotionRecipe,
  FsuRowStateMotion,
  FsuScrollTimeline,
  FsuSharedElement,
  FsuTaskReceipt,
  FsuTransition,
  createMotionRouteCleanup,
  defaultMotionBudget,
  getGsap,
  getPrefersReducedMotion,
  getMotionRecipe,
  getMotionPresetSurfaces,
  isMotionPresetAllowedOnSurface,
  isScrollTriggerRegistered,
  motionPresets,
  motionPresetAliases,
  motionRecipes,
  motionTokenAliases,
  motionTokens,
  normalizeMotionRecipeOptions,
  resolveMotionPreference,
  resolveMotionScrollBehavior,
  resolveMotionBudget,
  runMotion,
  runMotionRecipe,
  setMotionBudget,
  useFlipMotion,
  useGsapContext,
  useMotionPreference,
  useRowStateMotion,
  useScrollReveal,
  useScrollTimeline,
  useSharedElementMotion,
  useTaskFeedback,
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
    setMotionBudget()
    vi.useRealTimers()
    delete document.documentElement.dataset.fsusMotion
    document.body.innerHTML = ''
  })

  it('centralizes the first-party token and preset contracts', () => {
    expect(motionTokens.duration.base).toBe('220ms')
    expect(motionTokenAliases).toMatchObject({
      fast: 'var(--fsus-motion-control-fast, 140ms)',
      control: 'var(--fsus-motion-control, 220ms)',
      panel: 'var(--fsus-motion-panel, 420ms)',
      overlay: 'var(--fsus-motion-overlay, 260ms)',
      route: 'var(--fsus-motion-overlay, 260ms)',
      standardEase:
        'var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1))',
      emphasizedEase:
        'var(--fsus-motion-emphasized, cubic-bezier(0.2, 0, 0, 1))',
    })
    expect(defaultMotionBudget.maxStaggerItems).toBe(20)
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
      'surface-settle',
      'paper-settle',
      'route-settle',
      'dialog-settle',
      'sheet-settle',
      'dock-settle',
      'toast-receipt',
      'banner-receipt',
      'lightbox-focus',
      'index-list-settle',
    ])
    expect(motionPresetAliases['scale-fade']).toBe('dialog-settle')
    expect(
      Object.values(motionPresets).every(
        (preset) => preset.reduced.opacity === '1',
      ),
    ).toBe(true)
    expect(getMotionPresetSurfaces('surface-settle').allowed).toContain(
      'reading-surface',
    )
    expect(
      isMotionPresetAllowedOnSurface('scale-fade', 'ordinary-content'),
    ).toBe(false)
    expect(
      isMotionPresetAllowedOnSurface(
        'lightbox-focus',
        'media-preview-surface',
      ),
    ).toBe(true)
    expect(Object.keys(motionRecipes)).toEqual([
      'content-enter',
      'article-list-enter',
      'island-enter',
      'state-pending',
      'state-settled',
      'state-error',
      'route-crossfade',
      'reading-anchor-highlight',
      'panel-enter',
      'list-enter-small',
      'card-interactive',
      'page-enter',
      'media-hover-subtle',
    ])
  })

  it('centralizes motion preference and scroll behavior resolution', () => {
    document.documentElement.dataset.fsusMotion = 'reduced'

    const preference = resolveMotionPreference()
    const composable = useMotionPreference()

    expect(getPrefersReducedMotion()).toBe(false)
    expect(preference.mode).toBe('reduced')
    expect(preference.reduced).toBe(true)
    expect(composable.reduced.value).toBe(true)
    expect(resolveMotionScrollBehavior('smooth')).toBe('auto')
  })

  it('maps motion recipes to preset-backed runtime options', async () => {
    const el = document.createElement('div')
    document.body.append(el)

    runMotionRecipe(el, {
      recipe: 'article-list-enter',
      index: 50,
      duration: 120,
    })

    await nextTick()
    await flushMotionFrame()

    expect(getMotionRecipe('state-error').preset).toBe('banner-receipt')
    expect(normalizeMotionRecipeOptions('panel-enter').name).toBe(
      'dialog-settle',
    )
    expect(el.style.transition).toContain('120ms')
    expect(el.style.transition).toContain('* 19')
  })

  it('falls back to terminal state when the motion node budget is exhausted', () => {
    setMotionBudget({ maxAnimatedNodesPerViewport: 0 })
    const el = document.createElement('div')
    document.body.append(el)

    runMotion(el, { name: 'fade-up' })

    expect(resolveMotionBudget().maxAnimatedNodesPerViewport).toBe(0)
    expect(el.style.transition).toBe('')
    expect(el.style.opacity).toBe('1')
    expect(el.style.transform).toBe('')
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
    expect(el.style.transform).toBe('')
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

  it('installs recipe, scroll timeline, and shared-element components', async () => {
    document.documentElement.dataset.fsusMotion = 'reduced'
    const wrapper = mount(
      () => (
        <div>
          <FsuMotionRecipe name="state-settled">saved</FsuMotionRecipe>
          <FsuTaskReceipt phase="success" message="Saved" />
          <FsuRowStateMotion state="busy" rowKey="row-1" message="Saving" />
          <FsuScrollTimeline
            segments={[{ from: 0, to: 0.25, recipe: 'content-enter' }]}
          >
            timeline
          </FsuScrollTimeline>
          <FsuSharedElement id="article-cover-1">cover</FsuSharedElement>
        </div>
      ),
      {
        global: {
          plugins: [FsuMotion],
        },
        attachTo: document.body,
      },
    )

    await nextTick()

    expect(wrapper.find('[data-fsus-motion-recipe="state-settled"]').exists())
      .toBe(true)
    expect(wrapper.find('[data-fsus-task-receipt="success"]').exists()).toBe(
      true,
    )
    expect(wrapper.find('[data-fsus-row-state="busy"]').exists()).toBe(true)
    expect(wrapper.find('[data-fsus-scroll-timeline="natural"]').exists()).toBe(
      true,
    )
    expect(wrapper.find('[data-fsus-shared-element-id="article-cover-1"]')
      .exists()).toBe(true)
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
    timeline.add({ target: el, recipe: 'state-settled', position: '+=0' })

    expect(timeline.timeline.getChildren()).toHaveLength(2)
    expect(timeline.timeline.duration()).toBeGreaterThanOrEqual(0.12)

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

  it('creates natural scroll timelines without scroll-jacking options', () => {
    const el = document.createElement('div')
    document.body.append(el)
    const timeline = useScrollTimeline({
      target: el,
      segments: [{ from: 0, to: 0.5, recipe: 'content-enter' }],
      scrollTrigger: { pin: true, snap: 1 },
    })

    const created = timeline.create()

    expect(isScrollTriggerRegistered()).toBe(true)
    expect(created?.scrollTrigger?.vars.pin).toBe(false)
    expect(created?.scrollTrigger?.vars.snap).toBeUndefined()
    expect(timeline.timelines.size).toBe(1)

    timeline.kill()
    expect(timeline.timelines.size).toBe(0)
  })

  it('exposes FLIP and shared-element helpers with terminal fallbacks', () => {
    document.documentElement.dataset.fsusMotion = 'reduced'
    const source = document.createElement('div')
    const target = document.createElement('div')
    document.body.append(source, target)

    const flip = useFlipMotion()
    const state = flip.capture(source)
    const control = flip.play(target, state)
    control.finish()

    const shared = useSharedElementMotion()
    const unregister = shared.register('article-cover-1', source)

    expect(source.dataset.fsusSharedElementId).toBe('article-cover-1')
    expect(shared.transition('article-cover-1', target)).toBeDefined()

    unregister()
    expect(source.dataset.fsusSharedElementId).toBeUndefined()
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

  it('provides task feedback receipts with cancellable timers and aria output', () => {
    const feedback = useTaskFeedback({ clearDelay: 50 })

    feedback.pending('Saving')
    expect(feedback.phase.value).toBe('pending')
    expect(feedback.ariaLive.value).toBe('polite')
    expect(feedback.motionClass.value).toBe('fsu-motion-task-receipt')

    feedback.error('Failed')
    expect(feedback.ariaLive.value).toBe('assertive')
    expect(feedback.receiptProps.value['data-fsus-task-feedback']).toBe('error')

    feedback.success('Saved')
    vi.advanceTimersByTime(50)
    expect(feedback.phase.value).toBe('idle')
  })

  it('provides row state motion without requiring full-row flashing', () => {
    const rows = useRowStateMotion({ clearDelay: 40 })

    rows.set('post-1', { phase: 'busy', message: 'Saving' })
    rows.set('post-2', { phase: 'success', message: 'Saved' })

    expect(rows.activeCount.value).toBe(2)
    expect(rows.get('post-1').phase).toBe('busy')
    expect(rows.getClass('post-1')).toBe('fsu-motion-row-busy-line')
    expect(rows.getClass('post-2')).toBe('fsu-motion-row-confirm-line')

    vi.advanceTimersByTime(40)
    expect(rows.get('post-1').phase).toBe('busy')
    expect(rows.get('post-2').phase).toBe('idle')

    rows.clearAll()
    expect(rows.activeCount.value).toBe(0)
  })

  it('renders task and row feedback components with built-in accessibility', () => {
    const wrapper = mount(() => (
      <div>
        <FsuTaskReceipt phase="partial" summary message="3 of 5 saved" />
        <FsuRowStateMotion state="error" rowKey="post-1" message="Failed" />
      </div>
    ))

    const task = wrapper.find('[data-fsus-task-receipt="partial"]')
    const row = wrapper.find('[data-fsus-row-state="error"]')

    expect(task.attributes('aria-live')).toBe('polite')
    expect(task.classes()).toContain('fsu-motion-summary-receipt')
    expect(row.attributes('aria-live')).toBe('assertive')
    expect(row.classes()).toContain('fsu-motion-row-error-lock')
  })
})

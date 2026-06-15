import { readFileSync } from 'node:fs'
import { defineComponent, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FsuMotion, {
  FsuBottomActionBar,
  FsuMobileDock,
  FsuMotionRecipe,
  FsuOverlayTransition,
  FsuRowStateMotion,
  FsuScrollTimeline,
  FsuSheetTransition,
  FsuSharedElement,
  FsuTaskReceipt,
  FsuToastReceipt,
  FsuTransition,
  assertEveryPresetHasGovernanceMetadata,
  createMotionRouteCleanup,
  defaultMotionBudget,
  getGsap,
  getPrefersReducedMotion,
  getMotionRecipe,
  getMotionPresetSurfaces,
  isMotionDisabled,
  isMotionPresetAllowedOnSurface,
  isMotionReduced,
  isScrollTriggerRegistered,
  motionPresets,
  motionPresetAliases,
  motionRecipes,
  motionTokenAliases,
  motionTokens,
  normalizeMotionRecipeOptions,
  readingMotionPolicy,
  readingMotionPresetNames,
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
  validateMotionAdoptionMapping,
  validateMotionPresetUsage,
  vMotion,
} from '..'
import type { MotionAdoptionEntry } from '../governance'

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
    expect(motionTokens.patterns.standard.long.duration).toBe('400ms')
    expect(motionTokens.patterns.emphasized.short.easing).toBe(
      'cubic-bezier(0.2, 0, 0, 1)',
    )
    expect(motionTokens.instant).toBe('1ms')
    expect(motionTokenAliases).toMatchObject({
      fast: 'var(--fsus-motion-standard-short, 250ms)',
      control: 'var(--fsus-motion-standard-long, 400ms)',
      panel: 'var(--fsus-motion-emphasized-long, 500ms)',
      overlay: 'var(--fsus-motion-decel-long, 300ms)',
      route: 'var(--fsus-motion-decel-long, 300ms)',
      standardEase:
        'var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1))',
      emphasizedEase:
        'var(--fsus-motion-emphasized, cubic-bezier(0.2, 0, 0, 1))',
    })
    expect(defaultMotionBudget.maxStaggerItems).toBe(20)
    expect(motionTokens.patterns.standard.short.distance).toBe('8px')
    expect(motionTokens.patterns.decel.long.distance).toBe('12px')
    expect(Object.keys(motionPresets)).toEqual([
      'surface-settle',
      'paper-settle',
      'route-settle',
      'dialog-settle',
      'sheet-settle',
      'overlay-settle',
      'dock-settle',
      'toast-receipt',
      'banner-receipt',
      'lightbox-focus',
      'index-list-settle',
      'reading-title-settle',
      'media-develop',
      'media-focus',
      'code-ready',
      'grid-settle',
      'quote-line',
      'toc-anchor',
      'anchor-mark',
      'reading-progress-transform',
      'copy-confirm',
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
    expect(readingMotionPresetNames).toContain('code-ready')
    expect(readingMotionPolicy).toMatchObject({
      bodyTextAnimatedByDefault: false,
      imageHoverScaleByDefault: false,
      codeBlockMovesOnReady: false,
    })
    expect(
      readingMotionPresetNames.every((name) =>
        isMotionPresetAllowedOnSurface(name, 'reading-surface'),
      ),
    ).toBe(true)
    expect(motionPresets['media-focus'].to.transform).toBeUndefined()
    expect(motionPresets['code-ready'].to.transform).toBeUndefined()
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

  it('splits the disabled flag from the reduced-motion preference', () => {
    // Default state (no root mode, no preference, no disabled flag) —
    // both axes read as false.
    expect(isMotionDisabled()).toBe(false)
    expect(isMotionDisabled(true)).toBe(true)
    expect(isMotionReduced()).toBe(false)
    expect(resolveMotionPreference(false).disabled).toBe(false)
    expect(resolveMotionPreference(false).reduced).toBe(false)

    // Root mode 'disabled' flips the disabled axis but leaves the
    // reduced axis at its current value (false here, since the
    // reduced preference is also off).
    document.documentElement.dataset.fsusMotion = 'disabled'
    expect(isMotionDisabled()).toBe(true)
    expect(isMotionReduced()).toBe(false)
    expect(resolveMotionPreference().disabled).toBe(true)
    expect(resolveMotionPreference().reduced).toBe(true)

    // Root mode 'reduced' flips the reduced axis but does not imply
    // disabled — components can still opt in to animation while the
    // user is asking for reduced motion; runtime branches that need
    // to know which axis caused the reduction can read each one
    // independently.
    document.documentElement.dataset.fsusMotion = 'reduced'
    expect(isMotionDisabled()).toBe(false)
    expect(isMotionReduced()).toBe(true)
    expect(resolveMotionPreference().disabled).toBe(false)
    expect(resolveMotionPreference().reduced).toBe(true)
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

    expect(el.dataset.fsusMotionPreset).toBe('paper-settle')
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

    expect(el.dataset.fsusMotionPreset).toBe('index-list-settle')
    expect(el.style.transition).toContain('120ms')
    expect(el.style.transition).toContain(
      'calc(var(--fsus-motion-standard-short-stagger, 25ms)',
    )
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
    expect(panel.style.transform).toBe(
      'translate3d(0, var(--fsus-motion-emphasized-short-distance, 12px), 0)',
    )

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
    expect(wrapper.element.dataset.fsusMotionPreset).toBe('surface-settle')
  })

  it('installs recipe, scroll timeline, and shared-element components', async () => {
    document.documentElement.dataset.fsusMotion = 'reduced'
    const wrapper = mount(
      () => (
        <div>
          <FsuMotionRecipe name="state-settled">saved</FsuMotionRecipe>
          <FsuTaskReceipt phase="success" message="Saved" />
          <FsuRowStateMotion state="busy" rowKey="row-1" message="Saving" />
          <FsuMobileDock immediate={false}>dock</FsuMobileDock>
          <FsuBottomActionBar immediate={false}>bar</FsuBottomActionBar>
          <FsuToastReceipt immediate={false} message="Done" />
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
    expect(wrapper.find('[data-fsus-mobile-dock="bottom"]').exists()).toBe(
      true,
    )
    expect(wrapper.find('[data-fsus-bottom-action-bar]').exists()).toBe(true)
    expect(wrapper.find('[data-fsus-toast-receipt]').exists()).toBe(true)
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

    expect(el.dataset.fsusScrollRevealPreset).toBe('paper-settle')
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

  it('respects caller-supplied ScrollTrigger pin and snap', () => {
    const el = document.createElement('div')
    document.body.append(el)
    const timeline = useScrollTimeline({
      target: el,
      segments: [{ from: 0, to: 0.5, recipe: 'content-enter' }],
      scrollTrigger: { pin: true, snap: 1 },
    })

    const created = timeline.create()

    expect(isScrollTriggerRegistered()).toBe(true)
    // Caller-supplied pin and snap pass through to gsap verbatim.
    expect(created?.scrollTrigger?.vars.pin).toBe(true)
    expect(created?.scrollTrigger?.vars.snap).toBe(1)
    expect(timeline.timelines.size).toBe(1)

    timeline.kill()
    expect(timeline.timelines.size).toBe(0)
  })

  it('falls back to safe ScrollTrigger defaults when caller omits pin and snap', () => {
    const el = document.createElement('div')
    document.body.append(el)
    const timeline = useScrollTimeline({
      target: el,
      segments: [{ from: 0, to: 0.5, recipe: 'content-enter' }],
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

  it('renders mobile dock primitives without default glass and with safe-area', () => {
    const wrapper = mount(() => (
      <div>
        <FsuMobileDock immediate={false}>actions</FsuMobileDock>
        <FsuBottomActionBar immediate={false}>save</FsuBottomActionBar>
        <FsuSheetTransition>
          <div v-if={false}>sheet</div>
        </FsuSheetTransition>
      </div>
    ))

    const dock = wrapper.find('[data-fsus-mobile-dock="bottom"]')

    expect(dock.attributes('data-fsus-motion-preset')).toBe('dock-settle')
    expect(dock.attributes('style')).toContain('safe-area-inset-bottom')
    expect(dock.attributes('style')).not.toContain('backdrop-filter')
    expect(wrapper.find('[data-fsus-bottom-action-bar]').exists()).toBe(true)
  })

  it('restores focus after overlay close', async () => {
    const trigger = document.createElement('button')
    trigger.textContent = 'open'
    document.body.append(trigger)
    trigger.focus()

    const visible = ref(false)
    const wrapper = mount(
      defineComponent({
        setup() {
          return () => (
            <FsuOverlayTransition duration={1}>
              {visible.value ? (
                <div class="overlay" tabindex="-1">
                  overlay
                </div>
              ) : null}
            </FsuOverlayTransition>
          )
        },
      }),
      { attachTo: document.body },
    )

    visible.value = true
    await nextTick()
    vi.runAllTimers()
    await nextTick()
    const overlay = document.body.querySelector('.overlay') as HTMLElement
    overlay.focus()

    visible.value = false
    await nextTick()
    vi.runAllTimers()
    await nextTick()

    expect(document.activeElement).toBe(trigger)
    wrapper.unmount()
    trigger.remove()
  })

  it('enforces effect-level motion governance and downstream adoption', () => {
    expect(assertEveryPresetHasGovernanceMetadata()).toBe(true)

    expect(
      validateMotionPresetUsage({
        preset: 'lightbox-focus',
        surface: 'ordinary-content',
        interaction: 'default',
      }).map((item) => item.ruleId),
    ).toContain('ordinary-content-no-scale')

    expect(
      validateMotionPresetUsage({
        preset: 'fade-up',
        surface: 'reading-surface',
        interaction: 'default',
      }).map((item) => item.ruleId),
    ).toContain('reading-body-no-translate')

    expect(
      validateMotionPresetUsage({
        preset: 'index-list-settle',
        surface: 'list-table-surface',
        itemCount: 80,
      }).map((item) => item.ruleId),
    ).toContain('ordinary-list-no-complex-stagger')

    expect(
      validateMotionPresetUsage({
        preset: 'lightbox-focus',
        surface: 'ordinary-content',
        interaction: 'hover',
      }).map((item) => item.ruleId),
    ).toContain('hover-scale-requires-media-preview')

    expect(
      validateMotionPresetUsage({
        preset: 'surface-settle',
        surface: 'reading-surface',
        interaction: 'loading',
        effect: 'loading-sweep',
      }).map((item) => item.ruleId),
    ).toContain('reading-loading-no-sweep')

    const fixture = JSON.parse(
      readFileSync(
        'packages/motion/__tests__/fixtures/fsusblog-motion-adoption.json',
        'utf8',
      ),
    ) as { mappings: MotionAdoptionEntry[] }

    expect(validateMotionAdoptionMapping(fixture.mappings)).toEqual([])
    expect(
      validateMotionAdoptionMapping([
        {
          semantic: 'article.body.reveal',
          preset: 'fade-up',
          surface: 'reading-surface',
          interaction: 'default',
          effect: 'raw-keyframes',
          source: 'src/article.css',
        },
      ]).map((item) => item.ruleId),
    ).toEqual(
      expect.arrayContaining([
        'app-local-keyframes',
        'surface-disallowed',
        'reading-body-no-translate',
      ]),
    )
  })
})

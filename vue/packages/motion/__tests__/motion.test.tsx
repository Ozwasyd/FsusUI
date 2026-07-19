import { readFileSync } from 'node:fs'
import { defineComponent, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FsuMotion, {
  FsuBottomActionBar,
  FsuBottomTabBar,
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
  runOwnershipTransferSnapshotMotion,
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
    expect(motionTokens.patterns.standard.short.duration).toBe('220ms')
    expect(motionTokens.patterns.standard.long.duration).toBe('360ms')
    expect(motionTokens.patterns.emphasized.long.duration).toBe('360ms')
    expect(motionTokens.patterns.emphasized.short.easing).toBe(
      'cubic-bezier(0.2, 0, 0, 1)',
    )
    expect(motionTokens.instant).toBe('1ms')
    expect(motionTokenAliases).toMatchObject({
      fast: 'var(--fsus-motion-control-fast, 140ms)',
      control: 'var(--fsus-motion-control, 220ms)',
      panel: 'var(--fsus-motion-panel, 360ms)',
      overlay: 'var(--fsus-motion-overlay, 260ms)',
      route: 'var(--fsus-motion-duration-route, 240ms)',
      standardEase: 'var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1))',
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
      'ownership-transfer-snapshot',
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
      isMotionPresetAllowedOnSurface('lightbox-focus', 'media-preview-surface'),
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
    expect(motionPresets['ownership-transfer-snapshot']).toMatchObject({
      from: { opacity: '0' },
      to: { opacity: '1' },
      leaveFrom: { opacity: '1' },
      leaveTo: { opacity: '0' },
    })
    expect(motionPresets['route-settle']).toMatchObject({
      from: { opacity: '0.72', filter: 'none' },
      to: { opacity: '1', filter: 'none' },
      reduced: { opacity: '1', transform: 'none', filter: 'none' },
      leaveFrom: { opacity: '1', filter: 'none' },
      leaveTo: { opacity: '0.72', filter: 'none' },
    })
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
    expect(el.style.transform).toBe('none')
    expect(el.style.filter).toBe('none')
  })

  it('retains WAAPI terminal state without materializing inline styles', () => {
    const el = document.createElement('div')
    document.body.append(el)
    const cancel = vi.fn()
    const finish = vi.fn()
    const animation = {
      cancel,
      finish,
      oncancel: null,
      onfinish: null,
      playState: 'running',
    } as unknown as Animation
    const animate = vi.fn(() => animation)
    Object.defineProperty(el, 'animate', {
      configurable: true,
      value: animate,
    })

    const controls = runMotion(el, { name: 'fade-up' })
    ;(animation as Animation & { playState: AnimationPlayState }).playState =
      'finished'
    animation.onfinish?.(new Event('finish') as AnimationPlaybackEvent)

    expect(animate).toHaveBeenCalledTimes(1)
    expect(el.getAttribute('style')).toBeNull()
    expect(finish).not.toHaveBeenCalled()

    controls.cancel()
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it('uses a zero-duration WAAPI fill for reduced terminal state', () => {
    document.documentElement.dataset.fsusMotion = 'reduced'
    const el = document.createElement('div')
    document.body.append(el)
    const finish = vi.fn()
    const animation = {
      cancel: vi.fn(),
      finish,
      oncancel: null,
      onfinish: null,
      playState: 'finished',
    } as unknown as Animation
    const animate = vi.fn(() => animation)
    Object.defineProperty(el, 'animate', {
      configurable: true,
      value: animate,
    })

    runMotion(el, { name: 'fade-up' })

    expect(animate).toHaveBeenCalledWith(
      [
        { opacity: '1', transform: 'none', filter: 'none' },
        { opacity: '1', transform: 'none', filter: 'none' },
      ],
      { duration: 0, fill: 'forwards' },
    )
    expect(finish).toHaveBeenCalledTimes(1)
    expect(el.getAttribute('style')).toBeNull()
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
    expect(el.style.transform).toBe('none')
    expect(el.style.filter).toBe('none')
  })

  it('resolves route, panel, list, and reading-anchor runtime budgets', async () => {
    const cases = [
      {
        name: 'route-settle',
        surface: 'reading-surface',
        duration: '180ms',
        maxDuration: 360,
      },
      {
        name: 'dialog-settle',
        surface: 'overlay-sheet-dialog-surface',
        duration: '320ms',
        maxDuration: 360,
      },
      {
        name: 'sheet-settle',
        surface: 'overlay-sheet-dialog-surface',
        duration: '360ms',
        maxDuration: 360,
      },
      {
        name: 'index-list-settle',
        surface: 'list-table-surface',
        duration: '220ms',
        maxDuration: 220,
      },
      {
        name: 'surface-settle',
        surface: 'reading-surface',
        duration: '220ms',
        maxDuration: 220,
      },
    ] as const

    for (const testCase of cases) {
      const host = document.createElement('section')
      if (testCase.surface === 'reading-surface') {
        host.dataset.fsusSurface = 'reading'
      }
      const el = document.createElement('div')
      host.append(el)
      document.body.append(host)

      runMotion(el, {
        name: testCase.name,
        surface: testCase.surface,
      })
      await nextTick()
      await flushMotionFrame()

      const resolvedDuration = Number(testCase.duration.replace('ms', ''))
      expect(resolvedDuration).toBeLessThanOrEqual(testCase.maxDuration)
      expect(el.style.transition).toContain(testCase.duration)
      if (testCase.surface === 'reading-surface') {
        expect(el.style.filter).toBe('none')
        expect(el.style.getPropertyValue('--fsus-motion-blur')).toBe('0px')
        expect(el.style.getPropertyValue('--fsus-motion-trail')).toBe(
          'transparent',
        )
        expect(
          el.style.getPropertyValue('--fsus-interactive-motion-offset-y'),
        ).toBe('0px')
        expect(
          el.style.getPropertyValue('--fsus-interactive-motion-strength'),
        ).toBe('0')
        expect(el.style.transform).not.toContain('translate')
      }
    }
  })

  it('lands reduced and disabled motion without layout displacement', () => {
    for (const mode of ['reduced', 'disabled']) {
      document.documentElement.dataset.fsusMotion = mode
      for (const name of [
        'route-settle',
        'dialog-settle',
        'sheet-settle',
        'index-list-settle',
        'surface-settle',
      ] as const) {
        const el = document.createElement('div')
        document.body.append(el)
        const readLayout = () => {
          const { height, width, x, y } = el.getBoundingClientRect()
          return { height, width, x, y }
        }
        const before = readLayout()
        const onFinish = vi.fn()

        runMotion(el, { name, onFinish })

        expect(onFinish).toHaveBeenCalledTimes(1)
        expect(el.style.transition).toBe('')
        expect(el.style.transform).toBe('none')
        expect(el.style.filter).toBe('none')
        expect(readLayout()).toEqual(before)
      }
    }
  })

  it('forces every reading-surface preset to filter none at runtime', async () => {
    const host = document.createElement('article')
    host.dataset.fsusSurface = 'reading'
    document.body.append(host)

    for (const preset of Object.values(motionPresets).filter((definition) =>
      definition.surfaces.includes('reading-surface'),
    )) {
      const el = document.createElement('div')
      host.append(el)
      const controls = runMotion(el, {
        name: preset.name,
        surface: 'reading-surface',
        duration: 1,
      })
      await nextTick()
      await flushMotionFrame()
      controls.finish()

      expect(el.style.filter, preset.name).toBe('none')
      expect(el.style.transform, preset.name).not.toContain('translate')
      expect(
        el.style.getPropertyValue('--fsus-interactive-motion-glow'),
        preset.name,
      ).toBe('0px')
      expect(
        el.style.getPropertyValue('--fsus-motion-drag-trail-opacity'),
        preset.name,
      ).toBe('0')
    }
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

  it('forwards Vue Transition mode for route-level choreography', () => {
    let observedMode: unknown
    const TransitionProbe = defineComponent({
      props: {
        mode: String,
      },
      setup(props, { slots }) {
        observedMode = props.mode
        return () => slots.default?.()
      },
    })

    const wrapper = mount(
      () => (
        <FsuTransition name="route-settle" mode="out-in">
          <div class="panel">panel</div>
        </FsuTransition>
      ),
      {
        global: {
          stubs: {
            Transition: TransitionProbe,
          },
        },
      },
    )

    expect(observedMode).toBe('out-in')
    wrapper.unmount()
  })

  it('keeps normal appear motion for client-only transition consumers', async () => {
    const wrapper = mount(
      () => (
        <FsuTransition name="scale-fade" duration={1} appear>
          <div class="panel">panel</div>
        </FsuTransition>
      ),
      { attachTo: document.body },
    )

    await nextTick()
    await flushMotionFrame()

    const panel = wrapper.find('.panel').element as HTMLElement
    expect(panel.style.transition).toContain('1ms')
    wrapper.unmount()
  })

  it('suppresses initial appear motion for hydration-sensitive consumers', async () => {
    const wrapper = mount(
      () => (
        <FsuTransition
          name="scale-fade"
          duration={1}
          appear
          suppressAppearDuringHydration
        >
          <div class="panel">panel</div>
        </FsuTransition>
      ),
      { attachTo: document.body },
    )

    await nextTick()
    await flushMotionFrame()

    const panel = wrapper.find('.panel').element as HTMLElement
    expect(panel.style.transition).toBe('')
    wrapper.unmount()
  })

  it('provides a deterministic ownership-transfer snapshot fade contract', async () => {
    const enterEl = document.createElement('div')
    const leaveEl = document.createElement('div')
    document.body.append(enterEl, leaveEl)

    runOwnershipTransferSnapshotMotion(enterEl, { duration: 120 })
    runOwnershipTransferSnapshotMotion(leaveEl, {
      duration: 120,
      phase: 'leave',
    })

    await nextTick()
    await flushMotionFrame()

    expect(enterEl.dataset.fsusMotionPreset).toBe('ownership-transfer-snapshot')
    expect(enterEl.style.transition).toContain('opacity 120ms')
    expect(enterEl.style.transform).toBe('')
    expect(leaveEl.dataset.fsusMotionPreset).toBe('ownership-transfer-snapshot')
    expect(leaveEl.style.transition).toContain('opacity 120ms')
    expect(leaveEl.style.transform).toBe('')
  })

  it('settles ownership-transfer snapshots immediately under reduced motion', () => {
    document.documentElement.dataset.fsusMotion = 'reduced'
    const el = document.createElement('div')
    document.body.append(el)

    const onFinish = vi.fn()
    runOwnershipTransferSnapshotMotion(el, {
      phase: 'leave',
      onFinish,
    })

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(el.style.transition).toBe('')
    expect(el.style.opacity).toBe('0')
    expect(el.style.transform).toBe('none')
    expect(el.style.filter).toBe('none')
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

    expect(
      wrapper.find('[data-fsus-motion-recipe="state-settled"]').exists(),
    ).toBe(true)
    expect(wrapper.find('[data-fsus-task-receipt="success"]').exists()).toBe(
      true,
    )
    expect(wrapper.find('[data-fsus-row-state="busy"]').exists()).toBe(true)
    expect(wrapper.find('[data-fsus-mobile-dock="bottom"]').exists()).toBe(true)
    expect(wrapper.find('[data-fsus-bottom-action-bar]').exists()).toBe(true)
    expect(wrapper.find('[data-fsus-toast-receipt]').exists()).toBe(true)
    expect(wrapper.find('[data-fsus-scroll-timeline="natural"]').exists()).toBe(
      true,
    )
    expect(
      wrapper.find('[data-fsus-shared-element-id="article-cover-1"]').exists(),
    ).toBe(true)
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

  it('renders consumer bottom tab navigation with stable FsusUI semantics', () => {
    const items = [
      { key: 'home', label: '首页', href: '/' },
      { key: 'archive', label: '归档', href: '/archive' },
      { key: 'about', label: '关于', href: '/about' },
    ]

    const wrapper = mount(() => (
      <FsuBottomTabBar
        label="主导航"
        items={items}
        activeKey="archive"
        immediate={false}
      />
    ))

    const dock = wrapper.find('[data-fsus-bottom-tab-bar]')
    const links = wrapper.findAll('[data-fsus-bottom-tab-item]')

    expect(dock.exists()).toBe(true)
    expect(dock.attributes('data-fsus-mobile-dock')).toBe('bottom')
    expect(dock.attributes('aria-label')).toBe('主导航')
    expect(dock.attributes('style')).toContain('safe-area-inset-bottom')
    expect(links).toHaveLength(3)
    expect(links[1].attributes('aria-current')).toBe('page')
    expect(links[1].classes()).toContain('is-active')
    expect(links[1].find('.fsu-bottom-tab-bar__indicator').exists()).toBe(true)
  })

  it('collects bottom tab overflow into a native More sheet', async () => {
    const items = [
      { key: 'home', label: 'Home', href: '/' },
      { key: 'archive', label: 'Archive', href: '/archive' },
      { key: 'topics', label: 'Topics', href: '/topics' },
      { key: 'notes', label: 'Notes', href: '/notes' },
      { key: 'about', label: 'About', href: '/about' },
      { key: 'settings', label: 'Settings', href: '/settings' },
    ]
    const wrapper = mount(FsuBottomTabBar, {
      props: {
        items,
        activeKey: 'settings',
        moreLabel: 'More',
        immediate: false,
      },
    })

    const dock = wrapper.find('[data-fsus-bottom-tab-bar]')
    const directItems = Array.from(
      (dock.element as HTMLElement).children,
    ).filter((element) => element.matches('[data-fsus-bottom-tab-item]'))
    const moreMenu = wrapper.find<HTMLDetailsElement>(
      '[data-fsus-bottom-tab-more-menu]',
    )
    const moreTrigger = wrapper.find('[data-fsus-bottom-tab-more]')

    expect(directItems).toHaveLength(4)
    expect(moreTrigger.text()).toContain('More')
    expect(moreTrigger.classes()).toContain('is-active')
    expect(moreMenu.element.open).toBe(false)

    await moreTrigger.trigger('click')

    expect(moreMenu.element.open).toBe(true)
    expect(
      wrapper.findAll('[data-fsus-bottom-tab-more-panel] a').map((item) => ({
        key: item.attributes('data-fsus-bottom-tab-item'),
        label: item.text(),
      })),
    ).toEqual([
      { key: 'about', label: 'About' },
      { key: 'settings', label: 'Settings' },
    ])

    await wrapper
      .find('[data-fsus-bottom-tab-item="settings"]')
      .trigger('click')

    expect(moreMenu.element.open).toBe(false)
    expect(wrapper.emitted('navigate')?.[0]?.[0]).toEqual(items[5])
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
        'vue/packages/motion/__tests__/fixtures/fsusblog-motion-adoption.json',
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

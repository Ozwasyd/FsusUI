import {
  computed,
  isRef,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  unref,
  watch,
  type ComputedRef,
  type MaybeRef,
  type Ref,
} from 'vue'

export type FsusMotionRuntimeMode = 'enabled' | 'reduced' | 'disabled'
export type FsusMotionPresetMode = 'standard' | 'smooth' | 'expressive'

export interface FsusSpringConfig {
  stiffness: number
  damping: number
  mass: number
  restDelta?: number
  restSpeed?: number
}

export interface FsusMotionRuntime {
  controlFastMs: number
  controlMs: number
  dragBlurPx: number
  dragMaxOffsetPx: number
  dragScaleDelta: number
  dragTrailOpacity: number
  disabled: boolean
  enabled: boolean
  mode: FsusMotionRuntimeMode
  preset: FsusMotionPresetMode
  scrollMaxOffsetPx: number
  reduced: boolean
  scrollIdleMs: number
  scrollSettleMs: number
  scrollTrailOpacity: number
  spring: FsusSpringConfig
}

const defaultRuntime: FsusMotionRuntime = {
  controlFastMs: 140,
  controlMs: 220,
  dragBlurPx: 0,
  dragMaxOffsetPx: 3,
  dragScaleDelta: 0,
  dragTrailOpacity: 0,
  disabled: false,
  enabled: true,
  mode: 'enabled',
  preset: 'standard',
  scrollMaxOffsetPx: 3,
  reduced: false,
  scrollIdleMs: 110,
  scrollSettleMs: 100,
  scrollTrailOpacity: 0,
  spring: { damping: 28, mass: 0.9, stiffness: 260 },
}

const presetSpring: Record<FsusMotionPresetMode, FsusSpringConfig> = {
  standard: defaultRuntime.spring,
  smooth: { damping: 30, mass: 0.82, stiffness: 300 },
  expressive: { damping: 24, mass: 0.72, stiffness: 340 },
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export interface FsusWheelDeltaOptions {
  deltaMode?: number
  discreteThresholdPx?: number
  lineSizePx?: number
  maxDiscreteDeltaPx?: number
  viewportSizePx?: number
}

export const normalizeFsusWheelDelta = (
  delta: number,
  options: FsusWheelDeltaOptions = {},
): number => {
  if (!Number.isFinite(delta) || delta === 0) return 0
  const {
    deltaMode = 0,
    discreteThresholdPx = 72,
    lineSizePx = 16,
    maxDiscreteDeltaPx = 48,
    viewportSizePx = 0,
  } = options
  const sign = Math.sign(delta)
  const abs = Math.abs(delta)
  const px =
    deltaMode === 1
      ? abs * lineSizePx
      : deltaMode === 2
        ? abs * Math.max(viewportSizePx, lineSizePx)
        : abs
  const isDiscrete = deltaMode !== 0 || px >= discreteThresholdPx
  return sign * (isDiscrete ? Math.min(px, maxDiscreteDeltaPx) : px)
}

export const fsusDecayOverflow = (input: number, max = 24): number => {
  if (max <= 0) return 0
  const entry = Math.max(0, input) / max
  return 2 * (1 / (1 + Math.exp(-entry)) - 0.5) * max
}

const readMs = (style: CSSStyleDeclaration, token: string, fallback: number): number => {
  const value = style.getPropertyValue(token).trim()
  if (!value) return fallback
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return fallback
  return value.includes('ms') ? parsed : parsed * 1000
}

const readNumber = (style: CSSStyleDeclaration, token: string, fallback: number): number => {
  const parsed = Number.parseFloat(style.getPropertyValue(token))
  return Number.isFinite(parsed) ? parsed : fallback
}

export const getFsusMotionRuntime = (): FsusMotionRuntime => {
  if (typeof document === 'undefined' || typeof window === 'undefined') return defaultRuntime
  const root = document.documentElement
  const style = getComputedStyle(root)
  const configured = root.dataset.fsusMotion as FsusMotionRuntimeMode | undefined
  const mode: FsusMotionRuntimeMode =
    configured ??
    (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'enabled')
  const preset = (root.dataset.fsusMotionPreset as FsusMotionPresetMode | undefined) ?? 'standard'
  const enabled = mode === 'enabled'
  const sp = presetSpring[preset] ?? defaultRuntime.spring

  return {
    controlFastMs: enabled ? readMs(style, '--fsus-motion-control-fast', 140) : 1,
    controlMs: enabled ? readMs(style, '--fsus-motion-control', 220) : 1,
    disabled: mode === 'disabled',
    dragBlurPx: enabled ? readNumber(style, '--fsus-motion-drag-blur', 0) : 0,
    dragMaxOffsetPx: enabled ? readNumber(style, '--fsus-motion-drag-max-offset', 3) : 0,
    dragScaleDelta: enabled ? readNumber(style, '--fsus-motion-drag-scale', 0) : 0,
    dragTrailOpacity: enabled ? readNumber(style, '--fsus-motion-drag-trail-opacity', 0) : 0,
    enabled,
    mode,
    preset,
    reduced: mode === 'reduced' || mode === 'disabled',
    scrollMaxOffsetPx: enabled ? readNumber(style, '--fsus-motion-scroll-max-offset', 3) : 0,
    scrollIdleMs: enabled ? readMs(style, '--fsus-motion-scroll-idle', 110) : 1,
    scrollSettleMs: enabled ? readMs(style, '--fsus-motion-scroll-settle', 100) : 1,
    scrollTrailOpacity: enabled ? readNumber(style, '--fsus-motion-scroll-trail-opacity', 0) : 0,
    spring: {
      damping: enabled ? readNumber(style, '--fsus-motion-spring-damping', sp.damping) : 1,
      mass: enabled ? readNumber(style, '--fsus-motion-spring-mass', sp.mass) : 1,
      stiffness: enabled ? readNumber(style, '--fsus-motion-spring-stiffness', sp.stiffness) : 1000,
    },
  }
}

export const useFsusMotionRuntime = (): ComputedRef<FsusMotionRuntime> => {
  const runtime = ref(getFsusMotionRuntime())
  let cleanupMedia: (() => void) | undefined
  let observer: MutationObserver | undefined
  const refresh = () => {
    runtime.value = getFsusMotionRuntime()
  }

  onMounted(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (media?.addEventListener) {
      media.addEventListener('change', refresh)
      cleanupMedia = () => media.removeEventListener('change', refresh)
    }
    observer = new MutationObserver(refresh)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-fsus-motion', 'data-fsus-motion-preset', 'style'],
    })
    refresh()
  })

  onBeforeUnmount(() => {
    cleanupMedia?.()
    observer?.disconnect()
  })

  return computed(() => runtime.value)
}

export const useFsusReducedMotion = () => {
  const runtime = useFsusMotionRuntime()
  return computed(() => runtime.value.reduced)
}

/**
 * Pure zero-dependency damped harmonic spring value (replaces motion-dom).
 */
export interface FsusSpringController {
  get: () => number
  getVelocity: () => number
  set: (target: number) => void
  jump: (value: number) => void
  stop: () => void
  onChange: (listener: (value: number) => void) => () => void
  destroy: () => void
}

export const createFsusSpring = (
  initial: number,
  config: Partial<FsusSpringConfig> = {},
): FsusSpringController => {
  const stiffness = config.stiffness ?? 260
  const damping = config.damping ?? 28
  const mass = Math.max(config.mass ?? 0.9, 0.01)
  const restDelta = config.restDelta ?? 0.005
  const restSpeed = config.restSpeed ?? 0.005

  let current = initial
  let target = initial
  let velocity = 0
  let rafId = 0
  let lastTime = 0
  const listeners = new Set<(value: number) => void>()

  const notify = () => {
    for (const fn of listeners) fn(current)
  }

  const stop = () => {
    if (rafId && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(rafId)
    }
    rafId = 0
  }

  const step = (now: number) => {
    const dt = Math.min((now - lastTime) / 1000, 0.064)
    lastTime = now
    const displacement = current - target
    const springForce = -stiffness * displacement
    const dampingForce = -damping * velocity
    const acceleration = (springForce + dampingForce) / mass
    velocity += acceleration * dt
    current += velocity * dt

    if (Math.abs(velocity) < restSpeed && Math.abs(target - current) < restDelta) {
      current = target
      velocity = 0
      rafId = 0
      notify()
      return
    }
    notify()
    rafId = requestAnimationFrame(step)
  }

  const set = (next: number) => {
    target = next
    if (typeof requestAnimationFrame !== 'function') {
      current = next
      velocity = 0
      notify()
      return
    }
    if (!rafId) {
      lastTime = performance.now()
      rafId = requestAnimationFrame(step)
    }
  }

  const jump = (next: number) => {
    stop()
    current = next
    target = next
    velocity = 0
    notify()
  }

  return {
    get: () => current,
    getVelocity: () => velocity,
    set,
    jump,
    stop,
    onChange: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    destroy: () => {
      stop()
      listeners.clear()
    },
  }
}

export const useFsusSpring = (
  initial: MaybeRef<number>,
  overrides: MaybeRef<Partial<FsusSpringConfig>> = {},
) => {
  const runtime = useFsusMotionRuntime()
  const controller = createFsusSpring(unref(initial), {
    ...runtime.value.spring,
    ...unref(overrides),
  })
  const value = shallowRef(controller.get()) as Ref<number>
  const unsub = controller.onChange((latest) => {
    value.value = latest
  })

  const set = (next: number) => {
    if (runtime.value.enabled) controller.set(next)
    else controller.jump(next)
  }

  if (isRef(initial)) {
    watch(initial, set)
  }

  onBeforeUnmount(() => {
    unsub()
    controller.destroy()
  })

  return {
    value,
    set,
    jump: controller.jump,
    stop: controller.stop,
    getVelocity: controller.getVelocity,
    controller,
  }
}

export interface FsusDragPoint {
  x: number
  y: number
}

export const useFsusDrag = () => {
  const isDragging = ref(false)
  const velocity = ref(0)
  let startPt: FsusDragPoint | undefined
  let lastPt: FsusDragPoint | undefined
  let lastTime = 0

  const start = (point: FsusDragPoint, now = performance.now()) => {
    isDragging.value = true
    velocity.value = 0
    startPt = point
    lastPt = point
    lastTime = now
  }

  const move = (point: FsusDragPoint, now = performance.now()) => {
    const prev = lastPt ?? point
    const elapsed = Math.max(now - lastTime, 1)
    const deltaX = point.x - prev.x
    const deltaY = point.y - prev.y
    velocity.value = Math.hypot(deltaX, deltaY) / elapsed
    lastPt = point
    lastTime = now
    return {
      deltaX,
      deltaY,
      totalX: point.x - (startPt?.x ?? point.x),
      totalY: point.y - (startPt?.y ?? point.y),
      velocity: velocity.value,
    }
  }

  const end = () => {
    isDragging.value = false
    startPt = undefined
    lastPt = undefined
    return velocity.value
  }

  return { isDragging, velocity, start, move, end }
}

export const useFsusInertia = () => {
  const runtime = useFsusMotionRuntime()
  let frame = 0

  const stop = () => {
    if (frame) {
      cancelAnimationFrame(frame)
      frame = 0
    }
  }

  const start = (options: {
    initialVelocity: number
    onUpdate: (delta: number) => void
    onComplete?: () => void
  }) => {
    stop()
    if (!runtime.value.enabled || Math.abs(options.initialVelocity) < 0.01) {
      options.onComplete?.()
      return
    }
    let velocity = options.initialVelocity
    let previous = performance.now()
    const friction = runtime.value.preset === 'expressive' ? 0.93 : 0.9
    const tick = (now: number) => {
      const elapsed = Math.max(now - previous, 1)
      previous = now
      velocity *= Math.pow(friction, elapsed / 16)
      options.onUpdate(velocity * elapsed)
      if (Math.abs(velocity) < 0.01) {
        frame = 0
        options.onComplete?.()
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
  }

  onBeforeUnmount(stop)
  return { start, stop }
}

export interface FsusInteractiveMotionMetrics {
  blurPx: number
  edgeSizePx: number
  glowSizePx: number
  offsetX: number
  offsetY: number
  offsetPx: number
  scale: number
  settleMs: number
  strength: number
  thumbSpreadPx: number
  trailOpacity: number
}

export type FsusInteractiveMotionKind =
  | 'scroll'
  | 'drag'
  | 'slider'
  | 'color'
  | 'carousel'
  | 'switch'
  | 'spinner'
  | 'touch'

export const resolveFsusInteractiveMotion = (input: {
  axis?: 'x' | 'y' | 'both'
  deltaX?: number
  deltaY?: number
  elapsedMs?: number
  heavyDom?: boolean
  kind?: FsusInteractiveMotionKind
  runtime?: Partial<FsusMotionRuntime>
}): FsusInteractiveMotionMetrics => {
  const rt = { ...defaultRuntime, ...input.runtime }
  const dx = input.deltaX ?? 0
  const dy = input.deltaY ?? 0
  const distance = Math.hypot(dx, dy)
  if (!rt.enabled || distance <= 0) {
    return {
      blurPx: 0,
      edgeSizePx: 0,
      glowSizePx: 0,
      offsetPx: 0,
      offsetX: 0,
      offsetY: 0,
      scale: 1,
      settleMs: 1,
      strength: 0,
      thumbSpreadPx: 0,
      trailOpacity: 0,
    }
  }
  const safeElapsed = clamp(input.elapsedMs ?? 16, 8, 120)
  const strength = clamp(
    (clamp(distance / safeElapsed / 1.25, 0, 1) * 0.72 + clamp(distance / 96, 0, 1) * 0.28),
    0.16,
    1,
  )
  const isScroll = input.kind === 'scroll' || input.kind === 'spinner'
  const rawMax = isScroll ? rt.scrollMaxOffsetPx : rt.dragMaxOffsetPx
  const maxOffset = input.heavyDom ? Math.min(Math.max(rawMax, 0), 1.35) : Math.max(rawMax, 0)
  const offsetPx = maxOffset * (0.35 + strength * 0.65)
  const axis = input.axis ?? 'both'
  return {
    edgeSizePx: 28 + strength * 28,
    glowSizePx: 12 + strength * 22,
    blurPx: input.heavyDom ? 0 : rt.dragBlurPx * strength,
    offsetPx,
    offsetX: (axis === 'x' || axis === 'both') && dx ? -Math.sign(dx) * offsetPx : 0,
    offsetY: (axis === 'y' || axis === 'both') && dy ? -Math.sign(dy) * offsetPx : 0,
    scale: 1 + rt.dragScaleDelta * strength,
    settleMs: rt.scrollSettleMs,
    strength,
    thumbSpreadPx: 1 + strength * 3,
    trailOpacity: clamp((isScroll ? rt.scrollTrailOpacity : rt.dragTrailOpacity) * strength, 0, 1),
  }
}

export const applyFsusInteractiveMotionVars = (
  el: HTMLElement | null | undefined,
  metrics: FsusInteractiveMotionMetrics,
) => {
  if (!el) return
  el.style.setProperty('--fsus-interactive-motion-strength', metrics.strength.toFixed(3))
  el.style.setProperty('--fsus-interactive-motion-offset-x', `${metrics.offsetX.toFixed(2)}px`)
  el.style.setProperty('--fsus-interactive-motion-offset-y', `${metrics.offsetY.toFixed(2)}px`)
  el.style.setProperty('--fsus-interactive-motion-scale', metrics.scale.toFixed(3))
  el.style.setProperty('--fsus-interactive-motion-settle', `${metrics.settleMs.toFixed(0)}ms`)
}

export const resetFsusInteractiveMotionVars = (el: HTMLElement | null | undefined) =>
  applyFsusInteractiveMotionVars(el, resolveFsusInteractiveMotion({ deltaX: 0, deltaY: 0 }))

import {
  computed,
  isRef,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  unref,
  watch,
} from 'vue'
import {
  motionValue as createMotionValue,
  springValue as createSpringValue,
} from 'motion-dom'

import type { ComputedRef, MaybeRef, Ref } from 'vue'
import type { MotionValue } from 'motion-dom'

export type FsusMotionMode = 'enabled' | 'reduced' | 'disabled'
export type FsusMotionPreset = 'standard' | 'smooth' | 'expressive'

export type FsusMotionRuntime = {
  controlFastMs: number
  controlMs: number
  dragBlurPx: number
  dragMaxOffsetPx: number
  dragScaleDelta: number
  dragTrailOpacity: number
  disabled: boolean
  enabled: boolean
  mode: FsusMotionMode
  preset: FsusMotionPreset
  scrollMaxOffsetPx: number
  reduced: boolean
  scrollIdleMs: number
  scrollSettleMs: number
  scrollTrailOpacity: number
  spring: {
    damping: number
    mass: number
    stiffness: number
  }
}

export type FsusWheelDeltaOptions = {
  deltaMode?: number
  discreteThresholdPx?: number
  lineSizePx?: number
  maxDiscreteDeltaPx?: number
  viewportSizePx?: number
}

type MotionValueLike<T extends string | number> = MotionValue<T>

type SpringOverrides = Partial<FsusMotionRuntime['spring']>

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
  spring: {
    damping: 28,
    mass: 0.9,
    stiffness: 260,
  },
}

const WHEEL_DELTA_PIXEL = 0
const WHEEL_DELTA_LINE = 1
const WHEEL_DELTA_PAGE = 2
const DEFAULT_WHEEL_LINE_SIZE_PX = 16
const DEFAULT_WHEEL_DISCRETE_THRESHOLD_PX = 72
const DEFAULT_WHEEL_MAX_DISCRETE_DELTA_PX = 48

export const normalizeFsusWheelDelta = (
  delta: number,
  options: FsusWheelDeltaOptions = {},
) => {
  if (!Number.isFinite(delta) || delta === 0) return 0

  const {
    deltaMode = WHEEL_DELTA_PIXEL,
    discreteThresholdPx = DEFAULT_WHEEL_DISCRETE_THRESHOLD_PX,
    lineSizePx = DEFAULT_WHEEL_LINE_SIZE_PX,
    maxDiscreteDeltaPx = DEFAULT_WHEEL_MAX_DISCRETE_DELTA_PX,
    viewportSizePx = 0,
  } = options

  const sign = Math.sign(delta)
  const absoluteDelta = Math.abs(delta)
  const pixelDelta =
    deltaMode === WHEEL_DELTA_LINE
      ? absoluteDelta * lineSizePx
      : deltaMode === WHEEL_DELTA_PAGE
        ? absoluteDelta * Math.max(viewportSizePx, lineSizePx)
        : absoluteDelta
  const isDiscreteWheel =
    deltaMode !== WHEEL_DELTA_PIXEL || pixelDelta >= discreteThresholdPx
  const resolvedDelta = isDiscreteWheel
    ? Math.min(pixelDelta, maxDiscreteDeltaPx)
    : pixelDelta

  return sign * resolvedDelta
}

const presetSpring: Record<FsusMotionPreset, FsusMotionRuntime['spring']> = {
  standard: defaultRuntime.spring,
  smooth: {
    damping: 30,
    mass: 0.82,
    stiffness: 300,
  },
  expressive: {
    damping: 24,
    mass: 0.72,
    stiffness: 340,
  },
}

const readMs = (
  style: CSSStyleDeclaration,
  token: string,
  fallback: number,
) => {
  const value = style.getPropertyValue(token).trim()
  if (!value) return fallback
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return fallback
  return value.includes('ms') ? parsed : parsed * 1000
}

const readNumber = (
  style: CSSStyleDeclaration,
  token: string,
  fallback: number,
) => {
  const parsed = Number.parseFloat(style.getPropertyValue(token))
  return Number.isFinite(parsed) ? parsed : fallback
}

const getRoot = () =>
  typeof document === 'undefined' ? undefined : document.documentElement

export const getFsusMotionRuntime = (): FsusMotionRuntime => {
  const root = getRoot()
  if (!root || typeof window === 'undefined') return defaultRuntime

  const style = getComputedStyle(root)
  const configuredMode = root.dataset.fsusMotion as FsusMotionMode | undefined
  const mode =
    configuredMode ??
    (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ? 'reduced'
      : 'enabled')
  const preset =
    (root.dataset.fsusMotionPreset as FsusMotionPreset | undefined) ??
    'standard'
  const enabled = mode === 'enabled'
  const spring = presetSpring[preset] ?? defaultRuntime.spring

  return {
    controlFastMs: enabled
      ? readMs(
          style,
          '--fsus-motion-control-fast',
          defaultRuntime.controlFastMs,
        )
      : 1,
    controlMs: enabled
      ? readMs(style, '--fsus-motion-control', defaultRuntime.controlMs)
      : 1,
    disabled: mode === 'disabled',
    dragBlurPx: enabled
      ? readNumber(style, '--fsus-motion-drag-blur', defaultRuntime.dragBlurPx)
      : 0,
    dragMaxOffsetPx: enabled
      ? readNumber(
          style,
          '--fsus-motion-drag-max-offset',
          defaultRuntime.dragMaxOffsetPx,
        )
      : 0,
    dragScaleDelta: enabled
      ? readNumber(
          style,
          '--fsus-motion-drag-scale',
          defaultRuntime.dragScaleDelta,
        )
      : 0,
    dragTrailOpacity: enabled
      ? readNumber(
          style,
          '--fsus-motion-drag-trail-opacity',
          defaultRuntime.dragTrailOpacity,
        )
      : 0,
    enabled,
    mode,
    preset,
    reduced: mode === 'reduced' || mode === 'disabled',
    scrollMaxOffsetPx: enabled
      ? readNumber(
          style,
          '--fsus-motion-scroll-max-offset',
          defaultRuntime.scrollMaxOffsetPx,
        )
      : 0,
    scrollIdleMs: enabled
      ? readMs(style, '--fsus-motion-scroll-idle', defaultRuntime.scrollIdleMs)
      : 1,
    scrollSettleMs: enabled
      ? readMs(
          style,
          '--fsus-motion-scroll-settle',
          defaultRuntime.scrollSettleMs,
        )
      : 1,
    scrollTrailOpacity: enabled
      ? readNumber(
          style,
          '--fsus-motion-scroll-trail-opacity',
          defaultRuntime.scrollTrailOpacity,
        )
      : 0,
    spring: {
      damping: enabled
        ? readNumber(style, '--fsus-motion-spring-damping', spring.damping)
        : 1,
      mass: enabled
        ? readNumber(style, '--fsus-motion-spring-mass', spring.mass)
        : 1,
      stiffness: enabled
        ? readNumber(style, '--fsus-motion-spring-stiffness', spring.stiffness)
        : 1000,
    },
  }
}

export const useFsusMotionRuntime = (): ComputedRef<FsusMotionRuntime> => {
  const runtime = ref(getFsusMotionRuntime())
  let removeMediaListener: (() => void) | undefined
  let observer: MutationObserver | undefined

  const refresh = () => {
    runtime.value = getFsusMotionRuntime()
  }

  onMounted(() => {
    const root = getRoot()
    if (!root || typeof window === 'undefined') return

    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const handleMediaChange = () => refresh()
    if (media) {
      if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', handleMediaChange)
        removeMediaListener = () =>
          media.removeEventListener('change', handleMediaChange)
      } else {
        media.addListener(handleMediaChange)
        removeMediaListener = () => media.removeListener(handleMediaChange)
      }
    }

    observer = new MutationObserver(refresh)
    observer.observe(root, {
      attributeFilter: [
        'data-fsus-motion',
        'data-fsus-motion-mode',
        'data-fsus-motion-preset',
        'style',
      ],
      attributes: true,
    })
    refresh()
  })

  onBeforeUnmount(() => {
    removeMediaListener?.()
    observer?.disconnect()
  })

  return computed(() => runtime.value)
}

export const useFsusReducedMotion = () => {
  const runtime = useFsusMotionRuntime()
  return computed(() => runtime.value.reduced)
}

export const fsusDecayOverflow = (input: number, max = 24): number => {
  if (max <= 0) return 0
  const entry = Math.max(0, input) / max
  const sigmoid = 2 * (1 / (1 + Math.exp(-entry)) - 0.5)
  return sigmoid * max
}

export type FsusInteractiveMotionMetrics = {
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

export type FsusInteractiveMotionAxis = 'x' | 'y' | 'both'

export type FsusInteractiveMotionInput = {
  axis?: FsusInteractiveMotionAxis
  deltaX?: number
  deltaY?: number
  elapsedMs?: number
  heavyDom?: boolean
  kind?: FsusInteractiveMotionKind
  runtime?: Partial<FsusMotionRuntime>
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const zeroInteractiveMotion = (): FsusInteractiveMotionMetrics => ({
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
})

const motionKindMultiplier: Record<FsusInteractiveMotionKind, number> = {
  scroll: 0.9,
  drag: 1,
  slider: 1,
  color: 0.95,
  carousel: 1.08,
  switch: 0.82,
  spinner: 0.68,
  touch: 0.75,
}

export const resolveFsusInteractiveMotion = ({
  axis = 'both',
  deltaX = 0,
  deltaY = 0,
  elapsedMs = 16,
  heavyDom = false,
  kind = 'scroll',
  runtime = defaultRuntime,
}: FsusInteractiveMotionInput): FsusInteractiveMotionMetrics => {
  const resolvedRuntime = {
    ...defaultRuntime,
    ...runtime,
  }
  if (!resolvedRuntime.enabled) return zeroInteractiveMotion()

  const distance = Math.hypot(deltaX, deltaY)
  if (distance <= 0) return zeroInteractiveMotion()

  const safeElapsed = clamp(elapsedMs, 8, 120)
  const velocity = distance / safeElapsed
  const velocityStrength = clamp(velocity / 1.25, 0, 1)
  const distanceStrength = clamp(distance / 96, 0, 1)
  const kindMultiplier = motionKindMultiplier[kind] ?? 1
  const strength = clamp(
    (velocityStrength * 0.72 + distanceStrength * 0.28) * kindMultiplier,
    0.16,
    1,
  )
  const rawMaxOffset =
    kind === 'scroll' || kind === 'spinner'
      ? resolvedRuntime.scrollMaxOffsetPx
      : resolvedRuntime.dragMaxOffsetPx
  const maxOffset = heavyDom
    ? Math.min(Math.max(rawMaxOffset, 0), 1.35)
    : Math.max(rawMaxOffset, 0)
  const offsetPx = maxOffset * (0.35 + strength * 0.65)
  const useX = axis === 'x' || axis === 'both'
  const useY = axis === 'y' || axis === 'both'
  const offsetX = useX && deltaX ? -Math.sign(deltaX) * offsetPx : 0
  const offsetY = useY && deltaY ? -Math.sign(deltaY) * offsetPx : 0
  const blurMultiplier = heavyDom ? 0 : kindMultiplier
  const trailBase =
    kind === 'scroll' || kind === 'spinner'
      ? resolvedRuntime.scrollTrailOpacity
      : resolvedRuntime.dragTrailOpacity

  return {
    edgeSizePx: 28 + strength * 28,
    glowSizePx: 12 + strength * 22,
    blurPx: resolvedRuntime.dragBlurPx * strength * blurMultiplier,
    offsetPx,
    offsetX,
    offsetY,
    scale: 1 + resolvedRuntime.dragScaleDelta * strength,
    settleMs: resolvedRuntime.scrollSettleMs,
    strength,
    thumbSpreadPx: 1 + strength * 3,
    trailOpacity: clamp(trailBase * strength, 0, 1),
  }
}

export const applyFsusInteractiveMotionVars = (
  element: HTMLElement | null | undefined,
  metrics: FsusInteractiveMotionMetrics,
) => {
  if (!element) return

  element.style.setProperty(
    '--fsus-interactive-motion-strength',
    metrics.strength.toFixed(3),
  )
  element.style.setProperty(
    '--fsus-interactive-motion-offset-x',
    `${metrics.offsetX.toFixed(2)}px`,
  )
  element.style.setProperty(
    '--fsus-interactive-motion-offset-y',
    `${metrics.offsetY.toFixed(2)}px`,
  )
  element.style.setProperty(
    '--fsus-interactive-motion-glow',
    `${metrics.glowSizePx.toFixed(2)}px`,
  )
  element.style.setProperty(
    '--fsus-interactive-motion-blur',
    `${metrics.blurPx.toFixed(2)}px`,
  )
  element.style.setProperty(
    '--fsus-interactive-motion-scale',
    metrics.scale.toFixed(3),
  )
  element.style.setProperty(
    '--fsus-interactive-motion-trail-opacity',
    metrics.trailOpacity.toFixed(3),
  )
  element.style.setProperty(
    '--fsus-interactive-motion-edge-size',
    `${metrics.edgeSizePx.toFixed(2)}px`,
  )
  element.style.setProperty(
    '--fsus-interactive-motion-thumb-spread',
    `${metrics.thumbSpreadPx.toFixed(2)}px`,
  )
  element.style.setProperty(
    '--fsus-interactive-motion-settle',
    `${metrics.settleMs.toFixed(0)}ms`,
  )
}

export const resetFsusInteractiveMotionVars = (
  element: HTMLElement | null | undefined,
) => applyFsusInteractiveMotionVars(element, zeroInteractiveMotion())

export const useFsusMotionValue = <T extends string | number>(
  initial: MaybeRef<T>,
) => {
  const motionValue = createMotionValue(unref(initial))
  const value = shallowRef(motionValue.get()) as Ref<T>

  const unsubscribe = motionValue.on('change', (latest) => {
    value.value = latest
  })

  if (isRef(initial)) {
    watch(initial, (next) => {
      motionValue.set(next)
    })
  }

  onBeforeUnmount(() => {
    unsubscribe()
    motionValue.destroy()
  })

  return {
    motionValue,
    set: (next: T) => motionValue.set(next),
    jump: (next: T) => motionValue.jump(next),
    stop: () => motionValue.stop(),
    value,
  }
}

export const useFsusSpring = (
  initial: MaybeRef<number>,
  overrides: MaybeRef<SpringOverrides> = {},
) => {
  const runtime = useFsusMotionRuntime()
  const source = createMotionValue(unref(initial))
  const spring = createSpringValue(source, {
    ...runtime.value.spring,
    ...unref(overrides),
  }) as MotionValueLike<number>
  const value = shallowRef(spring.get()) as Ref<number>

  const unsubscribe = spring.on('change', (latest) => {
    value.value = latest
  })

  const set = (next: number) => {
    if (runtime.value.enabled) {
      source.set(next)
      return
    }

    source.jump(next)
    spring.jump(next)
    value.value = next
  }

  const jump = (next: number) => {
    source.jump(next)
    spring.jump(next)
    value.value = next
  }

  if (isRef(initial)) {
    watch(initial, set)
  }

  onBeforeUnmount(() => {
    unsubscribe()
    spring.destroy()
    source.destroy()
  })

  return {
    motionValue: spring,
    jump,
    set,
    source,
    stop: () => {
      spring.stop()
      source.stop()
    },
    value,
  }
}

export const useFsusVelocity = (source: MotionValueLike<number>) => {
  const velocity = createMotionValue(
    source.getVelocity(),
  ) as MotionValueLike<number>
  const value = shallowRef(velocity.get()) as Ref<number>
  const unsubscribe = velocity.on('change', (latest) => {
    value.value = latest
  })
  const unsubscribeSource = source.on('change', () => {
    velocity.set(source.getVelocity())
  })

  onBeforeUnmount(() => {
    unsubscribe()
    unsubscribeSource()
    velocity.destroy()
  })

  return {
    motionValue: velocity,
    value,
  }
}

export type FsusDragPoint = {
  x: number
  y: number
}

export const useFsusDrag = () => {
  const isDragging = ref(false)
  const velocity = ref(0)
  const lastPoint = ref<FsusDragPoint>()
  const startPoint = ref<FsusDragPoint>()
  let lastTime = 0

  const start = (point: FsusDragPoint, now = performance.now()) => {
    isDragging.value = true
    velocity.value = 0
    startPoint.value = point
    lastPoint.value = point
    lastTime = now
  }

  const move = (point: FsusDragPoint, now = performance.now()) => {
    const previousPoint = lastPoint.value ?? point
    const elapsed = Math.max(now - lastTime, 1)
    const deltaX = point.x - previousPoint.x
    const deltaY = point.y - previousPoint.y
    velocity.value = Math.hypot(deltaX, deltaY) / elapsed
    lastPoint.value = point
    lastTime = now

    return {
      deltaX,
      deltaY,
      totalX: point.x - (startPoint.value?.x ?? point.x),
      totalY: point.y - (startPoint.value?.y ?? point.y),
      velocity: velocity.value,
    }
  }

  const end = () => {
    isDragging.value = false
    lastPoint.value = undefined
    startPoint.value = undefined
    return velocity.value
  }

  return {
    end,
    isDragging,
    move,
    start,
    velocity,
  }
}

export const useFsusInertia = () => {
  const runtime = useFsusMotionRuntime()
  let frame = 0

  const stop = () => {
    if (!frame) return
    cancelAnimationFrame(frame)
    frame = 0
  }

  const start = ({
    initialVelocity,
    onComplete,
    onUpdate,
  }: {
    initialVelocity: number
    onComplete?: () => void
    onUpdate: (delta: number) => void
  }) => {
    stop()
    if (!runtime.value.enabled || Math.abs(initialVelocity) < 0.01) {
      onComplete?.()
      return
    }

    let velocity = initialVelocity
    let previous = performance.now()
    const friction = runtime.value.preset === 'expressive' ? 0.93 : 0.9
    const tick = (now: number) => {
      const elapsed = Math.max(now - previous, 1)
      previous = now
      velocity *= Math.pow(friction, elapsed / 16)
      onUpdate(velocity * elapsed)

      if (Math.abs(velocity) < 0.01) {
        frame = 0
        onComplete?.()
        return
      }

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
  }

  onBeforeUnmount(stop)

  return {
    start,
    stop,
  }
}

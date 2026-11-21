import { resolveMotionPreference } from './preference'

export type ViewTransitionMode = 'native' | 'fallback'

export type ViewTransitionRunOptions = {
  name?: string
  disabled?: boolean
  skipWhenReduced?: boolean
  signal?: AbortSignal
}

export type ViewTransitionRunResult = {
  mode: ViewTransitionMode
  ready: Promise<void>
  updateDone: Promise<void>
  finished: Promise<void>
  skip: () => void
}

type NativeViewTransition = {
  ready: Promise<void>
  updateCallbackDone: Promise<void>
  finished: Promise<void>
  skipTransition: () => void
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (
    update: () => void | Promise<void>,
  ) => NativeViewTransition
}

type ViewTransitionStyle = CSSStyleDeclaration & {
  viewTransitionName: string
}

type ActiveViewTransition = {
  transition: NativeViewTransition
  originalName?: string
  originalSnapshotting?: string
}

type ActiveFallbackSnapshotting = {
  count: number
  originalSnapshotting?: string
}

const activeTransitions = new WeakMap<Document, ActiveViewTransition>()
const activeFallbackSnapshotting = new WeakMap<
  Document,
  ActiveFallbackSnapshotting
>()
const activeNames = new Map<string, Element>()

const restoreDatasetAttribute = (
  root: HTMLElement,
  key: 'fsusViewTransition' | 'fsusViewTransitionSnapshotting',
  original: string | undefined,
) => {
  if (original === undefined) delete root.dataset[key]
  else root.dataset[key] = original
}

const acquireFallbackSnapshotting = (
  targetDocument: Document,
  root: HTMLElement,
) => {
  const existing = activeFallbackSnapshotting.get(targetDocument)
  if (existing) {
    existing.count += 1
  } else {
    const activeNative = activeTransitions.get(targetDocument)
    const originalSnapshotting = activeNative
      ? activeNative.originalSnapshotting
      : root.dataset.fsusViewTransitionSnapshotting
    activeFallbackSnapshotting.set(targetDocument, {
      count: 1,
      originalSnapshotting,
    })
  }
  root.dataset.fsusViewTransitionSnapshotting = 'true'

  let released = false
  return () => {
    if (released) return
    released = true
    const entry = activeFallbackSnapshotting.get(targetDocument)
    if (!entry) return
    entry.count -= 1
    if (entry.count > 0) return
    activeFallbackSnapshotting.delete(targetDocument)
    if (!activeTransitions.has(targetDocument)) {
      void root.offsetHeight
      restoreDatasetAttribute(
        root,
        'fsusViewTransitionSnapshotting',
        entry.originalSnapshotting,
      )
    }
  }
}

const settle = (promise: Promise<unknown>) =>
  promise.then(
    () => undefined,
    () => undefined,
  )

const skipNativeTransition = (transition: NativeViewTransition) => {
  try {
    transition.skipTransition()
  } catch {
    // Snapshot cancellation is best effort and never owns the DOM update.
  }
}

const fallbackResult = (
  updateDone: Promise<void>,
): ViewTransitionRunResult => ({
  mode: 'fallback',
  ready: Promise.resolve(),
  updateDone,
  finished: settle(updateDone),
  skip: () => undefined,
})

export const normalizeViewTransitionName = (identity: string): string => {
  const input = identity.trim()
  let hash = 2166136261
  for (const character of input) {
    hash ^= character.codePointAt(0) ?? 0
    hash = Math.imul(hash, 16777619)
  }
  const slug = input
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 48)

  return `fsus-${slug || 'shared'}-${(hash >>> 0).toString(36)}`
}

export const acquireViewTransitionName = (
  element: HTMLElement,
  identity: string,
) => {
  const name = normalizeViewTransitionName(identity)
  const owner = activeNames.get(name)
  if (owner && owner !== element) {
    throw new Error(`Duplicate View Transition identity: ${identity}`)
  }

  const style = element.style as ViewTransitionStyle
  const previous = style.viewTransitionName
  activeNames.set(name, element)
  style.viewTransitionName = name
  let released = false

  return () => {
    if (released) return
    released = true
    if (activeNames.get(name) === element) activeNames.delete(name)
    style.viewTransitionName = previous
  }
}

export const canUseNativeViewTransitions = (
  options: ViewTransitionRunOptions = {},
) => {
  if (typeof document === 'undefined') return false
  const preference = resolveMotionPreference(options.disabled)
  if (preference.disabled) return false
  if (options.skipWhenReduced !== false && preference.reduced) return false
  if (options.signal?.aborted) return false
  return (
    typeof (document as ViewTransitionDocument).startViewTransition ===
    'function'
  )
}

export const runViewTransition = (
  update: () => void | Promise<void>,
  options: ViewTransitionRunOptions = {},
): ViewTransitionRunResult => {
  let called = false
  let updateDone: Promise<void> | undefined

  const invokeUpdate = () => {
    if (called) return updateDone as Promise<void>
    called = true
    try {
      updateDone = Promise.resolve(update())
    } catch (error) {
      updateDone = Promise.reject(error)
    }
    return updateDone
  }

  const runFallbackUpdate = () => {
    const targetDocument =
      typeof document === 'undefined' ? undefined : document
    const root = targetDocument?.documentElement
    const release =
      targetDocument && root
        ? acquireFallbackSnapshotting(targetDocument, root)
        : undefined

    if (called) {
      return (updateDone as Promise<void>).then(
        () => {
          release?.()
        },
        (error) => {
          release?.()
          throw error
        },
      )
    }

    called = true
    let raw: void | Promise<void>
    try {
      raw = update()
    } catch (error) {
      release?.()
      updateDone = Promise.reject(error)
      return updateDone
    }

    updateDone = Promise.resolve(raw).then(
      () => {
        release?.()
      },
      (error) => {
        release?.()
        throw error
      },
    )
    return updateDone
  }

  if (!canUseNativeViewTransitions(options)) {
    return fallbackResult(runFallbackUpdate())
  }

  const targetDocument = document as ViewTransitionDocument
  const root = targetDocument.documentElement
  const transitionName = options.name
    ? normalizeViewTransitionName(options.name)
    : undefined
  const previousActive = activeTransitions.get(targetDocument)
  const previousFallback = activeFallbackSnapshotting.get(targetDocument)
  const previousName = root.dataset.fsusViewTransition
  const originalName = previousActive
    ? previousActive.originalName
    : previousName
  const previousSnapshotting = root.dataset.fsusViewTransitionSnapshotting
  const originalSnapshotting = previousActive
    ? previousActive.originalSnapshotting
    : previousFallback
      ? previousFallback.originalSnapshotting
      : previousSnapshotting
  if (transitionName) root.dataset.fsusViewTransition = transitionName

  if (previousActive) skipNativeTransition(previousActive.transition)

  let nativeTransition: NativeViewTransition | undefined
  let nativeFinished = false
  const invokeNativeUpdate = () => {
    const holdUntilFinished =
      !nativeFinished &&
      (!nativeTransition ||
        activeTransitions.get(targetDocument)?.transition === nativeTransition)
    if (!holdUntilFinished) {
      return runFallbackUpdate()
    }
    root.dataset.fsusViewTransitionSnapshotting = 'true'
    return invokeUpdate()
  }

  try {
    nativeTransition = targetDocument.startViewTransition!(invokeNativeUpdate)
  } catch {
    if (transitionName) {
      restoreDatasetAttribute(root, 'fsusViewTransition', previousName)
    }
    restoreDatasetAttribute(
      root,
      'fsusViewTransitionSnapshotting',
      previousSnapshotting,
    )
    return fallbackResult(runFallbackUpdate())
  }

  activeTransitions.set(targetDocument, {
    transition: nativeTransition,
    originalName,
    originalSnapshotting,
  })
  let skipped = false
  const skip = () => {
    if (skipped) return
    skipped = true
    skipNativeTransition(nativeTransition!)
  }
  const onAbort = () => skip()
  const onVisibilityChange = () => {
    if (targetDocument.visibilityState === 'hidden') skip()
  }
  options.signal?.addEventListener('abort', onAbort, { once: true })
  targetDocument.addEventListener('visibilitychange', onVisibilityChange)

  const ready = settle(nativeTransition.ready)
  const nativeUpdateDone = nativeTransition.updateCallbackDone
  const finished = settle(nativeTransition.finished)
  void finished.then(() => {
    nativeFinished = true
    options.signal?.removeEventListener('abort', onAbort)
    targetDocument.removeEventListener('visibilitychange', onVisibilityChange)
    if (
      activeTransitions.get(targetDocument)?.transition === nativeTransition
    ) {
      activeTransitions.delete(targetDocument)
      restoreDatasetAttribute(root, 'fsusViewTransition', originalName)
      if (!activeFallbackSnapshotting.has(targetDocument)) {
        restoreDatasetAttribute(
          root,
          'fsusViewTransitionSnapshotting',
          originalSnapshotting,
        )
      }
    }
  })

  return {
    mode: 'native',
    ready,
    updateDone: nativeUpdateDone,
    finished,
    skip,
  }
}

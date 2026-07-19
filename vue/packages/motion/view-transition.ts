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
}

const activeTransitions = new WeakMap<Document, ActiveViewTransition>()
const activeNames = new Map<string, Element>()

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

  if (!canUseNativeViewTransitions(options)) {
    return fallbackResult(invokeUpdate())
  }

  const targetDocument = document as ViewTransitionDocument
  const root = targetDocument.documentElement
  const transitionName = options.name
    ? normalizeViewTransitionName(options.name)
    : undefined
  const previousActive = activeTransitions.get(targetDocument)
  const previousName = root.dataset.fsusViewTransition
  const originalName = previousActive?.originalName ?? previousName
  if (transitionName) root.dataset.fsusViewTransition = transitionName

  if (previousActive) skipNativeTransition(previousActive.transition)

  let nativeTransition: NativeViewTransition
  try {
    nativeTransition = targetDocument.startViewTransition!(invokeUpdate)
  } catch {
    if (transitionName) {
      if (previousName === undefined) delete root.dataset.fsusViewTransition
      else root.dataset.fsusViewTransition = previousName
    }
    return fallbackResult(invokeUpdate())
  }

  activeTransitions.set(targetDocument, {
    transition: nativeTransition,
    originalName,
  })
  let skipped = false
  const skip = () => {
    if (skipped) return
    skipped = true
    skipNativeTransition(nativeTransition)
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
    options.signal?.removeEventListener('abort', onAbort)
    targetDocument.removeEventListener('visibilitychange', onVisibilityChange)
    if (
      activeTransitions.get(targetDocument)?.transition === nativeTransition
    ) {
      activeTransitions.delete(targetDocument)
      if (originalName === undefined) delete root.dataset.fsusViewTransition
      else root.dataset.fsusViewTransition = originalName
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

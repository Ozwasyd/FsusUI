import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  acquireViewTransitionName,
  normalizeViewTransitionName,
  runMotionRecipeUpdate,
  runViewTransition,
  useSharedElementMotion,
} from '..'

type Deferred = {
  promise: Promise<void>
  resolve: () => void
  reject: (reason?: unknown) => void
}

const deferred = (): Deferred => {
  let resolve!: () => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<void>((accept, decline) => {
    resolve = accept
    reject = decline
  })
  return { promise, resolve, reject }
}

const installNativeTransition = () => {
  const transitions: Array<{
    callback: () => void | Promise<void>
    finished: Deferred
    skipTransition: ReturnType<typeof vi.fn>
    updateCallbackDone: Promise<void>
  }> = []

  Object.defineProperty(document, 'startViewTransition', {
    configurable: true,
    value: vi.fn((callback: () => void | Promise<void>) => {
      const finished = deferred()
      const updateCallbackDone = Promise.resolve().then(callback)
      const skipTransition = vi.fn(() => finished.resolve())
      const transition = {
        callback,
        finished,
        skipTransition,
        updateCallbackDone,
      }
      transitions.push(transition)
      void updateCallbackDone.then(finished.resolve, finished.reject)
      return {
        ready: Promise.resolve(),
        updateCallbackDone,
        finished: finished.promise,
        skipTransition,
      }
    }),
  })
  return transitions
}

describe('View Transitions progressive enhancement', () => {
  beforeEach(() => {
    document.documentElement.dataset.fsusMotion = 'enabled'
    delete document.documentElement.dataset.fsusViewTransition
  })

  afterEach(() => {
    Reflect.deleteProperty(document, 'startViewTransition')
    delete document.documentElement.dataset.fsusMotion
    delete document.documentElement.dataset.fsusViewTransition
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('runs the update exactly once in unsupported, disabled and reduced fallback modes', async () => {
    for (const mode of ['enabled', 'reduced', 'disabled']) {
      document.documentElement.dataset.fsusMotion = mode
      const update = vi.fn()
      const result = runViewTransition(update)

      expect(result.mode).toBe('fallback')
      await result.updateDone
      await result.finished
      expect(update).toHaveBeenCalledTimes(1)
    }
  })

  it('uses the native API without exposing it and cleans run state', async () => {
    installNativeTransition()
    const update = vi.fn()
    const result = runViewTransition(update, { name: 'route crossfade' })

    expect(result.mode).toBe('native')
    expect(document.documentElement.dataset.fsusViewTransition).toBe(
      normalizeViewTransitionName('route crossfade'),
    )
    await result.updateDone
    await result.finished
    expect(update).toHaveBeenCalledTimes(1)
    expect(document.documentElement.dataset.fsusViewTransition).toBeUndefined()
  })

  it('falls back after a synchronous platform exception without replaying update', async () => {
    const update = vi.fn()
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: () => {
        throw new Error('snapshot unavailable')
      },
    })

    const result = runViewTransition(update)
    expect(result.mode).toBe('fallback')
    await result.updateDone
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('reports update rejection while always settling finished cleanup', async () => {
    const error = new Error('business update rejected')
    const result = runViewTransition(() => Promise.reject(error))

    await expect(result.updateDone).rejects.toBe(error)
    await expect(result.finished).resolves.toBeUndefined()
  })

  it('skips aborts and replaces overlapping native transitions without hanging', async () => {
    const transitions = installNativeTransition()
    document.documentElement.dataset.fsusViewTransition = 'consumer-owned'
    const first = runViewTransition(() => undefined, { name: 'first' })
    const controller = new AbortController()
    const second = runViewTransition(() => undefined, {
      signal: controller.signal,
    })

    expect(transitions[0].skipTransition).toHaveBeenCalledTimes(1)
    controller.abort()
    expect(transitions[1].skipTransition).toHaveBeenCalledTimes(1)
    await Promise.all([first.finished, second.finished])
    expect(document.documentElement.dataset.fsusViewTransition).toBe(
      'consumer-owned',
    )
  })

  it('skips the native snapshot when the page becomes hidden', async () => {
    const transitions = installNativeTransition()
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden')
    const result = runViewTransition(() => undefined)

    document.dispatchEvent(new Event('visibilitychange'))
    expect(transitions[0].skipTransition).toHaveBeenCalledTimes(1)
    await result.finished
    visibility.mockRestore()
  })

  it('normalizes shared identities, rejects collisions and restores inline style', () => {
    const first = document.createElement('div')
    const second = document.createElement('div')
    first.style.setProperty('view-transition-name', 'consumer-name')
    const release = acquireViewTransitionName(first, 'Article / 42')

    expect(first.style.getPropertyValue('view-transition-name')).toMatch(
      /^fsus-article-42-/u,
    )
    expect(() => acquireViewTransitionName(second, 'Article / 42')).toThrow(
      /Duplicate View Transition identity/u,
    )

    release()
    expect(first.style.getPropertyValue('view-transition-name')).toBe(
      'consumer-name',
    )
  })

  it('selects one recipe backend and uses FLIP only when native is unavailable', async () => {
    installNativeTransition()
    const nativeUpdate = vi.fn()
    const native = runMotionRecipeUpdate(nativeUpdate, 'route-crossfade')
    expect(native.mode).toBe('native')
    await native.finished
    expect(nativeUpdate).toHaveBeenCalledTimes(1)

    const source = document.createElement('div')
    document.body.append(source)
    const animate = vi.fn(() => ({ cancel: vi.fn(), finish: vi.fn() }))
    Object.defineProperty(source, 'animate', {
      configurable: true,
      value: animate,
    })
    const shared = useSharedElementMotion({ backend: 'flip' })
    shared.register('cover-42', source)
    const fallback = shared.run('cover-42', async () => nextTick())
    await fallback.finished
    await nextTick()
    expect(fallback.mode).toBe('fallback')
    expect(animate).toHaveBeenCalledTimes(1)
  })
})

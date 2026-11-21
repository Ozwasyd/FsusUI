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
    delete document.documentElement.dataset.fsusViewTransitionSnapshotting
  })

  afterEach(() => {
    Reflect.deleteProperty(document, 'startViewTransition')
    delete document.documentElement.dataset.fsusMotion
    delete document.documentElement.dataset.fsusViewTransition
    delete document.documentElement.dataset.fsusViewTransitionSnapshotting
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

  it('cleans an initially absent root name after overlapping named native transitions', async () => {
    const transitions = installNativeTransition()
    const first = runViewTransition(() => undefined, { name: 'first' })
    const second = runViewTransition(() => undefined, { name: 'second' })

    expect(transitions[0].skipTransition).toHaveBeenCalledTimes(1)
    expect(document.documentElement.dataset.fsusViewTransition).toBe(
      normalizeViewTransitionName('second'),
    )
    await Promise.all([first.finished, second.finished])
    expect(document.documentElement.dataset.fsusViewTransition).toBeUndefined()
  })

  it('keeps an initially absent root name unset through repeated overlap and abort', async () => {
    const transitions = installNativeTransition()
    const first = runViewTransition(() => undefined, { name: 'first' })
    const second = runViewTransition(() => undefined, { name: 'second' })
    const controller = new AbortController()
    const third = runViewTransition(() => undefined, {
      name: 'third',
      signal: controller.signal,
    })
    controller.abort()

    expect(transitions[0].skipTransition).toHaveBeenCalledTimes(1)
    expect(transitions[1].skipTransition).toHaveBeenCalledTimes(1)
    expect(transitions[2].skipTransition).toHaveBeenCalledTimes(1)
    await Promise.all([first.finished, second.finished, third.finished])
    expect(document.documentElement.dataset.fsusViewTransition).toBeUndefined()
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

  it('tracks data-fsus-view-transition-snapshotting across the native lifecycle until finished', async () => {
    const manualFinished = deferred()
    let seenInsideUpdate: string | undefined

    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: vi.fn((callback: () => void | Promise<void>) => {
        const updateCallbackDone = Promise.resolve().then(callback)
        return {
          ready: Promise.resolve(),
          updateCallbackDone,
          finished: manualFinished.promise,
          skipTransition: vi.fn(() => manualFinished.resolve()),
        }
      }),
    })

    const result = runViewTransition(() => {
      seenInsideUpdate =
        document.documentElement.dataset.fsusViewTransitionSnapshotting
    })

    // Old snapshot captures before callback runs
    expect(
      document.documentElement.dataset.fsusViewTransitionSnapshotting,
    ).toBeUndefined()

    await result.updateDone
    expect(seenInsideUpdate).toBe('true')
    // Stays active while view-transition pseudo-elements animate
    expect(
      document.documentElement.dataset.fsusViewTransitionSnapshotting,
    ).toBe('true')

    manualFinished.resolve()
    await result.finished
    expect(
      document.documentElement.dataset.fsusViewTransitionSnapshotting,
    ).toBeUndefined()
  })

  it('preserves snapshotting across native overlap, abort, skip, rejection, and sync platform throw', async () => {
    const transitions: Array<{
      finished: Deferred
      skipTransition: ReturnType<typeof vi.fn>
    }> = []

    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: vi.fn((callback: () => void | Promise<void>) => {
        const finished = deferred()
        const updateCallbackDone = Promise.resolve().then(callback)
        const skipTransition = vi.fn(() => finished.resolve())
        transitions.push({ finished, skipTransition })
        return {
          ready: Promise.resolve(),
          updateCallbackDone,
          finished: finished.promise,
          skipTransition,
        }
      }),
    })

    document.documentElement.dataset.fsusViewTransitionSnapshotting =
      'consumer-owned'
    const first = runViewTransition(() => undefined, { name: 'first' })
    await first.updateDone
    expect(
      document.documentElement.dataset.fsusViewTransitionSnapshotting,
    ).toBe('true')

    const controller = new AbortController()
    const second = runViewTransition(() => undefined, {
      name: 'second',
      signal: controller.signal,
    })
    // First finishing must not prematurely restore while second is active
    await first.finished
    await second.updateDone
    expect(
      document.documentElement.dataset.fsusViewTransitionSnapshotting,
    ).toBe('true')

    controller.abort()
    await second.finished
    expect(
      document.documentElement.dataset.fsusViewTransitionSnapshotting,
    ).toBe('consumer-owned')

    // Native update rejection still restores pre-existing attribute on finished
    const err = new Error('native update rejected')
    const rejected = runViewTransition(() => Promise.reject(err))
    await expect(rejected.updateDone).rejects.toBe(err)
    transitions[2].finished.resolve()
    await rejected.finished
    expect(
      document.documentElement.dataset.fsusViewTransitionSnapshotting,
    ).toBe('consumer-owned')

    // Synchronous platform exception after invoking callback falls back without replaying update
    delete document.documentElement.dataset.fsusViewTransitionSnapshotting
    const syncThrowUpdate = vi.fn()
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: (callback: () => void | Promise<void>) => {
        void callback()
        throw new Error('sync throw after callback')
      },
    })
    const recovered = runViewTransition(syncThrowUpdate)
    expect(recovered.mode).toBe('fallback')
    expect(syncThrowUpdate).toHaveBeenCalledTimes(1)
    await recovered.updateDone
    expect(
      document.documentElement.dataset.fsusViewTransitionSnapshotting,
    ).toBeUndefined()
  })

  it('flushes and releases fallback snapshotting before updateDone resolves for sync, async, throw, and consumer values', async () => {
    const root = document.documentElement
    const flushes: Array<string | undefined> = []
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      root,
      'offsetHeight',
    )
    Object.defineProperty(root, 'offsetHeight', {
      configurable: true,
      get() {
        flushes.push(root.dataset.fsusViewTransitionSnapshotting)
        return 0
      },
    })

    try {
      // Sync fallback keeps attribute across microtask patch and releases before updateDone.then
      let seenDuringSyncUpdate: string | undefined
      let seenInUpdateDoneHandler: string | undefined
      const syncResult = runViewTransition(() => {
        seenDuringSyncUpdate = root.dataset.fsusViewTransitionSnapshotting
      })
      expect(syncResult.mode).toBe('fallback')
      expect(seenDuringSyncUpdate).toBe('true')
      expect(root.dataset.fsusViewTransitionSnapshotting).toBe('true')

      await syncResult.updateDone.then(() => {
        seenInUpdateDoneHandler = root.dataset.fsusViewTransitionSnapshotting
      })
      expect(seenInUpdateDoneHandler).toBeUndefined()
      expect(flushes).toEqual(['true'])

      // Async fallback holds until promise settles, then flushes and releases before updateDone
      const pending = deferred()
      const asyncResult = runViewTransition(() => pending.promise)
      expect(root.dataset.fsusViewTransitionSnapshotting).toBe('true')
      await Promise.resolve()
      expect(root.dataset.fsusViewTransitionSnapshotting).toBe('true')
      pending.resolve()
      await asyncResult.updateDone
      expect(root.dataset.fsusViewTransitionSnapshotting).toBeUndefined()
      expect(flushes).toEqual(['true', 'true'])

      // Synchronous throw releases immediately and preserves consumer-owned value
      root.dataset.fsusViewTransitionSnapshotting = 'consumer-owned'
      const syncError = new Error('sync fallback boom')
      const thrownResult = runViewTransition(() => {
        throw syncError
      })
      expect(root.dataset.fsusViewTransitionSnapshotting).toBe('consumer-owned')
      await expect(thrownResult.updateDone).rejects.toBe(syncError)
      await expect(thrownResult.finished).resolves.toBeUndefined()

      // Overlapping async fallbacks settling out of order do not leak
      delete root.dataset.fsusViewTransitionSnapshotting
      const slow = deferred()
      const fast = deferred()
      const firstFallback = runViewTransition(() => slow.promise)
      const secondFallback = runViewTransition(() => fast.promise)
      fast.resolve()
      await secondFallback.updateDone
      expect(root.dataset.fsusViewTransitionSnapshotting).toBe('true')
      slow.resolve()
      await firstFallback.updateDone
      expect(root.dataset.fsusViewTransitionSnapshotting).toBeUndefined()
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(root, 'offsetHeight', originalDescriptor)
      } else {
        Reflect.deleteProperty(root, 'offsetHeight')
      }
    }
  })
})

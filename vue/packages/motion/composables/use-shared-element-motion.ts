import { getCurrentScope, onScopeDispose, unref } from 'vue'
import {
  measureFlipState,
  playFlipMotion,
  type FlipMotionOptions,
} from './use-flip-motion'
import {
  acquireViewTransitionName,
  canUseNativeViewTransitions,
  runViewTransition,
} from '../view-transition'
import type { Ref } from 'vue'
import type { MotionRuntimeControls } from '../types'
import type {
  ViewTransitionRunOptions,
  ViewTransitionRunResult,
} from '../view-transition'

export type SharedElementTarget =
  | HTMLElement
  | Ref<HTMLElement | undefined | null>
  | undefined
  | null

const registry = new Map<string, HTMLElement>()

const resolveSharedTarget = (target: SharedElementTarget) => unref(target)

export type SharedElementMotionOptions = FlipMotionOptions & {
  backend?: 'auto' | 'native' | 'flip'
}

export type SharedElementRunOptions = ViewTransitionRunOptions & {
  backend?: SharedElementMotionOptions['backend']
}

export const useSharedElementMotion = (
  options: SharedElementMotionOptions = {},
) => {
  const controls = new Set<MotionRuntimeControls>()
  const runs = new Set<ViewTransitionRunResult>()

  const register = (id: string, target: SharedElementTarget) => {
    const element = resolveSharedTarget(target)
    if (!element) return () => undefined

    const owner = registry.get(id)
    if (owner && owner !== element) {
      throw new Error(`Duplicate shared-element identity: ${id}`)
    }

    registry.set(id, element)
    element.dataset.fsusSharedElementId = id

    return () => {
      if (registry.get(id) === element) registry.delete(id)
      delete element.dataset.fsusSharedElementId
    }
  }

  const transition = (
    id: string,
    target: SharedElementTarget = registry.get(id),
  ) => {
    const source = registry.get(id)
    const destination = resolveSharedTarget(target)
    if (!source || !destination) return undefined

    const from = measureFlipState(source)
    const control = playFlipMotion(destination, from, options)
    controls.add(control)
    return control
  }

  const run = (
    id: string,
    update: () => void | Promise<void>,
    runOptions: SharedElementRunOptions = {},
  ) => {
    const source = registry.get(id)
    const from = measureFlipState(source)
    const backend = runOptions.backend ?? options.backend ?? 'auto'
    const nativeOptions = {
      ...runOptions,
      disabled: runOptions.disabled ?? options.disabled,
      name: runOptions.name ?? 'shared-element',
    }
    const useNative =
      backend !== 'flip' && canUseNativeViewTransitions(nativeOptions)
    let releaseSource: (() => void) | undefined
    let releaseDestination: (() => void) | undefined

    if (useNative && source) {
      releaseSource = acquireViewTransitionName(source, id)
    }

    const result = runViewTransition(
      async () => {
        await update()
        if (useNative) {
          releaseSource?.()
          releaseSource = undefined
          const destination = registry.get(id)
          if (destination) {
            releaseDestination = acquireViewTransitionName(destination, id)
          }
        }
      },
      useNative ? nativeOptions : { ...nativeOptions, disabled: true },
    )

    runs.add(result)
    void result.updateDone.then(
      () => {
        if (result.mode !== 'fallback') return
        const destination = registry.get(id)
        if (!destination) return
        const control = playFlipMotion(destination, from, {
          duration: options.duration,
          easing: options.easing,
          disabled: nativeOptions.disabled,
        })
        controls.add(control)
      },
      () => undefined,
    )
    void result.finished.then(() => {
      releaseDestination?.()
      releaseSource?.()
      runs.delete(result)
    })
    return result
  }

  const kill = () => {
    for (const control of controls) {
      control.cancel()
    }
    controls.clear()
    for (const result of runs) result.skip()
    runs.clear()
  }

  if (getCurrentScope()) {
    onScopeDispose(kill)
  }

  return {
    register,
    transition,
    run,
    kill,
    registry,
  }
}

export default useSharedElementMotion

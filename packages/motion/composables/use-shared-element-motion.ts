import { getCurrentScope, onScopeDispose, unref } from 'vue'
import {
  measureFlipState,
  playFlipMotion,
  type FlipMotionOptions,
} from './use-flip-motion'
import type { Ref } from 'vue'
import type { MotionRuntimeControls } from '../types'

export type SharedElementTarget =
  | HTMLElement
  | Ref<HTMLElement | undefined | null>
  | undefined
  | null

const registry = new Map<string, HTMLElement>()

const resolveSharedTarget = (target: SharedElementTarget) => unref(target)

export const useSharedElementMotion = (options: FlipMotionOptions = {}) => {
  const controls = new Set<MotionRuntimeControls>()

  const register = (id: string, target: SharedElementTarget) => {
    const element = resolveSharedTarget(target)
    if (!element) return () => undefined

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

  const kill = () => {
    for (const control of controls) {
      control.cancel()
    }
    controls.clear()
  }

  if (getCurrentScope()) {
    onScopeDispose(kill)
  }

  return {
    register,
    transition,
    kill,
    registry,
  }
}

export default useSharedElementMotion

import { getCurrentScope, onScopeDispose } from 'vue'
import { runViewTransition } from '../view-transition'
import type {
  ViewTransitionRunOptions,
  ViewTransitionRunResult,
} from '../view-transition'

export const useViewTransition = () => {
  const runs = new Set<ViewTransitionRunResult>()

  const run = (
    update: () => void | Promise<void>,
    options?: ViewTransitionRunOptions,
  ) => {
    const result = runViewTransition(update, options)
    runs.add(result)
    void result.finished.then(() => runs.delete(result))
    return result
  }

  const skip = () => {
    for (const result of runs) result.skip()
    runs.clear()
  }

  if (getCurrentScope()) onScopeDispose(skip)

  return { run, skip }
}

export default useViewTransition

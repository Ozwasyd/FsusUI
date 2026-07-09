import { getCurrentScope, onScopeDispose } from 'vue'
import { refreshScrollTriggers } from '../gsap/register'

export type MotionRouteCleanup = () => void

export const createMotionRouteCleanup = () => {
  const cleanups = new Set<MotionRouteCleanup>()

  const add = (cleanup: MotionRouteCleanup) => {
    cleanups.add(cleanup)
    return () => cleanups.delete(cleanup)
  }

  const cleanup = () => {
    for (const run of cleanups) {
      run()
    }
    cleanups.clear()
    refreshScrollTriggers()
  }

  return {
    add,
    cleanup,
    get size() {
      return cleanups.size
    },
  }
}

export const useMotionRouteCleanup = () => {
  const routeCleanup = createMotionRouteCleanup()

  if (getCurrentScope()) {
    onScopeDispose(routeCleanup.cleanup)
  }

  return routeCleanup
}

export default useMotionRouteCleanup

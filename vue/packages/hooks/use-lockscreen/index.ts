import { computed, isRef, onScopeDispose, watch } from 'vue'
import {
  addClass,
  getScrollBarWidth,
  getStyle,
  hasClass,
  isClient,
  removeClass,
  throwError,
} from '@element-plus/utils'
import { useNamespace } from '../use-namespace'

import type { Ref } from 'vue'
import type { UseNamespaceReturn } from '../use-namespace'

export type UseLockScreenOptions = {
  ns?: UseNamespaceReturn
  // shouldLock?: MaybeRef<boolean>
}

type NamespaceLockState = {
  count: number
  classAddedByUs: boolean
}

const namespaceLockStates = new Map<string, NamespaceLockState>()
let bodyLockCount = 0
let bodyWidth = ''
let bodyWidthAdjusted = false
let cleanupTimer: ReturnType<typeof setTimeout> | undefined

const clearCleanupTimer = () => {
  if (cleanupTimer) {
    clearTimeout(cleanupTimer)
    cleanupTimer = undefined
  }
}

const syncBodyLockState = () => {
  if (!isClient || typeof document === 'undefined') {
    return
  }

  for (const [hiddenCls, state] of namespaceLockStates) {
    if (state.count === 0) {
      if (state.classAddedByUs) {
        removeClass(document.body, hiddenCls)
      }
      namespaceLockStates.delete(hiddenCls)
    }
  }

  if (bodyLockCount === 0 && bodyWidthAdjusted) {
    document.body.style.width = bodyWidth
    bodyWidthAdjusted = false
  }
}

const acquireBodyLock = (hiddenCls: string, namespace: string) => {
  if (!isClient || typeof document === 'undefined') {
    return
  }

  clearCleanupTimer()

  const lockState = namespaceLockStates.get(hiddenCls) ?? {
    count: 0,
    classAddedByUs: false,
  }

  if (lockState.count === 0) {
    lockState.classAddedByUs = !hasClass(document.body, hiddenCls)
    if (lockState.classAddedByUs) {
      addClass(document.body, hiddenCls)
    }
  }

  if (bodyLockCount === 0) {
    bodyWidth = document.body.style.width
    bodyWidthAdjusted = false

    const scrollBarWidth = getScrollBarWidth(namespace)
    const bodyHasOverflow =
      document.documentElement.clientHeight < document.body.scrollHeight
    const bodyOverflowY = getStyle(document.body, 'overflowY')

    if (scrollBarWidth > 0 && (bodyHasOverflow || bodyOverflowY === 'scroll')) {
      document.body.style.width = `calc(100% - ${scrollBarWidth}px)`
      bodyWidthAdjusted = true
    }
  }

  lockState.count += 1
  bodyLockCount += 1
  namespaceLockStates.set(hiddenCls, lockState)
}

const releaseBodyLock = (hiddenCls: string) => {
  const lockState = namespaceLockStates.get(hiddenCls)
  if (!lockState) {
    return
  }

  if (lockState.count > 0) {
    lockState.count -= 1
  }

  if (bodyLockCount > 0) {
    bodyLockCount -= 1
  }

  clearCleanupTimer()
  cleanupTimer = setTimeout(() => {
    cleanupTimer = undefined
    syncBodyLockState()
  }, 200)
}

/**
 * Hook that monitoring the ref value to lock or unlock the screen.
 * When the trigger became true, it assumes modal is now opened and vice versa.
 * @param trigger {Ref<boolean>}
 */
export const useLockscreen = (
  trigger: Ref<boolean>,
  options: UseLockScreenOptions = {},
) => {
  if (!isRef(trigger)) {
    throwError(
      '[useLockscreen]',
      'You need to pass a ref param to this function',
    )
  }

  const ns = options.ns || useNamespace('popup')
  const hiddenCls = computed(() => ns.bm('parent', 'hidden'))
  let locked = false

  const lock = () => {
    if (locked || !isClient) {
      return
    }

    acquireBodyLock(hiddenCls.value, ns.namespace.value)
    locked = true
  }

  const unlock = () => {
    if (!locked || !isClient) {
      return
    }

    releaseBodyLock(hiddenCls.value)
    locked = false
  }

  watch(
    trigger,
    (val) => {
      if (val) {
        lock()
        return
      }

      unlock()
    },
    { immediate: true },
  )

  onScopeDispose(() => unlock())
}

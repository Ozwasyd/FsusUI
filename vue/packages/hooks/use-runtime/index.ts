import {
  computed,
  getCurrentScope,
  isRef,
  onScopeDispose,
  readonly,
  ref,
  shallowRef,
  toValue,
  watch,
  watchEffect,
} from 'vue'

import type {
  ComponentPublicInstance,
  MaybeRefOrGetter,
  Ref,
  WatchStopHandle,
} from 'vue'

type MaybeElement =
  | Element
  | Window
  | Document
  | ComponentPublicInstance
  | null
  | undefined

type MaybeElementRef<T extends MaybeElement = MaybeElement> =
  MaybeRefOrGetter<T>

type Fn = () => void

type EventListenerParam =
  | EventListenerObject
  | ((event: any) => void | boolean | undefined)

const noop: Fn = () => {}
const defaultWindow = typeof window === 'undefined' ? undefined : window

export const isClient =
  typeof window !== 'undefined' && typeof document !== 'undefined'

export const isIOS =
  isClient &&
  /iP(?:ad|hone|od)/.test(window.navigator.userAgent) &&
  !('MSStream' in window)

export const tryOnScopeDispose = (fn: Fn) => {
  if (!getCurrentScope()) return false
  onScopeDispose(fn)
  return true
}

export const unrefElement = <T extends MaybeElementRef>(elRef: T) => {
  const plain = toValue(elRef) as MaybeElement
  return plain && '$el' in plain ? plain.$el : plain
}

const isEventTarget = (target: unknown): target is EventTarget =>
  !!target &&
  typeof (target as EventTarget).addEventListener === 'function' &&
  typeof (target as EventTarget).removeEventListener === 'function'

const toEventTarget = (target: MaybeElementRef): EventTarget | undefined => {
  const element = unrefElement(target)
  return isEventTarget(element) ? element : undefined
}

export function useEventListener(
  event: string,
  listener: EventListenerParam,
  options?: AddEventListenerOptions | boolean,
): Fn
export function useEventListener(
  target: MaybeElementRef,
  event: string,
  listener: EventListenerParam,
  options?: AddEventListenerOptions | boolean,
): Fn
export function useEventListener(...args: unknown[]): Fn {
  const [target, event, listener, options] =
    typeof args[0] === 'string'
      ? [defaultWindow, args[0], args[1], args[2]]
      : [args[0], args[1], args[2], args[3]]

  if (typeof event !== 'string' || !listener) return noop

  const register = (eventTarget: EventTarget | undefined) => {
    if (!eventTarget) return noop
    eventTarget.addEventListener(
      event,
      listener as EventListener,
      options as AddEventListenerOptions | boolean | undefined,
    )
    return () =>
      eventTarget.removeEventListener(
        event,
        listener as EventListener,
        options as EventListenerOptions | boolean | undefined,
      )
  }

  if (isRef(target) || typeof target === 'function') {
    let cleanup = noop
    const stopWatch = watch(
      () => toEventTarget(target as MaybeElementRef),
      (eventTarget, _previousTarget, onCleanup) => {
        cleanup()
        cleanup = register(eventTarget)
        onCleanup(cleanup)
      },
      { immediate: true, flush: 'post' },
    )
    const stop = () => {
      cleanup()
      stopWatch()
    }
    tryOnScopeDispose(stop)
    return stop
  }

  const stop = register(toEventTarget(target as MaybeElementRef))
  tryOnScopeDispose(stop)
  return stop
}

export interface UseElementBoundingReturn {
  bottom: Ref<number>
  height: Ref<number>
  left: Ref<number>
  right: Ref<number>
  stop: Fn
  top: Ref<number>
  update: Fn
  width: Ref<number>
  x: Ref<number>
  y: Ref<number>
}

export const useElementBounding = (
  target: MaybeElementRef,
  options: { windowScroll?: boolean } = {},
): UseElementBoundingReturn => {
  const height = ref(0)
  const width = ref(0)
  const top = ref(0)
  const bottom = ref(0)
  const left = ref(0)
  const right = ref(0)
  const x = ref(0)
  const y = ref(0)
  const includeWindowScroll = options.windowScroll !== false

  const update = () => {
    const element = unrefElement(target)
    if (!(element instanceof Element)) return

    const rect = element.getBoundingClientRect()
    const offsetX = includeWindowScroll && isClient ? window.scrollX : 0
    const offsetY = includeWindowScroll && isClient ? window.scrollY : 0

    height.value = rect.height
    width.value = rect.width
    top.value = rect.top + offsetY
    bottom.value = rect.bottom + offsetY
    left.value = rect.left + offsetX
    right.value = rect.right + offsetX
    x.value = rect.x + offsetX
    y.value = rect.y + offsetY
  }

  const resizeObserver = useResizeObserver(target, update)
  const stopResizeListener = useEventListener('resize', update)
  let stopScrollListener = noop
  if (includeWindowScroll) {
    stopScrollListener = useEventListener('scroll', update, {
      capture: true,
      passive: true,
    })
  }
  const stopTargetWatch = watch(() => unrefElement(target), update, {
    flush: 'post',
    immediate: true,
  })

  const stop = () => {
    resizeObserver.stop()
    stopResizeListener()
    stopScrollListener()
    stopTargetWatch()
  }
  tryOnScopeDispose(stop)

  return { bottom, height, left, right, stop, top, update, width, x, y }
}

export const useWindowSize = () => {
  const width = ref(isClient ? window.innerWidth : 0)
  const height = ref(isClient ? window.innerHeight : 0)
  const update = () => {
    if (!isClient) return
    width.value = window.innerWidth
    height.value = window.innerHeight
  }

  useEventListener('resize', update)

  return { height, width }
}

export const useDocumentVisibility = () => {
  const visibility = ref<DocumentVisibilityState>(
    typeof document === 'undefined' ? 'visible' : document.visibilityState,
  )
  if (typeof document !== 'undefined') {
    useEventListener(document, 'visibilitychange', () => {
      visibility.value = document.visibilityState
    })
  }
  return visibility
}

export const useWindowFocus = () => {
  const focused = ref(
    typeof document === 'undefined' ? true : document.hasFocus(),
  )
  useEventListener('focus', () => {
    focused.value = true
  })
  useEventListener('blur', () => {
    focused.value = false
  })
  return focused
}

const toElements = (target: MaybeElementRef | MaybeElementRef[]) => {
  const targets = Array.isArray(toValue(target))
    ? (toValue(target) as MaybeElementRef[])
    : [target as MaybeElementRef]

  return targets
    .map((item) => unrefElement(item))
    .filter(
      (item): item is Element =>
        typeof Element !== 'undefined' && item instanceof Element,
    )
}

export interface UseResizeObserverReturn {
  isSupported: Ref<boolean>
  stop: Fn
}

export const useResizeObserver = (
  target: MaybeElementRef | MaybeElementRef[],
  callback: ResizeObserverCallback,
  options?: ResizeObserverOptions,
): UseResizeObserverReturn => {
  const isSupported = ref(
    typeof window !== 'undefined' &&
      typeof window.ResizeObserver === 'function',
  )
  let observer: ResizeObserver | undefined
  let stopWatch: WatchStopHandle | undefined

  const cleanup = () => {
    observer?.disconnect()
    observer = undefined
  }

  const observe = () => {
    cleanup()
    if (!isSupported.value) return
    const elements = toElements(target)
    if (elements.length === 0) return
    observer = new ResizeObserver(callback)
    for (const element of elements) observer.observe(element, options)
  }

  if (isRef(target) || typeof target === 'function' || Array.isArray(target)) {
    stopWatch = watch(() => toElements(target), observe, {
      immediate: true,
      flush: 'post',
    })
  } else {
    observe()
  }

  const stop = () => {
    cleanup()
    stopWatch?.()
  }
  tryOnScopeDispose(stop)

  return {
    isSupported,
    stop,
  }
}

export const useMutationObserver = (
  target: MaybeElementRef | MaybeElementRef[],
  callback: MutationCallback,
  options?: MutationObserverInit,
) => {
  const isSupported = ref(
    typeof window !== 'undefined' &&
      typeof window.MutationObserver === 'function',
  )
  let observer: MutationObserver | undefined
  let stopWatch: WatchStopHandle | undefined

  const cleanup = () => {
    observer?.disconnect()
    observer = undefined
  }

  const observe = () => {
    cleanup()
    if (!isSupported.value) return
    const elements = toElements(target)
    if (elements.length === 0) return
    observer = new MutationObserver(callback)
    for (const element of elements) observer.observe(element, options)
  }

  if (isRef(target) || typeof target === 'function' || Array.isArray(target)) {
    stopWatch = watch(() => toElements(target), observe, {
      immediate: true,
      flush: 'post',
    })
  } else {
    observe()
  }

  const stop = () => {
    cleanup()
    stopWatch?.()
  }
  tryOnScopeDispose(stop)

  return {
    isSupported,
    stop,
  }
}

export const useTimeoutFn = <CallbackArgs extends unknown[]>(
  callback: (...args: CallbackArgs) => void,
  interval: MaybeRefOrGetter<number>,
  options: { immediate?: boolean } = {},
) => {
  const isPending = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  const stop = () => {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
    isPending.value = false
  }

  const start = (...args: CallbackArgs) => {
    stop()
    isPending.value = true
    timer = setTimeout(
      () => {
        timer = undefined
        isPending.value = false
        callback(...args)
      },
      Math.max(0, toValue(interval) ?? 0),
    )
  }

  if (options.immediate !== false) start(...([] as unknown as CallbackArgs))
  tryOnScopeDispose(stop)

  return {
    isPending: readonly(isPending),
    start,
    stop,
  }
}

export const useThrottleFn = <CallbackArgs extends unknown[]>(
  callback: (...args: CallbackArgs) => void,
  interval = 200,
  trailing = false,
  leading = true,
) => {
  let lastExec = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastArgs: CallbackArgs | undefined

  const clear = () => {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  const throttled = (...args: CallbackArgs) => {
    const elapsed = Date.now() - lastExec
    const invoke = () => {
      clear()
      lastExec = Date.now()
      callback(...(lastArgs ?? args))
      lastArgs = undefined
    }

    lastArgs = args

    if (elapsed >= interval || (lastExec === 0 && leading)) {
      invoke()
      return
    }

    if (trailing && timer === undefined) {
      timer = setTimeout(invoke, Math.max(0, interval - elapsed))
    }
  }

  tryOnScopeDispose(clear)
  return throttled
}

export const onClickOutside = (
  target: MaybeElementRef,
  handler: (event: PointerEvent) => void,
  options: { ignore?: MaybeElementRef[] } = {},
) => {
  if (!isClient) return noop

  let handledPointerDownTarget: EventTarget | null = null
  const handleEvent = (event: Event) => {
    const path = event.composedPath()
    const targetElement = unrefElement(target)
    if (targetElement && path.includes(targetElement)) return

    for (const ignoreTarget of options.ignore ?? []) {
      const ignoredElement = unrefElement(ignoreTarget)
      if (ignoredElement && path.includes(ignoredElement)) return
    }

    handler(event as PointerEvent)
  }

  const stopPointerDown = useEventListener(
    document,
    'pointerdown',
    (event) => {
      handledPointerDownTarget = event.target
      handleEvent(event)
    },
    true,
  )
  const stopClick = useEventListener(
    document,
    'click',
    (event) => {
      if (handledPointerDownTarget === event.target) {
        handledPointerDownTarget = null
        return
      }
      handleEvent(event)
    },
    true,
  )

  return () => {
    stopPointerDown()
    stopClick()
  }
}

export const eagerComputed = <T>(getter: () => T) => {
  const result = shallowRef<T>() as Ref<T>
  watchEffect(
    () => {
      result.value = getter()
    },
    { flush: 'sync' },
  )
  return readonly(result)
}

export const refDebounced = <T>(source: Ref<T>, delay = 0) => {
  const debounced = ref(source.value) as Ref<T>
  let timer: ReturnType<typeof setTimeout> | undefined
  const stop = watch(source, (value) => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(
      () => {
        debounced.value = value
      },
      Math.max(0, delay),
    )
  })

  tryOnScopeDispose(() => {
    if (timer !== undefined) clearTimeout(timer)
    stop()
  })

  return debounced
}

export const useCssVar = (
  prop: MaybeRefOrGetter<string>,
  target?: MaybeElementRef,
) => {
  const variable = ref('')
  const update = () => {
    const element =
      target || !isClient ? unrefElement(target) : document.documentElement
    variable.value =
      element instanceof Element && typeof window !== 'undefined'
        ? window
            .getComputedStyle(element)
            .getPropertyValue(toValue(prop))
            .trim()
        : ''
  }

  watch(
    () =>
      target || !isClient ? unrefElement(target) : document.documentElement,
    update,
    {
      immediate: true,
      flush: 'post',
    },
  )

  return variable
}

export const useVModel = <
  Props extends Record<string, any>,
  Key extends keyof Props,
>(
  props: Props,
  key: Key,
  emit?: (event: `update:${string}`, value: Props[Key]) => void,
  _options?: { passive?: boolean },
) => {
  const data = ref(props[key]) as Ref<Props[Key]>
  watch(
    () => props[key],
    (value) => {
      data.value = value
    },
    { deep: true },
  )
  watch(
    data,
    (value) => {
      emit?.(`update:${String(key)}`, value)
    },
    { deep: true },
  )
  return data
}

export const useSupported = (callback: () => boolean) =>
  computed(() => {
    try {
      return Boolean(callback())
    } catch {
      return false
    }
  })

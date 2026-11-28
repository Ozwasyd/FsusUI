import { onBeforeUnmount, onMounted, ref, unref, watch } from 'vue'
import {
  arrow as floatingArrow,
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
  size,
  type Middleware,
  type Placement,
  type Strategy,
} from '@floating-ui/dom'
import { FSUS_KEY } from '../constants'
import { getFocusableElements, isClient } from '../utils'
import type { Directive, MaybeRef, Ref } from 'vue'

export type { Placement as FsusPlacement, Strategy as FsusFloatingStrategy }

export interface UseFloatingOptions {
  placement?: MaybeRef<Placement>
  strategy?: MaybeRef<Strategy>
  offsetPx?: MaybeRef<number>
  open?: MaybeRef<boolean>
  matchWidth?: MaybeRef<boolean>
  arrowEl?: Ref<HTMLElement | null | undefined>
  padding?: number
}

export const useFloating = (
  referenceEl: Ref<HTMLElement | null | undefined>,
  floatingEl: Ref<HTMLElement | null | undefined>,
  options: UseFloatingOptions = {},
) => {
  const x = ref(0)
  const y = ref(0)
  const placement = ref<Placement>(unref(options.placement) ?? 'bottom')
  const strategy = ref<Strategy>(unref(options.strategy) ?? 'fixed')
  const arrowX = ref<number | undefined>()
  const arrowY = ref<number | undefined>()
  const floatingStyle = ref<Record<string, string>>({
    position: strategy.value,
    top: '0px',
    left: '0px',
  })

  let cleanupAutoUpdate: (() => void) | undefined

  const update = async () => {
    const refNode = referenceEl.value
    const floatNode = floatingEl.value
    if (!refNode || !floatNode) return

    const middleware: Middleware[] = [
      offset(unref(options.offsetPx) ?? 8),
      flip({ padding: options.padding ?? 8 }),
      shift({ padding: options.padding ?? 8 }),
    ]

    if (unref(options.matchWidth)) {
      middleware.push(
        size({
          apply({ rects, elements }) {
            elements.floating.style.minWidth = `${rects.reference.width}px`
          },
        }),
      )
    }

    if (options.arrowEl?.value) {
      middleware.push(floatingArrow({ element: options.arrowEl.value, padding: 6 }))
    }

    const pos = await computePosition(refNode, floatNode, {
      placement: unref(options.placement) ?? 'bottom',
      strategy: unref(options.strategy) ?? 'fixed',
      middleware,
    })

    x.value = pos.x
    y.value = pos.y
    placement.value = pos.placement
    strategy.value = pos.strategy
    arrowX.value = pos.middlewareData.arrow?.x
    arrowY.value = pos.middlewareData.arrow?.y
    floatingStyle.value = {
      position: pos.strategy,
      left: `${Math.round(pos.x)}px`,
      top: `${Math.round(pos.y)}px`,
    }
  }

  const stop = () => {
    cleanupAutoUpdate?.()
    cleanupAutoUpdate = undefined
  }

  const start = () => {
    stop()
    const refNode = referenceEl.value
    const floatNode = floatingEl.value
    if (!refNode || !floatNode) return
    cleanupAutoUpdate = autoUpdate(refNode, floatNode, update)
  }

  watch(
    [referenceEl, floatingEl, () => unref(options.open), () => unref(options.placement)],
    ([refNode, floatNode, open]) => {
      if (refNode && floatNode && (open === undefined || open)) {
        start()
      } else {
        stop()
      }
    },
    { flush: 'post', immediate: true },
  )

  onBeforeUnmount(stop)

  return {
    x,
    y,
    placement,
    strategy,
    arrowX,
    arrowY,
    floatingStyle,
    update,
  }
}

export const useClickOutside = (
  targets: MaybeRef<Array<HTMLElement | null | undefined>>,
  handler: (event: PointerEvent) => void,
  enabled: MaybeRef<boolean> = true,
) => {
  if (!isClient) return
  const listener = (event: PointerEvent) => {
    if (!unref(enabled)) return
    const path = event.composedPath()
    const nodes = unref(targets)
    for (const node of nodes) {
      if (node && (node === event.target || path.includes(node))) return
    }
    handler(event)
  }
  onMounted(() => document.addEventListener('pointerdown', listener, true))
  onBeforeUnmount(() => document.removeEventListener('pointerdown', listener, true))
}

export const useEscapeKeydown = (
  handler: (event: KeyboardEvent) => void,
  enabled: MaybeRef<boolean> = true,
) => {
  if (!isClient) return
  const listener = (event: KeyboardEvent) => {
    if (!unref(enabled) || event.key !== FSUS_KEY.ESCAPE) return
    handler(event)
  }
  onMounted(() => document.addEventListener('keydown', listener))
  onBeforeUnmount(() => document.removeEventListener('keydown', listener))
}

let scrollLockCount = 0
let savedBodyOverflow = ''
let savedBodyPaddingRight = ''

export const useScrollLock = (locked: MaybeRef<boolean>) => {
  let active = false
  const lock = () => {
    if (!isClient || active) return
    active = true
    if (scrollLockCount === 0) {
      savedBodyOverflow = document.body.style.overflow
      savedBodyPaddingRight = document.body.style.paddingRight
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      document.body.style.overflow = 'hidden'
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`
      }
    }
    scrollLockCount += 1
  }
  const unlock = () => {
    if (!isClient || !active) return
    active = false
    scrollLockCount = Math.max(0, scrollLockCount - 1)
    if (scrollLockCount === 0) {
      document.body.style.overflow = savedBodyOverflow
      document.body.style.paddingRight = savedBodyPaddingRight
    }
  }
  watch(() => unref(locked), (val) => (val ? lock() : unlock()), { immediate: true })
  onBeforeUnmount(unlock)
  return { lock, unlock }
}

export const useFocusTrap = (
  container: Ref<HTMLElement | null | undefined>,
  active: MaybeRef<boolean>,
) => {
  let previousFocused: HTMLElement | null = null

  const onKeydown = (event: KeyboardEvent) => {
    if (!unref(active) || event.key !== FSUS_KEY.TAB || !container.value) return
    const focusables = getFocusableElements(container.value)
    if (focusables.length === 0) {
      event.preventDefault()
      container.value.focus()
      return
    }
    const first = focusables[0]!
    const last = focusables[focusables.length - 1]!
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  watch(
    () => unref(active),
    (isActive) => {
      if (!isClient) return
      if (isActive) {
        previousFocused = document.activeElement as HTMLElement | null
        document.addEventListener('keydown', onKeydown)
        queueMicrotask(() => {
          const el = container.value
          if (!el) return
          const focusables = getFocusableElements(el)
          ;(focusables[0] ?? el).focus({ preventScroll: true })
        })
      } else {
        document.removeEventListener('keydown', onKeydown)
        previousFocused?.focus?.({ preventScroll: true })
        previousFocused = null
      }
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    if (!isClient) return
    document.removeEventListener('keydown', onKeydown)
  })
}

export const useDelayedToggle = (options: {
  open: () => void
  close: () => void
  showAfter?: MaybeRef<number>
  hideAfter?: MaybeRef<number>
}) => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const clear = () => {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }
  const onOpen = () => {
    clear()
    const delay = unref(options.showAfter) ?? 0
    if (delay <= 0) options.open()
    else timer = setTimeout(options.open, delay)
  }
  const onClose = () => {
    clear()
    const delay = unref(options.hideAfter) ?? 100
    if (delay <= 0) options.close()
    else timer = setTimeout(options.close, delay)
  }
  onBeforeUnmount(clear)
  return { onOpen, onClose, clear }
}

export const useResizeObserver = (
  target: Ref<HTMLElement | null | undefined>,
  callback: (entry: ResizeObserverEntry) => void,
) => {
  let observer: ResizeObserver | undefined
  const stop = () => {
    observer?.disconnect()
    observer = undefined
  }
  watch(
    target,
    (el) => {
      stop()
      if (!el || typeof ResizeObserver === 'undefined') return
      observer = new ResizeObserver((entries) => {
        if (entries[0]) callback(entries[0])
      })
      observer.observe(el)
    },
    { immediate: true },
  )
  onBeforeUnmount(stop)
  return { stop }
}

export const useRovingFocus = (
  container: Ref<HTMLElement | null | undefined>,
  selector: string,
  orientation: MaybeRef<'horizontal' | 'vertical' | 'both'> = 'vertical',
) => {
  const onKeydown = (event: KeyboardEvent) => {
    const el = container.value
    if (!el) return
    const items = Array.from(el.querySelectorAll<HTMLElement>(selector)).filter(
      (item) => !item.hasAttribute('disabled') && item.getAttribute('aria-disabled') !== 'true',
    )
    if (items.length === 0) return
    const idx = items.indexOf(document.activeElement as HTMLElement)
    const dir = unref(orientation)
    const nextKeys =
      dir === 'horizontal'
        ? [FSUS_KEY.ARROW_RIGHT]
        : dir === 'vertical'
          ? [FSUS_KEY.ARROW_DOWN]
          : [FSUS_KEY.ARROW_DOWN, FSUS_KEY.ARROW_RIGHT]
    const prevKeys =
      dir === 'horizontal'
        ? [FSUS_KEY.ARROW_LEFT]
        : dir === 'vertical'
          ? [FSUS_KEY.ARROW_UP]
          : [FSUS_KEY.ARROW_UP, FSUS_KEY.ARROW_LEFT]

    let nextIdx = -1
    if (nextKeys.includes(event.key as any)) {
      nextIdx = idx < 0 ? 0 : (idx + 1) % items.length
    } else if (prevKeys.includes(event.key as any)) {
      nextIdx = idx <= 0 ? items.length - 1 : idx - 1
    } else if (event.key === FSUS_KEY.HOME) {
      nextIdx = 0
    } else if (event.key === FSUS_KEY.END) {
      nextIdx = items.length - 1
    }
    if (nextIdx >= 0) {
      event.preventDefault()
      items[nextIdx]!.focus()
    }
  }
  return { onKeydown }
}

const clickOutsideHandlers = new WeakMap<HTMLElement, (e: PointerEvent) => void>()

export const vClickOutside: Directive<HTMLElement, (e: PointerEvent) => void> = {
  mounted(el, binding) {
    const handler = (event: PointerEvent) => {
      if (!event.composedPath().includes(el)) {
        binding.value?.(event)
      }
    }
    clickOutsideHandlers.set(el, handler)
    document.addEventListener('pointerdown', handler, true)
  },
  unmounted(el) {
    const handler = clickOutsideHandlers.get(el)
    if (handler) {
      document.removeEventListener('pointerdown', handler, true)
      clickOutsideHandlers.delete(el)
    }
  },
}

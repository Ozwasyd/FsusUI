import {
  defineComponent,
  h,
  hasInjectionContext,
  inject,
  reactive,
  render,
  type App,
  type AppContext,
  type InjectionKey,
  type PropType,
  type VNode,
} from 'vue'
import type { FsusTone } from '@fsusui/core'
import { FsusIcon, type FsusIconName } from '@fsusui/icons'

export interface FsusMessageOptions {
  message: string | VNode
  tone?: FsusTone
  duration?: number
  closable?: boolean
  onClose?: () => void
}

export interface FsusMessageHandle {
  close: () => void
}

export interface FsusMessageService {
  (options: string | FsusMessageOptions): FsusMessageHandle
  info: (options: string | Omit<FsusMessageOptions, 'tone'>) => FsusMessageHandle
  success: (options: string | Omit<FsusMessageOptions, 'tone'>) => FsusMessageHandle
  warning: (options: string | Omit<FsusMessageOptions, 'tone'>) => FsusMessageHandle
  danger: (options: string | Omit<FsusMessageOptions, 'tone'>) => FsusMessageHandle
  closeAll: () => void
}

export interface FsusMessageServiceController extends FsusMessageService {
  dispose: () => void
}

export interface FsusMessageServiceOptions {
  appContext?: AppContext | null
}

interface MessageRecord {
  id: number
  message: string | VNode
  tone: FsusTone
  closable: boolean
  onClose?: () => void
  timer?: ReturnType<typeof setTimeout>
  closed: boolean
}

export const FSUS_MESSAGE_KEY: InjectionKey<FsusMessageService> = Symbol('fsus-message')

const toneIcon: Record<FsusTone, FsusIconName> = {
  neutral: 'info-filled',
  info: 'info-filled',
  success: 'circle-check-filled',
  warning: 'warning-filled',
  danger: 'circle-close-filled',
}

const hasDomHost = (): boolean =>
  typeof window !== 'undefined' && typeof document !== 'undefined' && Boolean(document.body)

const MessageContainer = defineComponent({
  name: 'FsusMessageContainer',
  props: {
    items: {
      type: Array as PropType<MessageRecord[]>,
      required: true,
    },
    onRemove: {
      type: Function as PropType<(id: number) => void>,
      required: true,
    },
  },
  setup(props) {
    return () =>
      h(
        'div',
        { class: 'fsus-message-stack', role: 'region', 'aria-live': 'polite' },
        props.items.map((item) =>
          h(
            'div',
            { key: item.id, class: 'fsus-message', role: 'status', 'data-tone': item.tone },
            [
              h(FsusIcon, { name: toneIcon[item.tone], class: 'fsus-message__icon' }),
              h('span', { class: 'fsus-message__content' }, [item.message]),
              item.closable
                ? h(
                    'button',
                    {
                      type: 'button',
                      class: 'fsus-message__close',
                      'aria-label': 'Close',
                      onClick: () => props.onRemove(item.id),
                    },
                    [h(FsusIcon, { name: 'close', size: 12 })],
                  )
                : null,
            ],
          ),
        ),
      )
  },
})

const createNoopHandle = (onClose?: () => void): FsusMessageHandle => {
  let closed = false
  return {
    close: () => {
      if (closed) return
      closed = true
      onClose?.()
    },
  }
}

export const createFsusMessageService = (
  serviceOptions: FsusMessageServiceOptions = {},
): FsusMessageServiceController => {
  const items = reactive<MessageRecord[]>([])
  const appContext = serviceOptions.appContext ?? null
  let seed = 0
  let hostEl: HTMLElement | null = null
  let disposed = false

  const unmountHost = () => {
    if (!hostEl) return
    const current = hostEl
    hostEl = null
    render(null, current)
    current.remove()
  }

  const closeRecord = (record: MessageRecord) => {
    if (record.closed) return
    record.closed = true
    if (record.timer !== undefined) {
      clearTimeout(record.timer)
      record.timer = undefined
    }
    const idx = items.indexOf(record)
    if (idx !== -1) {
      items.splice(idx, 1)
    }
    if (items.length === 0) {
      unmountHost()
    }
    record.onClose?.()
  }

  const removeMessage = (id: number) => {
    const record = items.find((item) => item.id === id)
    if (record) closeRecord(record)
  }

  const ensureHost = () => {
    if (!hasDomHost() || disposed) return
    if (!hostEl || !document.body.contains(hostEl)) {
      if (hostEl) unmountHost()
      hostEl = document.createElement('div')
      hostEl.dataset.fsusMessageHost = ''
      document.body.appendChild(hostEl)
      const vnode = h(MessageContainer, {
        items,
        onRemove: removeMessage,
      })
      if (appContext) {
        vnode.appContext = appContext
      }
      render(vnode, hostEl)
    }
  }

  const showMessage = (options: string | FsusMessageOptions): FsusMessageHandle => {
    const opts: FsusMessageOptions = typeof options === 'string' ? { message: options } : options
    if (disposed) {
      return { close: () => {} }
    }
    if (!hasDomHost()) {
      return createNoopHandle(opts.onClose)
    }

    const id = ++seed
    const duration = opts.duration ?? 3000
    const record: MessageRecord = {
      id,
      message: opts.message,
      tone: opts.tone ?? 'neutral',
      closable: opts.closable ?? false,
      onClose: opts.onClose,
      closed: false,
    }
    if (duration > 0) {
      record.timer = setTimeout(() => closeRecord(record), duration)
    }
    items.push(record)
    ensureHost()
    return { close: () => closeRecord(record) }
  }

  const createToneMethod =
    (tone: FsusTone) =>
    (options: string | Omit<FsusMessageOptions, 'tone'>): FsusMessageHandle =>
      showMessage(typeof options === 'string' ? { message: options, tone } : { ...options, tone })

  const closeAll = () => {
    for (const record of [...items]) {
      closeRecord(record)
    }
  }

  const dispose = () => {
    if (disposed) return
    disposed = true
    closeAll()
    unmountHost()
  }

  return Object.assign(showMessage, {
    info: createToneMethod('info'),
    success: createToneMethod('success'),
    warning: createToneMethod('warning'),
    danger: createToneMethod('danger'),
    closeAll,
    dispose,
  })
}

const globalMessageService = createFsusMessageService()

const resolveCurrentAppMessageService = (): FsusMessageService | null => {
  if (!hasInjectionContext()) return null
  return inject(FSUS_MESSAGE_KEY, null)
}

/**
 * Installs an application-owned `FsusMessageService` onto a Vue `App` instance,
 * provides it under `FSUS_MESSAGE_KEY`, and disposes its queue, timers, and DOM
 * host automatically when the application unmounts.
 */
export const installFsusMessage = (app: App): FsusMessageServiceController => {
  const service = createFsusMessageService({ appContext: app._context })
  app.provide(FSUS_MESSAGE_KEY, service)
  if (typeof app.onUnmount === 'function') {
    app.onUnmount(() => service.dispose())
  } else {
    const originalUnmount = app.unmount.bind(app)
    app.unmount = (() => {
      try {
        return originalUnmount()
      } finally {
        service.dispose()
      }
    }) as App['unmount']
  }
  return service
}

/**
 * Returns the owning application's `FsusMessageService` when called within a
 * component `setup()` or `app.runWithContext()`, falling back to the explicit
 * module-level convenience service otherwise. The returned handle stays bound
 * to its owner when invoked asynchronously.
 */
export const useFsusMessage = (): FsusMessageService =>
  resolveCurrentAppMessageService() ?? globalMessageService

const showContextualMessage = (options: string | FsusMessageOptions): FsusMessageHandle =>
  (resolveCurrentAppMessageService() ?? globalMessageService)(options)

const createContextualToneMethod =
  (tone: FsusTone) =>
  (options: string | Omit<FsusMessageOptions, 'tone'>): FsusMessageHandle =>
    showContextualMessage(
      typeof options === 'string' ? { message: options, tone } : { ...options, tone },
    )

/**
 * Convenience message API.
 * - Inside an active Vue injection context (such as `setup()` or `onMounted()`),
 *   messages route to the owning app's `FSUS_MESSAGE_KEY` service when installed.
 * - Outside an injection context, messages target the explicit module-level
 *   global convenience scope.
 * - `FsusMessage.closeAll()` always operates strictly on the global convenience
 *   scope; use `useFsusMessage().closeAll()` to clear a specific app's messages.
 */
export const FsusMessage: FsusMessageService = Object.assign(showContextualMessage, {
  info: createContextualToneMethod('info'),
  success: createContextualToneMethod('success'),
  warning: createContextualToneMethod('warning'),
  danger: createContextualToneMethod('danger'),
  closeAll: () => globalMessageService.closeAll(),
})

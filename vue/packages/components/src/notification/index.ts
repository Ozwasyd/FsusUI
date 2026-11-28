import { defineComponent, h, reactive, render, type VNode } from 'vue'
import { isClient, type FsusTone } from '@fsusui/core'
import { FsusIcon, type FsusIconName } from '@fsusui/icons'

export type FsusNotificationPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'

export interface FsusNotificationOptions {
  title: string
  message?: string | VNode
  tone?: FsusTone
  position?: FsusNotificationPosition
  duration?: number
  closable?: boolean
  onClose?: () => void
}

export interface FsusNotificationHandle {
  close: () => void
}

interface NotificationRecord {
  id: number
  title: string
  message?: string | VNode
  tone: FsusTone
  position: FsusNotificationPosition
  closable: boolean
  onClose?: () => void
  timer?: ReturnType<typeof setTimeout>
}

const items = reactive<NotificationRecord[]>([])
let seed = 0
let hostEl: HTMLElement | null = null
const positions: FsusNotificationPosition[] = [
  'top-right',
  'top-left',
  'bottom-right',
  'bottom-left',
]

const toneIcon: Record<FsusTone, FsusIconName> = {
  neutral: 'info-filled',
  info: 'info-filled',
  success: 'circle-check-filled',
  warning: 'warning-filled',
  danger: 'circle-close-filled',
}

const remove = (id: number) => {
  const idx = items.findIndex((n) => n.id === id)
  if (idx === -1) return
  const [removed] = items.splice(idx, 1)
  if (removed?.timer) clearTimeout(removed.timer)
  removed?.onClose?.()
}

const NotificationHost = defineComponent({
  name: 'FsusNotificationHost',
  setup() {
    return () =>
      h(
        'div',
        { class: 'fsus-notification-root' },
        positions.map((pos) => {
          const group = items.filter((n) => n.position === pos)
          if (group.length === 0) return null
          return h(
            'div',
            { key: pos, class: 'fsus-notification-stack', 'data-position': pos },
            group.map((n) =>
              h('article', { key: n.id, class: 'fsus-notification', role: 'alert', 'data-tone': n.tone }, [
                h(FsusIcon, { name: toneIcon[n.tone], class: 'fsus-notification__icon' }),
                h('div', { class: 'fsus-notification__body' }, [
                  h('div', { class: 'fsus-notification__title' }, n.title),
                  n.message ? h('div', { class: 'fsus-notification__message' }, [n.message]) : null,
                ]),
                n.closable
                  ? h(
                      'button',
                      {
                        type: 'button',
                        class: 'fsus-notification__close',
                        'aria-label': 'Close notification',
                        onClick: () => remove(n.id),
                      },
                      [h(FsusIcon, { name: 'close', size: 14 })],
                    )
                  : null,
              ]),
            ),
          )
        }),
      )
  },
})

const ensureHost = () => {
  if (!isClient) return
  if (!hostEl || !document.body.contains(hostEl)) {
    hostEl = document.createElement('div')
    hostEl.dataset.fsusNotificationHost = ''
    document.body.appendChild(hostEl)
    render(h(NotificationHost), hostEl)
  }
}

const show = (options: FsusNotificationOptions): FsusNotificationHandle => {
  const id = ++seed
  const duration = options.duration ?? 4500
  const rec: NotificationRecord = {
    id,
    title: options.title,
    message: options.message,
    tone: options.tone ?? 'neutral',
    position: options.position ?? 'top-right',
    closable: options.closable ?? true,
    onClose: options.onClose,
  }
  if (duration > 0) {
    rec.timer = setTimeout(() => remove(id), duration)
  }
  items.push(rec)
  ensureHost()
  return { close: () => remove(id) }
}

const createTone =
  (tone: FsusTone) =>
  (options: Omit<FsusNotificationOptions, 'tone'>): FsusNotificationHandle =>
    show({ ...options, tone })

export const FsusNotification = Object.assign(show, {
  info: createTone('info'),
  success: createTone('success'),
  warning: createTone('warning'),
  danger: createTone('danger'),
  closeAll: () => {
    for (const n of [...items]) remove(n.id)
  },
})

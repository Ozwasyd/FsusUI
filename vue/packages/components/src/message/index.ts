import { defineComponent, h, reactive, render, type VNode } from 'vue'
import { isClient, type FsusTone } from '@fsusui/core'
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

interface MessageRecord {
  id: number
  message: string | VNode
  tone: FsusTone
  closable: boolean
  onClose?: () => void
  timer?: ReturnType<typeof setTimeout>
}

const items = reactive<MessageRecord[]>([])
let seed = 0
let hostEl: HTMLElement | null = null

const toneIcon: Record<FsusTone, FsusIconName> = {
  neutral: 'info-filled',
  info: 'info-filled',
  success: 'circle-check-filled',
  warning: 'warning-filled',
  danger: 'circle-close-filled',
}

const removeMessage = (id: number) => {
  const idx = items.findIndex((item) => item.id === id)
  if (idx === -1) return
  const [removed] = items.splice(idx, 1)
  if (removed?.timer) clearTimeout(removed.timer)
  removed?.onClose?.()
}

const MessageContainer = defineComponent({
  name: 'FsusMessageContainer',
  setup() {
    return () =>
      h(
        'div',
        { class: 'fsus-message-stack', role: 'region', 'aria-live': 'polite' },
        items.map((item) =>
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
                      onClick: () => removeMessage(item.id),
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

const ensureHost = () => {
  if (!isClient) return
  if (!hostEl || !document.body.contains(hostEl)) {
    hostEl = document.createElement('div')
    hostEl.dataset.fsusMessageHost = ''
    document.body.appendChild(hostEl)
    render(h(MessageContainer), hostEl)
  }
}

const showMessage = (options: string | FsusMessageOptions): FsusMessageHandle => {
  const opts: FsusMessageOptions = typeof options === 'string' ? { message: options } : options
  const id = ++seed
  const duration = opts.duration ?? 3000
  const record: MessageRecord = {
    id,
    message: opts.message,
    tone: opts.tone ?? 'neutral',
    closable: opts.closable ?? false,
    onClose: opts.onClose,
  }
  if (duration > 0) {
    record.timer = setTimeout(() => removeMessage(id), duration)
  }
  items.push(record)
  ensureHost()
  return { close: () => removeMessage(id) }
}

const createToneMethod =
  (tone: FsusTone) =>
  (options: string | Omit<FsusMessageOptions, 'tone'>): FsusMessageHandle =>
    showMessage(typeof options === 'string' ? { message: options, tone } : { ...options, tone })

export const FsusMessage = Object.assign(showMessage, {
  info: createToneMethod('info'),
  success: createToneMethod('success'),
  warning: createToneMethod('warning'),
  danger: createToneMethod('danger'),
  closeAll: () => {
    for (const item of [...items]) removeMessage(item.id)
  },
})

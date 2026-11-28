import { defineComponent, h, render, type Directive } from 'vue'
import { isClient } from '@fsusui/core'
import { FsusIcon } from '@fsusui/icons'

export interface FsusLoadingOptions {
  target?: HTMLElement
  fullscreen?: boolean
  text?: string
}

export const FsusLoading = defineComponent({
  name: 'FsusLoading',
  props: {
    active: { type: Boolean, default: true },
    fullscreen: { type: Boolean, default: false },
    text: { type: String, default: '' },
  },
  setup(props) {
    return () =>
      props.active
        ? h(
            'div',
            {
              class: 'fsus-loading',
              role: 'status',
              'aria-busy': 'true',
              'data-fullscreen': props.fullscreen ? '' : undefined,
            },
            [
              h(FsusIcon, { name: 'loading', spin: true, size: 22 }),
              props.text ? h('span', { class: 'fsus-loading__text' }, props.text) : null,
            ],
          )
        : null
  },
})

export const FsusLoadingService = (options: FsusLoadingOptions = {}) => {
  if (!isClient) return { close: () => undefined }
  const target = options.fullscreen !== false && !options.target ? document.body : options.target!
  const host = document.createElement('div')
  host.className = 'fsus-loading-host'
  target.appendChild(host)
  render(
    h(FsusLoading, {
      active: true,
      fullscreen: options.fullscreen ?? target === document.body,
      text: options.text,
    }),
    host,
  )
  return {
    close() {
      render(null, host)
      host.remove()
    },
  }
}

const loadingInstances = new WeakMap<HTMLElement, { close: () => void }>()

export const vFsusLoading: Directive<HTMLElement, boolean | { active: boolean; text?: string }> = {
  mounted(el, binding) {
    const active = typeof binding.value === 'boolean' ? binding.value : Boolean(binding.value?.active)
    const text = typeof binding.value === 'object' ? binding.value?.text : undefined
    if (active) {
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative'
      loadingInstances.set(el, FsusLoadingService({ target: el, fullscreen: false, text }))
    }
  },
  updated(el, binding) {
    const active = typeof binding.value === 'boolean' ? binding.value : Boolean(binding.value?.active)
    const text = typeof binding.value === 'object' ? binding.value?.text : undefined
    const existing = loadingInstances.get(el)
    if (active && !existing) {
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative'
      loadingInstances.set(el, FsusLoadingService({ target: el, fullscreen: false, text }))
    } else if (!active && existing) {
      existing.close()
      loadingInstances.delete(el)
    }
  },
  unmounted(el) {
    loadingInstances.get(el)?.close()
    loadingInstances.delete(el)
  },
}

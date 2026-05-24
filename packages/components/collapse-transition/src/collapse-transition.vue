<template>
  <transition :name="ns.b()" v-on="on">
    <slot />
  </transition>
</template>
<script lang="ts" setup>
import { useNamespace } from '@element-plus/hooks'
import type { RendererElement } from '@vue/runtime-core'

defineOptions({
  name: 'ElCollapseTransition',
})

const ns = useNamespace('collapse-transition')

const reset = (el: RendererElement) => {
  el.style.maxHeight = ''
  el.style.overflow = el.dataset.oldOverflow
  el.style.paddingTop = el.dataset.oldPaddingTop
  el.style.paddingBottom = el.dataset.oldPaddingBottom
}

const on = {
  beforeEnter(el: RendererElement) {
    if (!el.dataset) el.dataset = {}

    el.dataset.oldPaddingTop = el.style.paddingTop
    el.dataset.oldPaddingBottom = el.style.paddingBottom

    el.style.maxHeight = 0
    el.style.paddingTop = 0
    el.style.paddingBottom = 0
  },

  enter(el: RendererElement) {
    el.dataset.oldOverflow = el.style.overflow
    const scrollHeight = el.scrollHeight
    const paddingTop = el.dataset.oldPaddingTop
    const paddingBottom = el.dataset.oldPaddingBottom

    requestAnimationFrame(() => {
      el.style.maxHeight = scrollHeight !== 0 ? `${scrollHeight}px` : 0
      el.style.paddingTop = paddingTop
      el.style.paddingBottom = paddingBottom
      el.style.overflow = 'hidden'
    })
  },

  afterEnter(el: RendererElement) {
    el.style.maxHeight = ''
    el.style.overflow = el.dataset.oldOverflow
  },

  enterCancelled(el: RendererElement) {
    reset(el)
  },

  beforeLeave(el: RendererElement) {
    if (!el.dataset) el.dataset = {}
    el.dataset.oldPaddingTop = el.style.paddingTop
    el.dataset.oldPaddingBottom = el.style.paddingBottom
    el.dataset.oldOverflow = el.style.overflow

    const scrollHeight = el.scrollHeight
    requestAnimationFrame(() => {
      el.style.maxHeight = `${scrollHeight}px`
      el.style.overflow = 'hidden'
    })
  },

  leave(el: RendererElement) {
    if (el.scrollHeight !== 0) {
      requestAnimationFrame(() => {
        el.style.maxHeight = 0
        el.style.paddingTop = 0
        el.style.paddingBottom = 0
      })
    }
  },

  afterLeave(el: RendererElement) {
    reset(el)
  },

  leaveCancelled(el: RendererElement) {
    reset(el)
  },
}
</script>

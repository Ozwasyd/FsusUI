<template>
  <transition mode="out-in" v-bind="listeners">
    <slot />
  </transition>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { addClass, hasClass, removeClass } from '@element-plus/utils'

import type { BaseTransitionProps, TransitionProps } from 'vue'

export default defineComponent({
  name: 'ElMenuCollapseTransition',
  setup() {
    const ns = useNamespace('menu')
    const listeners = {
      onBeforeEnter: (el) => (el.style.opacity = '0.2'),
      onEnter(el, done) {
        addClass(el, `${ns.namespace.value}-opacity-transition`)
        el.style.opacity = '1'
        done()
      },

      onAfterEnter(el) {
        removeClass(el, `${ns.namespace.value}-opacity-transition`)
        el.style.opacity = ''
      },

      onBeforeLeave(el) {
        if (!el.dataset) {
          ;(el as any).dataset = {}
        }

        let scrollWidth: string
        if (hasClass(el, ns.m('collapse'))) {
          removeClass(el, ns.m('collapse'))
          el.dataset.oldOverflow = el.style.overflow
          scrollWidth = el.clientWidth.toString()
          addClass(el, ns.m('collapse'))
        } else {
          addClass(el, ns.m('collapse'))
          el.dataset.oldOverflow = el.style.overflow
          scrollWidth = el.clientWidth.toString()
          removeClass(el, ns.m('collapse'))
        }

        el.dataset.scrollWidth = scrollWidth
        requestAnimationFrame(() => {
          el.style.width = `${scrollWidth}px`
          el.style.overflow = 'hidden'
        })
      },

      onLeave(el: HTMLElement) {
        addClass(el, 'horizontal-collapse-transition')
        const scrollWidth = el.dataset.scrollWidth
        requestAnimationFrame(() => {
          el.style.width = `${scrollWidth}px`
        })
      },
    } as BaseTransitionProps<HTMLElement> as TransitionProps

    return {
      listeners,
    }
  },
})
</script>

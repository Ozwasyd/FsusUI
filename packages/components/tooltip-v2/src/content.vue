<template>
  <div ref="contentRef" :style="contentStyle" v-bind="rootAttrs">
    <div v-if="!nowrap" :class="contentClass" v-bind="contentAttrs">
      <slot :content-style="contentStyle" :content-class="contentClass" />
      <el-visually-hidden v-bind="visuallyHiddenAttrs">
        <template v-if="ariaLabel">
          {{ ariaLabel }}
        </template>
        <slot v-else />
      </el-visually-hidden>
      <slot name="arrow" :style="arrowStyle" :side="side" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, provide, ref, unref, watch } from 'vue'
import { offset } from '@floating-ui/dom'
import {
  arrowMiddleware,
  useFloating,
  useNamespace,
  useZIndex,
} from '@element-plus/hooks'
import ElVisuallyHidden from '@element-plus/components/visual-hidden'
import { tooltipV2ContentKey, tooltipV2RootKey } from './constants'
import { tooltipV2ContentProps } from './content'
import { tooltipV2CommonProps } from './common'

import type { CSSProperties } from 'vue'
import type { Middleware } from '@floating-ui/dom'

defineOptions({
  name: 'ElTooltipV2Content',
})

const props = defineProps({ ...tooltipV2ContentProps, ...tooltipV2CommonProps })

const { triggerRef, contentId } = inject(tooltipV2RootKey)!

const placement = ref(props.placement)
const strategy = ref(props.strategy)
const arrowRef = ref<HTMLElement | null>(null)

const { referenceRef, contentRef, middlewareData, x, y, update } = useFloating({
  placement,
  strategy,
  middleware: computed(() => {
    const middleware: Middleware[] = [offset(props.offset)]

    if (props.showArrow) {
      middleware.push(
        arrowMiddleware({
          arrowRef,
        })
      )
    }

    return middleware
  }),
})

const zIndex = useZIndex().nextZIndex()

const ns = useNamespace('tooltip-v2')

const side = computed(() => {
  return placement.value.split('-')[0]
})

const rootAttrs = { 'data-tooltip-v2-root': '' }

const contentAttrs = computed<Record<string, unknown>>(() => ({
  'data-side': side.value,
}))

const visuallyHiddenAttrs = computed<Record<string, unknown>>(() => ({
  id: unref(contentId),
  role: 'tooltip',
}))

const contentStyle = computed<CSSProperties>(() => {
  return {
    position: unref(strategy),
    top: `${unref(y) || 0}px`,
    left: `${unref(x) || 0}px`,
    zIndex,
  }
})

const arrowStyle = computed<CSSProperties>(() => {
  if (!props.showArrow) return {}

  const { arrow } = unref(middlewareData)

  return {
    [`--${ns.namespace.value}-tooltip-v2-arrow-x`]:
      arrow?.x != null ? `${arrow.x}px` : '',
    [`--${ns.namespace.value}-tooltip-v2-arrow-y`]:
      arrow?.y != null ? `${arrow.y}px` : '',
  }
})

const contentClass = computed(() => [
  ns.e('content'),
  ns.is('dark', props.effect === 'dark'),
  ns.is(unref(strategy)),
  props.contentClass,
])

watch(arrowRef, () => update())

watch(
  () => props.placement,
  (val) => (placement.value = val)
)

onMounted(() => {
  watch(
    () => props.reference || triggerRef.value,
    (el) => {
      referenceRef.value = el || undefined
    },
    {
      immediate: true,
    }
  )
})

provide(tooltipV2ContentKey, { arrowRef })
</script>

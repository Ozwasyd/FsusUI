<template>
  <i
    :class="[ns.b(), ns.is('linear', variant === 'linear')]"
    v-bind="mergedBindings"
  >
    <slot />
  </i>
</template>

<script lang="ts" setup>
import { computed, mergeProps, useAttrs } from 'vue'
import { addUnit, isUndefined } from '@element-plus/utils'
import { useNamespace } from '@element-plus/hooks'
import { iconProps } from './icon'
import type { CSSProperties } from 'vue'

defineOptions({
  name: 'ElIcon',
  inheritAttrs: false,
})
const props = defineProps(iconProps)
const attrs = useAttrs()
const ns = useNamespace('icon')

// A `:style` binding keeps the key present even when its value is empty, and
// SSR then serializes a literal `style=""` attribute. An empty inline style
// attribute violates `style-src-attr 'none'` CSP policies, so absent
// size/color must omit the binding instead of binding an empty object.
const style = computed<CSSProperties | null>(() => {
  const { size, color } = props
  if (!size && !color) return null

  return {
    fontSize: isUndefined(size) ? undefined : addUnit(size),
    '--color': color,
  }
})

// $attrs must go through `mergeProps` (not a plain spread) so consumer class
// and style entries concatenate with the internal bindings.
const mergedBindings = computed<Record<string, unknown>>(() =>
  mergeProps(style.value ? { style: style.value } : {}, attrs)
)
</script>

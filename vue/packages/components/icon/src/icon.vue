<template>
  <i
    v-if="hasCustomStyle"
    :class="classes"
    :style="style"
    v-bind="$attrs"
  >
    <slot />
  </i>
  <i
    v-else
    :class="classes"
    v-bind="$attrs"
  >
    <slot />
  </i>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { addUnit, isUndefined } from '@element-plus/utils'
import { useNamespace } from '@element-plus/hooks'
import { iconProps } from './icon'
import type { CSSProperties } from 'vue'

defineOptions({
  name: 'ElIcon',
  inheritAttrs: false,
})
const props = defineProps(iconProps)
const ns = useNamespace('icon')

const classes = computed(() => [ns.b(), ns.is('linear', props.variant === 'linear')])
const hasCustomStyle = computed(() => Boolean(props.size || props.color))

const style = computed<CSSProperties | undefined>(() => {
  const { size, color } = props
  if (!size && !color) return undefined

  return {
    fontSize: isUndefined(size) ? undefined : addUnit(size),
    '--color': color,
  }
})
</script>

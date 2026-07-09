<template>
  <div v-bind="componentMotionAttrs" :class="rootKls">
    <slot />
  </div>
</template>

<script lang="ts" setup>
import { toRef } from 'vue'
import { useComponentMotionAttrs } from '@element-plus/components/motion'
import { collapseEmits, collapseProps } from './collapse'
import { useCollapse, useCollapseDOM } from './use-collapse'

defineOptions({
  name: 'ElCollapse',
})
const props = defineProps(collapseProps)
const emit = defineEmits(collapseEmits)
const componentMotionAttrs = useComponentMotionAttrs(
  toRef(props, 'motion'),
  'slide-up',
)

const { activeNames, setActiveNames } = useCollapse(props, emit)

const { rootKls } = useCollapseDOM()

defineExpose({
  /** @description active names */
  activeNames,
  /** @description set active names */
  setActiveNames,
})
</script>

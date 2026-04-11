<template>
  <el-tooltip ref="tooltipRef" v-bind="tooltipBindings" v-on="tooltipEvents">
    <template v-if="$slots.reference">
      <slot name="reference" />
    </template>

    <template #content>
      <div v-if="title" :class="ns.e('title')" role="title">
        {{ title }}
      </div>
      <slot>
        {{ content }}
      </slot>
    </template>
  </el-tooltip>
</template>
<script lang="ts" setup>
import { computed, ref, unref, useAttrs } from 'vue'
import { ElTooltip } from '@element-plus/components/tooltip'
import { addUnit } from '@element-plus/utils'
import { useNamespace } from '@element-plus/hooks'
import { popoverEmits, popoverProps } from './popover'
import type { TooltipInstance } from '@element-plus/components/tooltip'

defineOptions({
  name: 'ElPopover',
})

const props = defineProps(popoverProps)
const emit = defineEmits(popoverEmits)
const attrs = useAttrs()

const updateEventKeyRaw = `onUpdate:visible` as const

const onUpdateVisible = computed(() => {
  return props[updateEventKeyRaw]
})

const ns = useNamespace('popover')
const tooltipRef = ref<TooltipInstance>()
const popperRef = computed(() => {
  return unref(tooltipRef)?.popperRef
})

const style = computed(() => {
  return [
    {
      width: addUnit(props.width),
    },
    props.popperStyle!,
  ]
})

const kls = computed(() => {
  return [ns.b(), props.popperClass!, { [ns.m('plain')]: !!props.content }]
})

const gpuAcceleration = computed(() => {
  return props.transition === `${ns.namespace.value}-fade-in-linear`
})
const tooltipBindings = computed(() => ({
  ...attrs,
  trigger: props.trigger,
  placement: props.placement,
  disabled: props.disabled,
  visible: props.visible,
  transition: props.transition,
  popperOptions: props.popperOptions,
  tabindex: props.tabindex,
  content: props.content,
  offset: props.offset,
  showAfter: props.showAfter,
  hideAfter: props.hideAfter,
  autoClose: props.autoClose,
  showArrow: props.showArrow,
  ariaLabel: props.title,
  effect: props.effect,
  enterable: props.enterable,
  popperClass: kls.value,
  popperStyle: style.value,
  teleported: props.teleported,
  persistent: props.persistent,
  gpuAcceleration: gpuAcceleration.value,
}))
const tooltipEvents = computed(() => ({
  'update:visible': onUpdateVisible.value,
  'before-show': beforeEnter,
  'before-hide': beforeLeave,
  show: afterEnter,
  hide: afterLeave,
}))

const hide = () => {
  tooltipRef.value?.hide()
}

const beforeEnter = () => {
  emit('before-enter')
}
const beforeLeave = () => {
  emit('before-leave')
}

const afterEnter = () => {
  emit('after-enter')
}

const afterLeave = () => {
  emit('update:visible', false)
  emit('after-leave')
}

defineExpose({
  /** @description popper ref */
  popperRef,
  /** @description hide popover */
  hide,
})
</script>

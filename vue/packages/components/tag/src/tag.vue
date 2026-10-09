<template>
  <span
    v-if="disableTransitions"
    v-bind="componentMotionAttrs"
    :class="containerKls"
    :style="{ backgroundColor: color }"
    @click="handleClick"
  >
    <span v-if="multiline" :id="contentId" :class="ns.e('content')">
      <slot />
    </span>
    <slot v-else />
    <button
      v-if="closable && multiline"
      type="button"
      :class="ns.e('close')"
      :aria-label="t('el.messagebox.close')"
      :aria-describedby="contentId"
      v-on="closeIconEvents"
    >
      <span aria-hidden="true"
        ><el-icon><Close /></el-icon
      ></span>
    </button>
    <el-icon v-else-if="closable" :class="ns.e('close')" v-on="closeIconEvents">
      <Close />
    </el-icon>
  </span>
  <transition v-else :name="`${ns.namespace.value}-zoom-in-center`" appear>
    <span
      v-bind="componentMotionAttrs"
      :class="containerKls"
      :style="{ backgroundColor: color }"
      @click="handleClick"
    >
      <span v-if="multiline" :id="contentId" :class="ns.e('content')">
        <slot />
      </span>
      <slot v-else />
      <button
        v-if="closable && multiline"
        type="button"
        :class="ns.e('close')"
        :aria-label="t('el.messagebox.close')"
        :aria-describedby="contentId"
        v-on="closeIconEvents"
      >
        <span aria-hidden="true"
          ><el-icon><Close /></el-icon
        ></span>
      </button>
      <el-icon
        v-else-if="closable"
        :class="ns.e('close')"
        v-on="closeIconEvents"
      >
        <Close />
      </el-icon>
    </span>
  </transition>
</template>

<script lang="ts" setup>
import { computed, toRef, useId } from 'vue'
import ElIcon from '@element-plus/components/icon'
import { Close } from '@element-plus/icons-vue'
import { useLocale, useNamespace } from '@element-plus/hooks'
import { useFormSize } from '@element-plus/components/form'
import { useComponentMotionAttrs } from '@element-plus/components/motion'

import { tagEmits, tagProps } from './tag'

defineOptions({
  name: 'ElTag',
})
const props = defineProps(tagProps)
const emit = defineEmits(tagEmits)

const tagSize = useFormSize()
const ns = useNamespace('tag')
const contentId = useId()
const { t } = useLocale()
const componentMotionAttrs = useComponentMotionAttrs(toRef(props, 'motion'))
const containerKls = computed(() => {
  const { type, hit, effect, closable, round } = props
  return [
    ns.b(),
    ns.is('closable', closable),
    ns.m(type),
    ns.m(tagSize.value),
    ns.m(effect),
    ns.is('hit', hit),
    ns.is('round', round),
    ns.is('multiline', props.multiline),
  ]
})

// methods
const handleClose = (event: MouseEvent) => {
  emit('close', event)
}

const handleClick = (event: MouseEvent) => {
  emit('click', event)
}

const closeIconEvents = {
  click: (event: MouseEvent) => {
    event.stopPropagation()
    handleClose(event)
  },
}
</script>

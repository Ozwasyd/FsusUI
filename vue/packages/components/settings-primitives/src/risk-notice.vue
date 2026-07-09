<template>
  <div :class="noticeKls" :role="role">
    <strong v-if="hasTitle" :class="ns.e('title')">
      <slot name="title">{{ title }}</slot>
    </strong>
    <div :class="ns.e('body')">
      <slot />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, useSlots } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { riskNoticeProps } from './shared'

defineOptions({
  name: 'ElRiskNotice',
})

const props = defineProps(riskNoticeProps)
const slots = useSlots()
const ns = useNamespace('risk-notice')

const hasTitle = computed(() => Boolean(props.title || slots.title))
const noticeKls = computed(() => [ns.b(), ns.m(props.type)])
</script>

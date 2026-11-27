<template>
  <div :class="noticeKls" :role="role">
    <strong v-if="title || $slots.title" :class="ns.e('title')">
      <slot name="title">{{ title }}</slot>
    </strong>
    <div :class="ns.e('body')">
      <slot />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { riskNoticeProps } from './shared'

defineOptions({
  name: 'ElRiskNotice',
})

const props = defineProps(riskNoticeProps)
const ns = useNamespace('risk-notice')

const noticeKls = computed(() => [ns.b(), ns.m(props.type)])
</script>

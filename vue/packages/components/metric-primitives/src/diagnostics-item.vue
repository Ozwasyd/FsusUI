<template>
  <article :class="itemKls" role="listitem">
    <div :class="ns.e('summary')">
      <div :class="ns.e('content')">
        <strong v-if="hasTitle" :class="ns.e('title')">
          <slot name="title">{{ title }}</slot>
        </strong>
        <p v-if="hasMessage" :class="ns.e('message')">
          <slot name="message">{{ message }}</slot>
        </p>
        <span v-if="hasMeta" :class="ns.e('meta')">
          <slot name="meta">{{ meta }}</slot>
        </span>
      </div>
      <div v-if="hasActions" :class="ns.e('actions')">
        <slot name="actions" />
      </div>
    </div>
    <details
      v-if="hasDetail"
      :class="ns.e('detail')"
      :open="defaultOpen || undefined"
    >
      <summary :class="ns.e('detail-toggle')">
        <slot name="detail-label">{{ detailLabel }}</slot>
      </summary>
      <div :class="ns.e('detail-body')">
        <slot name="detail">{{ detail }}</slot>
      </div>
    </details>
  </article>
</template>

<script lang="ts" setup>
import { computed, useSlots } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { diagnosticsItemProps } from './shared'

defineOptions({
  name: 'ElDiagnosticsItem',
})

const props = defineProps(diagnosticsItemProps)
const slots = useSlots()
const ns = useNamespace('diagnostics-item')

const hasTitle = computed(() => Boolean(props.title || slots.title))
const hasMessage = computed(() => Boolean(props.message || slots.message))
const hasMeta = computed(() => Boolean(props.meta || slots.meta))
const hasDetail = computed(() => Boolean(props.detail || slots.detail))
const hasActions = computed(() => Boolean(slots.actions))
const itemKls = computed(() => [ns.b(), ns.m(props.density), ns.m(props.tone)])
</script>

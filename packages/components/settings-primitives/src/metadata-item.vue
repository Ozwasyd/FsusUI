<template>
  <div :class="itemKls">
    <dt :class="ns.e('label')">{{ label }}</dt>
    <dd :class="ns.e('value')">
      <slot>{{ displayValue }}</slot>
    </dd>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { metadataItemProps } from './shared'

defineOptions({
  name: 'ElMetadataItem',
})

const props = defineProps(metadataItemProps)
const ns = useNamespace('metadata-item')

const displayValue = computed(() =>
  props.value === null || props.value === undefined || props.value === ''
    ? props.fallback
    : String(props.value),
)
const itemKls = computed(() => [ns.b(), ns.is('monospace', props.monospace)])
</script>

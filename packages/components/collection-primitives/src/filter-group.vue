<template>
  <fieldset :class="groupKls">
    <legend v-if="label || $slots.label" :class="ns.e('label')">
      <slot name="label">{{ label }}</slot>
    </legend>

    <div :class="ns.e('body')">
      <slot />
    </div>
  </fieldset>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { filterGroupProps } from './filter-group'

defineOptions({
  name: 'ElFilterGroup',
})

const props = defineProps(filterGroupProps)
const ns = useNamespace('filter-group')
const groupKls = computed(() => [ns.b(), ns.m(props.density)])
</script>

<template>
  <nav :class="barKls" :aria-label="ariaLabel">
    <div v-if="$slots.summary" :class="ns.e('summary')">
      <slot name="summary" />
    </div>

    <div :class="ns.e('controls')">
      <slot name="pagination">
        <slot />
      </slot>
    </div>
  </nav>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { paginationBarProps } from './pagination-bar'

defineOptions({
  name: 'ElPaginationBar',
})

const props = defineProps(paginationBarProps)
const ns = useNamespace('pagination-bar')
const barKls = computed(() => [ns.b(), ns.m(props.density)])
</script>

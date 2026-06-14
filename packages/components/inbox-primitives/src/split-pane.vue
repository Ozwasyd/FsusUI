<template>
  <div :class="layoutKls">
    <section :class="ns.e('list')" :aria-label="listLabel">
      <slot name="list" />
    </section>
    <section :class="ns.e('detail')" :aria-label="detailLabel">
      <slot name="detail" />
    </section>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { splitPaneProps } from './shared'

defineOptions({
  name: 'ElSplitPane',
})

const props = defineProps(splitPaneProps)
const ns = useNamespace('split-pane')

const layoutKls = computed(() => [
  ns.b(),
  ns.m(props.density),
  ns.m(`mobile-${props.mobilePane}`),
  ns.is('selected', props.selected),
])
</script>

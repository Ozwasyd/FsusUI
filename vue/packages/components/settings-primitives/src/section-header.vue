<template>
  <header :class="headerKls">
    <div :class="ns.e('heading')">
      <component :is="titleTag" v-if="hasTitle" :class="ns.e('title')">
        <slot name="title">{{ title }}</slot>
      </component>
      <p v-if="hasDescription" :class="ns.e('description')">
        <slot name="description">{{ description }}</slot>
      </p>
    </div>
    <div v-if="hasActions" :class="ns.e('actions')">
      <slot name="actions" />
    </div>
  </header>
</template>

<script lang="ts" setup>
import { computed, useSlots } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { sectionHeaderProps } from './shared'

defineOptions({
  name: 'ElSectionHeader',
})

const props = defineProps(sectionHeaderProps)
const slots = useSlots()
const ns = useNamespace('section-header')

const hasTitle = computed(() => Boolean(props.title || slots.title))
const hasDescription = computed(() =>
  Boolean(props.description || slots.description),
)
const hasActions = computed(() => Boolean(slots.actions))
const headerKls = computed(() => [
  ns.b(),
  ns.m(props.density),
  ns.is('danger', props.danger),
])
</script>

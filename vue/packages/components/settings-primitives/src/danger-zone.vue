<template>
  <section :id="id" :class="zoneKls">
    <header v-if="hasHeader()" :class="ns.e('header')">
      <component :is="titleTag" v-if="hasTitle()" :class="ns.e('title')">
        <slot name="title">{{ title }}</slot>
      </component>
      <p v-if="hasDescription()" :class="ns.e('description')">
        <slot name="description">{{ description }}</slot>
      </p>
    </header>
    <div :class="ns.e('body')">
      <slot />
    </div>
  </section>
</template>

<script lang="ts" setup>
import { computed, useSlots } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { dangerZoneProps } from './shared'

defineOptions({
  name: 'ElDangerZone',
})

const props = defineProps(dangerZoneProps)
const slots = useSlots()
const ns = useNamespace('danger-zone')

const hasTitle = () => Boolean(props.title || slots.title)
const hasDescription = () => Boolean(props.description || slots.description)
const hasHeader = () => hasTitle() || hasDescription()
const zoneKls = computed(() => [ns.b(), ns.m(props.density)])
</script>

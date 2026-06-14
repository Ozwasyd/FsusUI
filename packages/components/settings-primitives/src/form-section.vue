<template>
  <section :class="sectionKls" :aria-labelledby="ariaLabelledby">
    <header v-if="hasHeader" :class="ns.e('header')">
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
    <div :class="ns.e('body')">
      <slot />
    </div>
  </section>
</template>

<script lang="ts" setup>
import { computed, useSlots } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { settingsSectionProps } from './shared'

defineOptions({
  name: 'ElFormSection',
})

const props = defineProps(settingsSectionProps)
const slots = useSlots()
const ns = useNamespace('form-section')

const hasTitle = computed(() => Boolean(props.title || slots.title))
const hasDescription = computed(() =>
  Boolean(props.description || slots.description),
)
const hasActions = computed(() => Boolean(slots.actions))
const hasHeader = computed(
  () => hasTitle.value || hasDescription.value || hasActions.value,
)
const sectionKls = computed(() => [
  ns.b(),
  ns.m(props.density),
  ns.is('danger', props.danger),
])
</script>

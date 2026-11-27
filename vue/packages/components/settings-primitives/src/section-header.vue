<template>
  <header :class="sectionKls">
    <div :class="ns.e('heading')">
      <component :is="titleTag" v-if="hasTitle()" :class="ns.e('title')">
        <slot name="title">{{ title }}</slot>
      </component>
      <p v-if="hasDescription()" :class="ns.e('description')">
        <slot name="description">{{ description }}</slot>
      </p>
    </div>
    <div v-if="hasActions()" :class="ns.e('actions')">
      <slot name="actions" />
    </div>
  </header>
</template>

<script lang="ts" setup>
import { useSectionHeading } from './section-heading'
import { sectionHeaderProps } from './shared'

defineOptions({
  name: 'ElSectionHeader',
})

const props = defineProps(sectionHeaderProps)
const { ns, hasTitle, hasDescription, hasActions, sectionKls } =
  useSectionHeading('section-header', props)
</script>

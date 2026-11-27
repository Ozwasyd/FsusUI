<template>
  <section :id="id" :class="sectionKls" :aria-labelledby="ariaLabelledby">
    <header v-if="hasHeader()" :class="ns.e('header')">
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
    <div :class="ns.e('body')">
      <slot />
    </div>
  </section>
</template>

<script lang="ts" setup>
import { useSectionHeading } from './section-heading'
import { settingsSectionProps } from './shared'

defineOptions({
  name: 'ElSettingsSection',
})

const props = defineProps(settingsSectionProps)
const { ns, hasTitle, hasDescription, hasActions, sectionKls } =
  useSectionHeading('settings-section', props)
const hasHeader = () => hasTitle() || hasDescription() || hasActions()
</script>

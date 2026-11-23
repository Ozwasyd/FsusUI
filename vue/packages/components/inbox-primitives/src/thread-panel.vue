<template>
  <section :class="panelKls" :aria-labelledby="panelLabelledBy()">
    <header v-if="hasHeader()" :class="ns.e('header')">
      <div v-if="hasBack()" :class="ns.e('back')">
        <slot name="back" />
      </div>
      <div :class="ns.e('heading')">
        <component
          :is="titleTag"
          v-if="hasTitle()"
          :id="titleId"
          :class="ns.e('title')"
        >
          <slot name="title">{{ title }}</slot>
        </component>
        <div v-if="hasStatus()" :class="ns.e('status')">
          <slot name="status" />
        </div>
      </div>
      <div v-if="hasActions()" :class="ns.e('actions')">
        <slot name="actions" />
      </div>
    </header>
    <div v-if="hasContext()" :class="ns.e('context')">
      <slot name="context" />
    </div>
    <div :class="ns.e('messages')">
      <slot name="messages">
        <slot name="empty" />
      </slot>
    </div>
    <div v-if="hasComposer()" :class="ns.e('composer')">
      <slot name="composer" />
    </div>
  </section>
</template>

<script lang="ts" setup>
import { computed, useId, useSlots } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { threadPanelProps } from './shared'

defineOptions({
  name: 'ElThreadPanel',
})

const props = defineProps(threadPanelProps)
const slots = useSlots()
const ns = useNamespace('thread-panel')
const titleId = useId()

const hasTitle = () => Boolean(props.title || slots.title)
const hasBack = () => Boolean(slots.back)
const hasStatus = () => Boolean(slots.status)
const hasActions = () => Boolean(slots.actions)
const hasHeader = () => hasTitle() || hasBack() || hasStatus() || hasActions()
const hasContext = () => Boolean(slots.context)
const hasComposer = () => Boolean(slots.composer)
const panelKls = computed(() => [ns.b(), ns.m(props.density)])
const panelLabelledBy = () => (hasTitle() ? titleId : undefined)
</script>

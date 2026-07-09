<template>
  <div :class="itemKls" role="listitem">
    <div :class="ns.e('content')">
      <div :class="ns.e('main')">
        <div v-if="hasTitle || hasBadge" :class="ns.e('title-row')">
          <strong v-if="hasTitle" :class="ns.e('title')">
            <slot name="title">{{ title }}</slot>
          </strong>
          <span v-if="hasBadge" :class="ns.e('badge')">
            <slot name="badge" />
          </span>
        </div>
        <div v-if="hasMeta" :class="ns.e('meta')">
          <slot name="meta">{{ description }}</slot>
        </div>
        <slot />
      </div>
      <div v-if="hasActions" :class="ns.e('actions')">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, useSlots } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { resourceListItemProps } from './shared'

defineOptions({
  name: 'ElResourceListItem',
})

const props = defineProps(resourceListItemProps)
const slots = useSlots()
const ns = useNamespace('resource-list-item')

const hasTitle = computed(() => Boolean(props.title || slots.title))
const hasMeta = computed(() => Boolean(props.description || slots.meta))
const hasBadge = computed(() => Boolean(slots.badge))
const hasActions = computed(() => Boolean(slots.actions))
const itemKls = computed(() => [ns.b(), ns.m(props.density)])
</script>

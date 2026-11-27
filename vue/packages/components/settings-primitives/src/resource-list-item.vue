<template>
  <div :class="itemKls" role="listitem">
    <div :class="ns.e('content')">
      <div :class="ns.e('main')">
        <div
          v-if="title || $slots.title || $slots.badge"
          :class="ns.e('title-row')"
        >
          <strong v-if="title || $slots.title" :class="ns.e('title')">
            <slot name="title">{{ title }}</slot>
          </strong>
          <span v-if="$slots.badge" :class="ns.e('badge')">
            <slot name="badge" />
          </span>
        </div>
        <div v-if="description || $slots.meta" :class="ns.e('meta')">
          <slot name="meta">{{ description }}</slot>
        </div>
        <slot />
      </div>
      <div v-if="$slots.actions" :class="ns.e('actions')">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { resourceListItemProps } from './shared'

defineOptions({
  name: 'ElResourceListItem',
})

const props = defineProps(resourceListItemProps)
const ns = useNamespace('resource-list-item')

const itemKls = computed(() => [ns.b(), ns.m(props.density)])
</script>

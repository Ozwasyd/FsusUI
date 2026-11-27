<template>
  <div :class="itemKls" role="listitem">
    <button
      type="button"
      :class="ns.e('button')"
      :disabled="disabled"
      :aria-current="selected ? 'true' : undefined"
      :aria-disabled="disabled ? 'true' : undefined"
      @click="handleSelect"
    >
      <span :class="ns.e('main')">
        <span v-if="title || $slots.title" :class="ns.e('title')">
          <slot name="title">{{ title }}</slot>
        </span>
        <span v-if="preview || $slots.preview" :class="ns.e('preview')">
          <slot name="preview">{{ preview }}</slot>
        </span>
      </span>
      <span :class="ns.e('side')">
        <span v-if="meta || $slots.meta" :class="ns.e('meta')">
          <slot name="meta">{{ meta }}</slot>
        </span>
        <span v-if="$slots.badges" :class="ns.e('badges')">
          <slot name="badges" />
        </span>
        <span
          v-if="unreadCount > 0"
          :class="ns.e('unread')"
          :aria-label="unreadAriaLabel"
        >
          {{ unreadCount }}
        </span>
      </span>
    </button>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { conversationListItemEmits, conversationListItemProps } from './shared'

defineOptions({
  name: 'ElConversationListItem',
})

const props = defineProps(conversationListItemProps)
const emit = defineEmits(conversationListItemEmits)
const ns = useNamespace('conversation-list-item')

const unreadAriaLabel = computed(
  () => `${props.unreadCount} ${props.unreadLabel}`,
)
const itemKls = computed(() => [
  ns.b(),
  ns.m(props.density),
  ns.is('selected', props.selected),
  ns.is('disabled', props.disabled),
])

const handleSelect = (event: MouseEvent) => {
  if (props.disabled) return
  emit('select', event)
}
</script>

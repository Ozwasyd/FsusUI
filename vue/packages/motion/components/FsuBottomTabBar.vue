<template>
  <FsuMobileDock
    class="fsu-bottom-tab-bar"
    :label="label"
    position="bottom"
    :motion="motion"
    :disabled="disabled"
    :safe-area="safeArea"
    :immediate="immediate"
    v-bind="{ 'data-fsus-bottom-tab-bar': '' }"
  >
    <a
      v-for="item in items"
      :key="item.key"
      class="fsu-bottom-tab-bar__item"
      :class="{ 'is-active': item.key === activeKey }"
      :href="item.href"
      :aria-current="item.key === activeKey ? 'page' : undefined"
      v-bind="{ 'data-fsus-bottom-tab-item': item.key }"
      @click="handleItemClick(item, $event)"
    >
      <span class="fsu-bottom-tab-bar__indicator" aria-hidden="true" />
      <span class="fsu-bottom-tab-bar__icon" aria-hidden="true">
        <slot :name="`icon-${item.key}`" :item="item" />
      </span>
      <span class="fsu-bottom-tab-bar__label">{{ item.label }}</span>
    </a>
  </FsuMobileDock>
</template>

<script lang="ts" setup>
import FsuMobileDock from './FsuMobileDock.vue'
import type { FsuBottomTabItem } from './bottom-tab-bar'
import type { MotionPresetName } from '../types'

defineOptions({
  name: 'FsuBottomTabBar',
})

const emit = defineEmits<{
  navigate: [item: FsuBottomTabItem, event: MouseEvent]
}>()

withDefaults(
  defineProps<{
    items: readonly FsuBottomTabItem[]
    activeKey?: string
    label?: string
    motion?: MotionPresetName
    disabled?: boolean
    safeArea?: boolean
    immediate?: boolean
  }>(),
  {
    activeKey: '',
    label: 'Primary navigation',
    motion: 'dock-settle',
    disabled: false,
    safeArea: true,
    immediate: true,
  },
)

function handleItemClick(item: FsuBottomTabItem, event: MouseEvent): void {
  emit('navigate', item, event)
}
</script>

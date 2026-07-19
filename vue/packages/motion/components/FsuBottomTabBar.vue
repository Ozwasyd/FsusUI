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
      v-for="item in visibleItems"
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
    <details
      v-if="overflowItems.length"
      class="fsu-bottom-tab-bar__overflow el-public-shell__mobile-nav-menu"
      v-bind="{ 'data-fsus-bottom-tab-more-menu': '' }"
    >
      <summary
        class="fsu-bottom-tab-bar__item fsu-bottom-tab-bar__more-trigger"
        :class="{ 'is-active': overflowActive }"
        v-bind="{ 'data-fsus-bottom-tab-more': '' }"
      >
        <span class="fsu-bottom-tab-bar__indicator" aria-hidden="true" />
        <span class="fsu-bottom-tab-bar__icon" aria-hidden="true">
          <slot name="icon-more" :items="overflowItems">…</slot>
        </span>
        <span class="fsu-bottom-tab-bar__label">{{ moreLabel }}</span>
      </summary>
      <div
        class="fsu-bottom-tab-bar__overflow-panel el-public-shell__mobile-nav-menu-panel"
        v-bind="{ 'data-fsus-bottom-tab-more-panel': '' }"
      >
        <a
          v-for="item in overflowItems"
          :key="item.key"
          class="el-public-shell__mobile-nav-link"
          :class="{ 'is-active': item.key === activeKey }"
          :href="item.href"
          :aria-current="item.key === activeKey ? 'page' : undefined"
          v-bind="{ 'data-fsus-bottom-tab-item': item.key }"
          @click="handleItemClick(item, $event)"
        >
          {{ item.label }}
        </a>
      </div>
    </details>
  </FsuMobileDock>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import FsuMobileDock from './FsuMobileDock.vue'
import type { FsuBottomTabItem } from './bottom-tab-bar'
import type { MotionPresetName } from '../types'

defineOptions({
  name: 'FsuBottomTabBar',
})

const emit = defineEmits<{
  navigate: [item: FsuBottomTabItem, event: MouseEvent]
}>()

const props = withDefaults(
  defineProps<{
    items: readonly FsuBottomTabItem[]
    activeKey?: string
    label?: string
    moreLabel?: string
    motion?: MotionPresetName
    disabled?: boolean
    safeArea?: boolean
    immediate?: boolean
  }>(),
  {
    activeKey: '',
    label: 'Primary navigation',
    moreLabel: 'More',
    motion: 'dock-settle',
    disabled: false,
    safeArea: true,
    immediate: true,
  },
)

const visibleItems = computed(() =>
  props.items.length > 5 ? props.items.slice(0, 4) : props.items,
)
const overflowItems = computed(() =>
  props.items.length > 5 ? props.items.slice(4) : [],
)
const overflowActive = computed(() =>
  overflowItems.value.some((item) => item.key === props.activeKey),
)

function handleItemClick(item: FsuBottomTabItem, event: MouseEvent): void {
  const overflowMenu = (event.currentTarget as HTMLElement | null)?.closest(
    'details',
  )
  overflowMenu?.removeAttribute('open')
  emit('navigate', item, event)
}
</script>

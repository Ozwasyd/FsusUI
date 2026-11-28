<script setup lang="ts">
defineOptions({ name: 'FsusDivider' })

export interface FsusDividerProps {
  orientation?: 'horizontal' | 'vertical'
  borderStyle?: 'solid' | 'dashed' | 'dotted'
  contentPosition?: 'start' | 'center' | 'end'
  inset?: boolean
}

const {
  orientation = 'horizontal',
  borderStyle = 'solid',
  contentPosition = 'center',
  inset = false,
} = defineProps<FsusDividerProps>()
</script>

<template>
  <div
    class="fsus-divider"
    role="separator"
    :aria-orientation="orientation"
    :data-orientation="orientation"
    :data-border-style="borderStyle"
    :data-inset="inset ? '' : undefined"
  >
    <span
      v-if="$slots.default && orientation === 'horizontal'"
      class="fsus-divider__text"
      :data-position="contentPosition"
    >
      <slot />
    </span>
  </div>
</template>

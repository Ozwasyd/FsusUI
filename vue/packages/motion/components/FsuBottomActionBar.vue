<template>
  <FsuMobileDock
    as="div"
    class="fsu-bottom-action-bar"
    role="toolbar"
    :label="label"
    position="bottom"
    :motion="motion"
    :disabled="disabled"
    :safe-area="safeArea"
    :immediate="immediate"
    bottom-action-bar
  >
    <slot />
  </FsuMobileDock>
</template>

<script lang="ts" setup>
import FsuMobileDock from './FsuMobileDock.vue'
import type { MotionPresetName } from '../types'

defineOptions({
  name: 'FsuBottomActionBar',
})

withDefaults(
  defineProps<{
    label?: string
    motion?: MotionPresetName
    disabled?: boolean
    safeArea?: boolean
    immediate?: boolean
  }>(),
  {
    label: 'Bottom actions',
    motion: 'dock-settle',
    disabled: false,
    safeArea: true,
    immediate: true,
  },
)
</script>

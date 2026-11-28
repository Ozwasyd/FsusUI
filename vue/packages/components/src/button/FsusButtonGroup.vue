<script setup lang="ts">
import { computed, provide } from 'vue'
import type { FsusSize, FsusVariant } from '@fsusui/core'
import { FSUS_BUTTON_GROUP_KEY } from './context'

defineOptions({ name: 'FsusButtonGroup' })

export interface FsusButtonGroupProps {
  size?: FsusSize
  variant?: FsusVariant
  disabled?: boolean
}

const { size, variant, disabled = false } = defineProps<FsusButtonGroupProps>()

provide(
  FSUS_BUTTON_GROUP_KEY,
  computed(() => ({ size, variant, disabled })),
)
</script>

<template>
  <div class="fsus-button-group" role="group">
    <slot />
  </div>
</template>

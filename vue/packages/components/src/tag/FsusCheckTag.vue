<script setup lang="ts">
import type { FsusSize } from '@fsusui/core'

defineOptions({ name: 'FsusCheckTag' })

export interface FsusCheckTagProps {
  size?: FsusSize
  disabled?: boolean
}

const { size = 'md', disabled = false } = defineProps<FsusCheckTagProps>()

const checked = defineModel<boolean>({ default: false })
const emit = defineEmits<{ change: [checked: boolean] }>()

const toggle = () => {
  if (disabled) return
  checked.value = !checked.value
  emit('change', checked.value)
}
</script>

<template>
  <button
    type="button"
    class="fsus-check-tag"
    :aria-pressed="checked ? 'true' : 'false'"
    :disabled="disabled"
    :data-checked="checked ? '' : undefined"
    :data-size="size"
    :data-disabled="disabled ? '' : undefined"
    @click="toggle"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
import type { FsusTone } from '@fsusui/core'
import { FsusIcon, type FsusIconName } from '@fsusui/icons'

defineOptions({ name: 'FsusLink' })

export interface FsusLinkProps {
  href?: string
  target?: string
  rel?: string
  tone?: FsusTone
  underline?: 'always' | 'hover' | 'never'
  disabled?: boolean
  icon?: FsusIconName
}

const {
  href,
  target,
  rel,
  tone = 'info',
  underline = 'hover',
  disabled = false,
  icon,
} = defineProps<FsusLinkProps>()

const emit = defineEmits<{ click: [event: MouseEvent] }>()

const onClick = (event: MouseEvent) => {
  if (disabled) {
    event.preventDefault()
    return
  }
  emit('click', event)
}
</script>

<template>
  <a
    class="fsus-link"
    :href="disabled ? undefined : href"
    :target="target"
    :rel="rel ?? (target === '_blank' ? 'noopener noreferrer' : undefined)"
    :aria-disabled="disabled ? 'true' : undefined"
    :tabindex="disabled ? -1 : undefined"
    :data-tone="tone"
    :data-underline="underline"
    :data-disabled="disabled ? '' : undefined"
    @click="onClick"
  >
    <FsusIcon v-if="icon" :name="icon" class="fsus-link__icon" />
    <span class="fsus-link__label"><slot /></span>
  </a>
</template>

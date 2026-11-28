<script setup lang="ts">
import { useFsusLocale } from '@fsusui/core'
import { FsusIcon, type FsusIconName } from '@fsusui/icons'

defineOptions({ name: 'FsusEmptyState' })

export interface FsusEmptyStateProps {
  title?: string
  description?: string
  variant?: 'inline' | 'compact' | 'page'
  icon?: FsusIconName
}

const { title, description, variant = 'compact', icon } = defineProps<FsusEmptyStateProps>()
const { t } = useFsusLocale()
</script>

<template>
  <section class="fsus-empty-state" :data-variant="variant">
    <div v-if="$slots.icon || icon" class="fsus-empty-state__icon">
      <slot name="icon">
        <FsusIcon v-if="icon" :name="icon" :size="28" />
      </slot>
    </div>
    <p class="fsus-empty-state__title">
      <slot name="title">{{ title ?? t('common.empty') }}</slot>
    </p>
    <p v-if="$slots.description || description" class="fsus-empty-state__description">
      <slot name="description">{{ description }}</slot>
    </p>
    <div v-if="$slots.default || $slots.actions" class="fsus-empty-state__actions">
      <slot name="actions" />
      <slot />
    </div>
  </section>
</template>

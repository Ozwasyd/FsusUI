<script setup lang="ts">
defineOptions({ name: 'FsusCard' })

export interface FsusCardProps {
  header?: string
  footer?: string
  shadow?: 'never' | 'hover' | 'always'
  interactive?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const {
  header,
  footer,
  shadow = 'never',
  interactive = false,
  padding = 'md',
} = defineProps<FsusCardProps>()
</script>

<template>
  <section
    class="fsus-card"
    :data-shadow="shadow"
    :data-interactive="interactive ? '' : undefined"
    :data-padding="padding"
  >
    <header v-if="$slots.header || header" class="fsus-card__header">
      <slot name="header">{{ header }}</slot>
    </header>
    <div class="fsus-card__body">
      <slot />
    </div>
    <footer v-if="$slots.footer || footer" class="fsus-card__footer">
      <slot name="footer">{{ footer }}</slot>
    </footer>
  </section>
</template>

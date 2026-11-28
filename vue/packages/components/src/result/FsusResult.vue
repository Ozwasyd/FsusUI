<script setup lang="ts">
import type { FsusTone } from '@fsusui/core'
import { FsusIcon, type FsusIconName } from '@fsusui/icons'

defineOptions({ name: 'FsusResult' })

export interface FsusResultProps {
  tone?: FsusTone
  title?: string
  subTitle?: string
}

const { tone = 'info', title = '', subTitle = '' } = defineProps<FsusResultProps>()

const iconMap: Record<FsusTone, FsusIconName> = {
  neutral: 'info-filled',
  info: 'info-filled',
  success: 'circle-check-filled',
  warning: 'warning-filled',
  danger: 'circle-close-filled',
}
</script>

<template>
  <section class="fsus-result" :data-tone="tone">
    <div class="fsus-result__icon">
      <slot name="icon">
        <FsusIcon :name="iconMap[tone]" :size="40" />
      </slot>
    </div>
    <h3 v-if="$slots.title || title" class="fsus-result__title">
      <slot name="title">{{ title }}</slot>
    </h3>
    <p v-if="$slots.subTitle || subTitle" class="fsus-result__subtitle">
      <slot name="subTitle">{{ subTitle }}</slot>
    </p>
    <div v-if="$slots.extra" class="fsus-result__extra">
      <slot name="extra" />
    </div>
  </section>
</template>

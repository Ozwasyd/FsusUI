<script setup lang="ts">
import { computed } from 'vue'
import { clamp, type FsusTone } from '@fsusui/core'

defineOptions({ name: 'FsusProgress' })

export interface FsusProgressProps {
  percentage?: number
  type?: 'line' | 'circle'
  tone?: FsusTone
  strokeWidth?: number
  width?: number
  showText?: boolean
  indeterminate?: boolean
  format?: (percentage: number) => string
}

const {
  percentage = 0,
  type = 'line',
  tone = 'info',
  strokeWidth = 6,
  width = 96,
  showText = true,
  indeterminate = false,
  format,
} = defineProps<FsusProgressProps>()

const safePct = computed(() => clamp(percentage, 0, 100))
const label = computed(() => (format ? format(safePct.value) : `${Math.round(safePct.value)}%`))
const radius = computed(() => (width - strokeWidth) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const dashOffset = computed(() => circumference.value * (1 - safePct.value / 100))
</script>

<template>
  <div
    class="fsus-progress"
    role="progressbar"
    :aria-valuenow="indeterminate ? undefined : safePct"
    aria-valuemin="0"
    aria-valuemax="100"
    :data-type="type"
    :data-tone="tone"
    :data-indeterminate="indeterminate ? '' : undefined"
  >
    <template v-if="type === 'line'">
      <div class="fsus-progress__track" :style="{ height: `${strokeWidth}px` }">
        <div
          class="fsus-progress__bar"
          :style="indeterminate ? undefined : { width: `${safePct}%` }"
        />
      </div>
      <span v-if="showText" class="fsus-progress__text">
        <slot :percentage="safePct">{{ label }}</slot>
      </span>
    </template>
    <template v-else>
      <div class="fsus-progress__circle" :style="{ width: `${width}px`, height: `${width}px` }">
        <svg :viewBox="`0 0 ${width} ${width}`">
          <circle
            class="fsus-progress__circle-track"
            :cx="width / 2"
            :cy="width / 2"
            :r="radius"
            :stroke-width="strokeWidth"
            fill="none"
          />
          <circle
            class="fsus-progress__circle-bar"
            :cx="width / 2"
            :cy="width / 2"
            :r="radius"
            :stroke-width="strokeWidth"
            :stroke-dasharray="circumference"
            :stroke-dashoffset="dashOffset"
            fill="none"
          />
        </svg>
        <span v-if="showText" class="fsus-progress__circle-text">
          <slot :percentage="safePct">{{ label }}</slot>
        </span>
      </div>
    </template>
  </div>
</template>

<template>
  <component
    :is="as"
    ref="root"
    class="fsu-mobile-dock"
    :class="{ 'fsu-mobile-dock--safe-area': safeArea }"
    :style="dockStyle"
    :aria-label="label"
    :role="role"
    :data-fsus-mobile-dock="position"
    :data-fsus-bottom-action-bar="bottomActionBar ? '' : undefined"
    :data-fsus-motion-preset="resolvedPreset"
  >
    <slot />
  </component>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { runMotion } from '../runtime'
import type { MotionPresetName } from '../types'

defineOptions({
  name: 'FsuMobileDock',
})

const props = withDefaults(
  defineProps<{
    as?: string
    label?: string
    role?: string
    position?: 'bottom' | 'top'
    motion?: MotionPresetName
    disabled?: boolean
    safeArea?: boolean
    bottomActionBar?: boolean
    immediate?: boolean
  }>(),
  {
    as: 'nav',
    label: 'Mobile actions',
    role: undefined,
    position: 'bottom',
    motion: 'dock-settle',
    disabled: false,
    safeArea: true,
    bottomActionBar: false,
    immediate: true,
  },
)

const root = ref<HTMLElement>()
const resolvedPreset = computed(() => props.motion)
const dockStyle = computed(() =>
  props.safeArea && props.position === 'bottom'
    ? {
        paddingBottom:
          'max(var(--fsus-mobile-dock-padding-bottom, 0px), env(safe-area-inset-bottom))',
      }
    : undefined,
)

const play = async () => {
  await nextTick()
  if (!root.value) return
  runMotion(root.value, { name: props.motion, disabled: props.disabled })
}

onMounted(() => {
  if (props.immediate) void play()
})

watch(
  () => [props.motion, props.disabled, props.position, props.safeArea],
  () => {
    if (props.immediate) void play()
  },
)

defineExpose({ play })
</script>

<template>
  <component :is="as" ref="root" data-fsus-scroll-timeline="natural">
    <slot />
  </component>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useScrollTimeline } from '../composables/use-scroll-timeline'
import type { ScrollTimelineSegment } from '../composables/use-scroll-timeline'

defineOptions({
  name: 'FsuScrollTimeline',
})

const props = withDefaults(
  defineProps<{
    as?: string
    segments?: ScrollTimelineSegment[]
    disabled?: boolean
    once?: boolean
    start?: string
    end?: string
    scrub?: boolean | number
    markers?: boolean
  }>(),
  {
    as: 'section',
    segments: () => [],
    scrub: true,
  },
)

const root = ref<HTMLElement>()
const timeline = useScrollTimeline()

const create = () => {
  timeline.kill()
  if (!root.value) return
  timeline.create({
    target: root.value,
    segments: props.segments,
    disabled: props.disabled,
    once: props.once,
    start: props.start,
    end: props.end,
    scrub: props.scrub,
    markers: props.markers,
  })
}

onMounted(create)
onBeforeUnmount(timeline.kill)

watch(
  () => [
    props.segments,
    props.disabled,
    props.once,
    props.start,
    props.end,
    props.scrub,
    props.markers,
  ],
  create,
  { deep: true },
)
</script>

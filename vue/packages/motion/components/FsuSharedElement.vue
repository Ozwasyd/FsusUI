<template>
  <component
    :is="as"
    ref="root"
    :data-fsus-shared-element-id="id"
    :data-fsus-shared-element-backend="backend"
  >
    <slot />
  </component>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useSharedElementMotion } from '../composables/use-shared-element-motion'

defineOptions({
  name: 'FsuSharedElement',
})

const props = withDefaults(
  defineProps<{
    id: string
    as?: string
    backend?: 'auto' | 'native' | 'flip'
  }>(),
  {
    as: 'div',
    backend: 'auto',
  },
)

const root = ref<HTMLElement>()
const shared = useSharedElementMotion({ backend: props.backend })
let unregister: (() => void) | undefined

onMounted(() => {
  unregister = shared.register(props.id, root)
})

onBeforeUnmount(() => {
  unregister?.()
})
</script>

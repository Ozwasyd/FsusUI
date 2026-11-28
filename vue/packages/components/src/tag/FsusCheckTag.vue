<script setup lang="ts">
defineOptions({ name: 'FsusCheckTag' })

const checked = defineModel<boolean>('checked', { default: false })
const emit = defineEmits<{ change: [checked: boolean] }>()

const toggle = () => {
  const next = !checked.value
  emit('change', next)
  checked.value = next
}
</script>

<template>
  <span
    role="checkbox"
    class="fsus-check-tag"
    tabindex="0"
    :aria-checked="checked ? 'true' : 'false'"
    :data-checked="checked ? '' : undefined"
    @click="toggle"
    @keydown.space.prevent="toggle"
    @keydown.enter.prevent="toggle"
  >
    <slot />
  </span>
</template>

<template>
  <a
    :class="linkKls"
    :href="disabled ? undefined : to"
    :aria-current="active ? 'location' : undefined"
    :aria-disabled="disabled ? 'true' : undefined"
    :tabindex="disabled ? -1 : undefined"
    @click="handleClick"
  >
    <slot />
  </a>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { sectionNavLinkProps } from './shared'

defineOptions({
  name: 'ElSectionNavLink',
})

const props = defineProps(sectionNavLinkProps)
const ns = useNamespace('section-nav')

const linkKls = computed(() => [
  ns.e('link'),
  ns.is('current', props.active),
  ns.is('disabled', props.disabled),
])

const handleClick = (event: MouseEvent) => {
  if (!props.disabled) return
  event.preventDefault()
}
</script>

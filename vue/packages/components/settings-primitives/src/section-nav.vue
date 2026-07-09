<template>
  <nav :class="navKls" :aria-label="ariaLabelAttr" :aria-labelledby="ariaLabelledby">
    <slot>
      <a
        v-for="item in items"
        :key="item.key ?? item.href"
        :class="[ns.e('link'), ns.is('current', item.current), ns.is('disabled', item.disabled)]"
        :href="item.disabled ? undefined : item.href"
        :aria-current="item.current ? 'location' : undefined"
        :aria-disabled="item.disabled ? 'true' : undefined"
        :tabindex="item.disabled ? -1 : undefined"
        @click="handleItemClick($event, item)"
      >
        {{ item.label }}
      </a>
    </slot>
  </nav>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { sectionNavProps, type SectionNavItem } from './shared'

defineOptions({
  name: 'ElSectionNav',
})

const props = defineProps(sectionNavProps)
const ns = useNamespace('section-nav')

const navKls = computed(() => [ns.b(), ns.m(props.density)])
const ariaLabelAttr = computed(() =>
  props.ariaLabelledby ? undefined : props.ariaLabel,
)

const handleItemClick = (event: MouseEvent, item: SectionNavItem) => {
  if (!item.disabled) return
  event.preventDefault()
}
</script>

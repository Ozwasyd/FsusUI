<template>
  <li
    ref="itemRef"
    :aria-selected="selected"
    :style="style"
    :class="[
      ns.be('dropdown', 'option-item'),
      ns.is('selected', selected),
      ns.is('disabled', disabled),
      ns.is('created', created),
      { hover: hovering },
    ]"
    @mouseenter="hoverItem"
    @click.stop="selectOptionClick"
  >
    <slot :item="item" :index="index" :disabled="disabled">
      {{ getLabel(item) }}
    </slot>
  </li>
</template>

<script lang="ts">
import { defineComponent, inject, onMounted, onUpdated, ref } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { useOption } from './useOption'
import { useProps } from './useProps'
import { OptionProps } from './defaults'
import { selectV2InjectionKey } from './token'

export default defineComponent({
  props: OptionProps,
  emits: ['select', 'hover', 'resize'],
  setup(props, { emit }) {
    const select = inject(selectV2InjectionKey)!
    const ns = useNamespace('select')
    const { hoverItem, selectOptionClick } = useOption(props, { emit })
    const { getLabel } = useProps(select.props)
    const itemRef = ref<HTMLElement | null>(null)

    const emitHeight = () => {
      const item = itemRef.value
      if (!item) {
        return
      }

      const measuredHeight = Math.max(item.scrollHeight, item.offsetHeight)
      if (measuredHeight > 0) {
        emit('resize', measuredHeight)
      }
    }

    onMounted(() => {
      emitHeight()
    })

    onUpdated(() => {
      emitHeight()
    })

    return {
      ns,
      hoverItem,
      selectOptionClick,
      getLabel,
      itemRef,
    }
  },
})
</script>

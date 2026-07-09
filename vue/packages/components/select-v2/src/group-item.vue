<template>
  <div
    v-if="item.isTitle"
    ref="itemRef"
    :class="ns.be('group', 'title')"
    :style="[style, { lineHeight: `${height ?? 0}px` }]"
  >
    {{ item.label }}
  </div>
  <div v-else ref="itemRef" :class="ns.be('group', 'split')" :style="style">
    <span
      :class="ns.be('group', 'split-dash')"
      :style="{ top: `${(height ?? 0) / 2}px` }"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, onUpdated, ref } from 'vue'
import { useNamespace } from '@element-plus/hooks'

export default defineComponent({
  props: {
    item: {
      type: Object,
      required: true,
    },
    style: Object,
    height: Number,
  },
  emits: ['resize'],
  setup(_, { emit }) {
    const ns = useNamespace('select')
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
      itemRef,
    }
  },
})
</script>

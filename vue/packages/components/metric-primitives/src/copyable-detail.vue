<template>
  <div :class="detailKls">
    <code :class="ns.e('value')">
      <slot>{{ value }}</slot>
    </code>
    <button
      type="button"
      :class="ns.e('button')"
      :aria-label="label"
      @click="handleCopy"
    >
      <slot name="button">{{ label }}</slot>
    </button>
    <span :class="ns.e('feedback')" aria-live="polite">
      <slot name="feedback" :state="copyState">
        {{ feedbackText }}
      </slot>
    </span>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { copyableDetailEmits, copyableDetailProps } from './shared'

defineOptions({
  name: 'ElCopyableDetail',
})

const props = defineProps(copyableDetailProps)
const emit = defineEmits(copyableDetailEmits)
const ns = useNamespace('copyable-detail')
const copyState = ref<'idle' | 'copied' | 'error'>('idle')

const detailKls = computed(() => [
  ns.b(),
  ns.is('inline', props.inline),
  ns.is('monospace', props.monospace),
])
const feedbackText = computed(() => {
  if (copyState.value === 'copied') return props.copiedLabel
  if (copyState.value === 'error') return props.errorLabel
  return ''
})

const handleCopy = async () => {
  try {
    if (!navigator?.clipboard?.writeText) {
      throw new Error('Clipboard API unavailable')
    }
    await navigator.clipboard.writeText(props.value)
    copyState.value = 'copied'
    emit('copy', props.value)
  } catch (error) {
    copyState.value = 'error'
    emit('copy-error', error)
  }
}
</script>

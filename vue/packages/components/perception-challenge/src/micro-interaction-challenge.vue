<template>
  <section :class="rootKls" :aria-busy="loading || undefined">
    <div v-if="!enabled" :class="ns.e('gate')" v-bind="gateAttrs" role="status">
      {{ gateText }}
    </div>

    <template v-else>
      <div v-if="title || prompt || description" :class="ns.e('copy')">
        <p v-if="title" :class="ns.e('title')">{{ title }}</p>
        <p v-if="prompt" :class="ns.e('prompt')">{{ prompt }}</p>
        <p v-if="description" :class="ns.e('description')">
          {{ description }}
        </p>
      </div>

      <ElButton
        v-bind="submitButtonAttrs"
        type="primary"
        :disabled="disabled || loading || expired"
        :loading="loading"
        @click="submitInteraction"
      >
        {{ actionLabel }}
      </ElButton>
    </template>

    <p v-if="error" :class="ns.e('error')" role="alert">{{ error }}</p>
  </section>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { ElButton } from '@element-plus/components/button'
import {
  microInteractionChallengeEmits,
  microInteractionChallengeProps,
} from './shared'

defineOptions({
  name: 'ElMicroInteractionChallenge',
})

const props = defineProps(microInteractionChallengeProps)
const emit = defineEmits(microInteractionChallengeEmits)
const ns = useNamespace('micro-interaction-challenge')

const rootKls = computed(() => [
  ns.b(),
  ns.is('gated', !props.enabled),
  ns.is('loading', props.loading),
  ns.is('disabled', props.disabled),
  ns.is('expired', props.expired),
])
const gateAttrs = {
  'data-test': 'perception-micro-gated',
}
const submitButtonAttrs = {
  'data-test': 'perception-micro-submit',
}

const submitInteraction = () => {
  if (!props.enabled || props.disabled || props.loading || props.expired) return

  emit('submit', {
    kind: 'micro-interaction',
    steps: ['acknowledged'],
  })
}
</script>

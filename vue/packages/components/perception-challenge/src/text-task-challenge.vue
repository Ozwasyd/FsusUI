<template>
  <section :class="rootKls" :aria-busy="loading || undefined">
    <div v-if="prompt || description" :class="ns.e('copy')">
      <p v-if="prompt" :class="ns.e('prompt')">{{ prompt }}</p>
      <p v-if="description" :class="ns.e('description')">
        {{ description }}
      </p>
    </div>

    <form :class="ns.e('form')" @submit.prevent="submitAnswer">
      <ElInput
        v-model="answer"
        v-bind="inputAttrs"
        :disabled="disabled || loading || expired"
        :placeholder="placeholder"
        @keydown.enter.prevent="submitAnswer"
      />
      <ElButton
        type="primary"
        native-type="submit"
        :disabled="submitDisabled"
        :loading="loading"
      >
        {{ submitLabel }}
      </ElButton>
    </form>

    <p v-if="error" :class="ns.e('error')" role="alert">{{ error }}</p>
  </section>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { UPDATE_MODEL_EVENT } from '@element-plus/constants'
import { useNamespace } from '@element-plus/hooks'
import { ElButton } from '@element-plus/components/button'
import { ElInput } from '@element-plus/components/input'
import { textTaskChallengeEmits, textTaskChallengeProps } from './shared'

defineOptions({
  name: 'ElTextTaskChallenge',
})

const props = defineProps(textTaskChallengeProps)
const emit = defineEmits(textTaskChallengeEmits)
const ns = useNamespace('text-task-challenge')
const internalAnswer = ref(props.modelValue)

const answer = computed({
  get: () => internalAnswer.value,
  set: (value: string) => {
    internalAnswer.value = value
    emit(UPDATE_MODEL_EVENT, value)
  },
})

watch(
  () => props.modelValue,
  (value) => {
    internalAnswer.value = value
  },
)

const rootKls = computed(() => [
  ns.b(),
  ns.is('loading', props.loading),
  ns.is('disabled', props.disabled),
  ns.is('expired', props.expired),
])

const normalizedAnswer = computed(() => answer.value.trim())
const inputAttrs = computed(() => ({
  'aria-label': props.inputLabel,
  autocomplete: 'off',
  enterkeyhint: 'done',
  inputmode: 'text',
}))
const submitDisabled = computed(
  () =>
    props.disabled ||
    props.loading ||
    props.expired ||
    normalizedAnswer.value.length === 0,
)

const submitAnswer = () => {
  if (submitDisabled.value) return

  emit('submit', {
    kind: 'text-task',
    value: normalizedAnswer.value,
  })
}
</script>

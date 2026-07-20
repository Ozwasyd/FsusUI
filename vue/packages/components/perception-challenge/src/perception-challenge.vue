<template>
  <section :class="rootKls" v-bind="rootAttrs" :aria-busy="isBusy">
    <header :class="ns.e('header')">
      <div :class="ns.e('heading')">
        <p v-if="eyebrow" :class="ns.e('eyebrow')">{{ eyebrow }}</p>
        <h3 :class="ns.e('title')">{{ title }}</h3>
      </div>
      <div :class="ns.e('actions')">
        <ElButton
          v-if="isBusy"
          v-bind="cancelButtonAttrs"
          @click="cancelChallenge"
        >
          {{ cancelLabel }}
        </ElButton>
        <ElButton
          v-bind="refreshButtonAttrs"
          :disabled="isBusy || disabled"
          @click="refreshChallenge"
        >
          {{ refreshLabel }}
        </ElButton>
      </div>
    </header>

    <div
      v-if="isLoading && activeKind !== 'character'"
      :class="ns.e('status')"
      v-bind="loadingAttrs"
      role="status"
    >
      {{ loadingText }}
    </div>

    <div
      v-else-if="visibleError && activeKind !== 'character'"
      :class="ns.e('status')"
      role="alert"
    >
      <span>{{ visibleError }}</span>
      <ElButton
        v-if="retryable"
        v-bind="retryButtonAttrs"
        size="small"
        :disabled="disabled"
        @click="retryChallenge"
      >
        {{ retryLabel }}
      </ElButton>
    </div>

    <div
      v-else-if="isExpired && activeKind !== 'character'"
      :class="ns.e('status')"
      v-bind="expiredAttrs"
      role="status"
    >
      <span>{{ expiredText }}</span>
      <ElButton
        v-if="retryable"
        size="small"
        :disabled="disabled"
        @click="retryChallenge"
      >
        {{ retryLabel }}
      </ElButton>
    </div>

    <FsusPerceptionCharacterChallenge
      v-else-if="activeKind === 'character'"
      :challenge-id="activeChallenge?.challengeId"
      :prompt="activeChallenge?.prompt"
      :description="activeChallenge?.description"
      :media="activeCharacterMedia"
      :state="activeCharacterState"
      :disabled="disabled"
      :error="visibleError"
      :refresh-label="refreshLabel"
      :retry-label="retryLabel"
      :reissue-label="reissueLabel"
      :alternative-label="alternativeLabel"
      :raster-label="rasterLabel"
      @refresh="refreshChallenge"
      @retry="retryChallenge"
      @reissue="reissueChallenge"
      @alternative="emit('alternative', $event)"
      @submit="handleSubmit"
    >
      <template v-if="$slots['character-raster']" #raster="slotProps">
        <slot
          name="character-raster"
          :challenge="activeChallenge"
          v-bind="slotProps"
        />
      </template>
      <template v-if="$slots['character-audio']" #audio="slotProps">
        <slot
          name="character-audio"
          :challenge="activeChallenge"
          v-bind="slotProps"
        />
      </template>
    </FsusPerceptionCharacterChallenge>

    <FsusTextTaskChallenge
      v-else-if="activeKind === 'text-task'"
      :prompt="activeChallenge?.prompt"
      :description="activeChallenge?.description"
      :disabled="disabled"
      :loading="isVerifying"
      :error="visibleError"
      @submit="handleSubmit"
    >
      <template #default>
        <slot name="text-task" :challenge="activeChallenge" />
      </template>
    </FsusTextTaskChallenge>

    <FsusLocalizationChallenge
      v-else-if="activeKind === 'localization'"
      :prompt="activeChallenge?.prompt"
      :description="activeChallenge?.description"
      :render-payload="activeRenderPayload"
      :grid-width="
        activeChallenge?.gridWidth || activeRenderPayload?.width || 0
      "
      :grid-height="
        activeChallenge?.gridHeight || activeRenderPayload?.height || 0
      "
      :disabled="disabled"
      :loading="isVerifying"
      :error="visibleError"
      @submit="handleSubmit"
    >
      <template #render="slotProps">
        <slot
          name="localization-render"
          :challenge="activeChallenge"
          v-bind="slotProps"
        />
      </template>
    </FsusLocalizationChallenge>

    <FsusMicroInteractionChallenge
      v-else
      :enabled="activeMicroInteractionEnabled"
      :prompt="activeChallenge?.prompt"
      :description="activeChallenge?.description"
      :disabled="disabled"
      :loading="isVerifying"
      :error="visibleError"
      @submit="handleSubmit"
    >
      <template #default>
        <slot name="micro-interaction" :challenge="activeChallenge" />
      </template>
    </FsusMicroInteractionChallenge>
  </section>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { ElButton } from '@element-plus/components/button'
import FsusLocalizationChallenge from './localization-challenge.vue'
import FsusMicroInteractionChallenge from './micro-interaction-challenge.vue'
import FsusPerceptionCharacterChallenge from './character-challenge.vue'
import FsusTextTaskChallenge from './text-task-challenge.vue'
import { perceptionChallengeEmits, perceptionChallengeProps } from './shared'

import type {
  PerceptionChallengeAssignment,
  PerceptionChallengeRenderPayload,
  PerceptionChallengeState,
  PerceptionChallengeSubmitPayload,
} from './shared'

defineOptions({
  name: 'ElPerceptionChallenge',
})

const props = defineProps(perceptionChallengeProps)
const emit = defineEmits(perceptionChallengeEmits)
const ns = useNamespace('perception-challenge')
const internalChallenge = ref<PerceptionChallengeAssignment | null>(null)
const internalRenderPayload = ref<PerceptionChallengeRenderPayload | null>(null)
const internalState = ref<PerceptionChallengeState>('ready')
const internalError = ref('')
const nowMs = ref(0)
const expiredEmitKey = ref('')
let expiresAtTimer: ReturnType<typeof setTimeout> | undefined

const activeChallenge = computed(
  () => props.challenge ?? internalChallenge.value,
)
const activeKind = computed(() => activeChallenge.value?.kind ?? props.kind)
const activeRenderPayload = computed(
  () =>
    props.renderPayload ??
    activeChallenge.value?.renderPayload ??
    internalRenderPayload.value,
)
const activeCharacterMedia = computed(
  () =>
    props.characterMedia ??
    activeChallenge.value?.characterMedia ??
    (activeRenderPayload.value
      ? { raster: activeRenderPayload.value, audio: null }
      : null),
)
const activeState = computed(() => props.state ?? internalState.value)
const isFailed = computed(
  () =>
    activeState.value === 'error' ||
    activeState.value === 'failed' ||
    activeState.value === 'retryable',
)
const visibleError = computed(() => {
  if (props.error || internalError.value)
    return props.error || internalError.value
  return isFailed.value ? props.failedText : ''
})
const isLoading = computed(() => activeState.value === 'loading')
const isVerifying = computed(
  () => activeState.value === 'verifying' || activeState.value === 'submitting',
)
const isBusy = computed(() => isLoading.value || isVerifying.value)
const isExpired = computed(() => {
  if (props.proofExpired || activeState.value === 'expired') return true

  const expiresAtUnixMs = activeChallenge.value?.expiresAtUnixMs
  return Number.isFinite(expiresAtUnixMs) && expiresAtUnixMs! <= nowMs.value
})
const activeCharacterState = computed<PerceptionChallengeState>(() => {
  if (props.disabled) return 'disabled'
  if (isExpired.value) return 'expired'
  if (activeState.value === 'submitting') return 'verifying'
  if (activeState.value === 'error' || activeState.value === 'failed') {
    return 'retryable'
  }
  if (activeState.value === 'idle' || activeState.value === 'verified') {
    return 'ready'
  }
  return activeState.value
})
const activeMicroInteractionEnabled = computed(
  () =>
    props.microInteractionEnabled ||
    activeChallenge.value?.microInteractionEnabled === true,
)

const rootKls = computed(() => [
  ns.b(),
  ns.m(activeKind.value),
  ns.is('loading', isLoading.value),
  ns.is('verifying', isVerifying.value),
  ns.is('error', Boolean(visibleError.value)),
  ns.is('expired', isExpired.value),
  ns.is('disabled', props.disabled),
])
const rootAttrs = {
  'data-fsus-perception-challenge': 'true',
}
const refreshButtonAttrs = {
  'data-test': 'perception-challenge-refresh',
}
const cancelButtonAttrs = {
  'data-test': 'perception-challenge-cancel',
}
const loadingAttrs = {
  'data-test': 'perception-challenge-loading',
}
const retryButtonAttrs = {
  'data-test': 'perception-challenge-retry',
}
const expiredAttrs = {
  'data-test': 'perception-challenge-expired',
}

watch(
  () => props.challenge,
  (challenge) => {
    if (challenge) {
      internalChallenge.value = null
      void renderChallenge(challenge)
    }
  },
  { immediate: true },
)

onMounted(() => {
  nowMs.value = props.now()

  if (props.autoLoad) {
    void loadChallenge()
  }
})

onBeforeUnmount(() => {
  clearExpirationTimer()
})

watch(
  () => [
    activeChallenge.value?.challengeId ?? '',
    activeChallenge.value?.expiresAtUnixMs ?? 0,
    activeState.value,
    props.proofExpired,
  ],
  () => {
    nowMs.value = props.now()
    scheduleExpirationTimer()
    emitExpiredIfNeeded()
  },
  { immediate: true },
)

async function refreshChallenge() {
  emit('refresh')

  if (!props.client?.refresh || props.disabled || isBusy.value) return

  await loadChallenge()
}

async function retryChallenge() {
  emit('retry')
  await refreshChallenge()
}

async function reissueChallenge() {
  emit('reissue')

  if (!props.client?.refresh || props.disabled || isBusy.value) return
  await loadChallenge()
}

function cancelChallenge() {
  emit('cancel')

  if (!props.state && isBusy.value) {
    internalState.value = 'ready'
  }
}

async function loadChallenge() {
  if (!props.client?.refresh || props.disabled || isBusy.value) return

  internalState.value = 'loading'
  internalError.value = ''

  try {
    const challenge = await props.client.refresh()
    internalChallenge.value = challenge
    internalRenderPayload.value = null

    if (challenge) {
      await renderChallenge(challenge)
    }

    internalState.value = 'ready'
  } catch (error) {
    setError(errorMessage(error, 'perception_challenge_refresh_failed'))
  }
}

async function renderChallenge(challenge: PerceptionChallengeAssignment) {
  if (!props.renderer) return

  try {
    const payload = await props.renderer.render(challenge)
    internalRenderPayload.value = payload
    emit('rendered', payload)
  } catch (error) {
    setError(errorMessage(error, 'perception_challenge_render_failed'))
  }
}

async function handleSubmit(payload: PerceptionChallengeSubmitPayload) {
  const challengeId = activeChallenge.value?.challengeId
  const submittedPayload =
    challengeId && !payload.challengeId ? { ...payload, challengeId } : payload

  emit('submit', submittedPayload)

  if (!props.client?.verify || props.disabled) return

  internalState.value = 'submitting'
  internalError.value = ''

  try {
    const result = await props.client.verify(submittedPayload)

    if (result.verified) {
      internalState.value = 'verified'
      emit('verified', result)
      return
    }

    setError(result.reason || 'perception_challenge_verify_failed')
  } catch (error) {
    setError(errorMessage(error, 'perception_challenge_verify_failed'))
  }
}

function setError(message: string) {
  internalError.value = message
  internalState.value = 'failed'
  emit('error', message)
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function scheduleExpirationTimer() {
  clearExpirationTimer()

  const expiresAtUnixMs = activeChallenge.value?.expiresAtUnixMs
  if (!Number.isFinite(expiresAtUnixMs)) return

  const delay = Math.max(0, expiresAtUnixMs! - nowMs.value)
  expiresAtTimer = setTimeout(() => {
    nowMs.value = props.now()
    emitExpiredIfNeeded()
  }, delay)
}

function clearExpirationTimer() {
  if (!expiresAtTimer) return

  clearTimeout(expiresAtTimer)
  expiresAtTimer = undefined
}

function emitExpiredIfNeeded() {
  const reason = expiredReason()
  if (!reason) return

  const challengeId = activeChallenge.value?.challengeId
  const expiresAtUnixMs = activeChallenge.value?.expiresAtUnixMs ?? ''
  const key = `${challengeId ?? 'anonymous'}:${expiresAtUnixMs}`
  if (expiredEmitKey.value === key) return

  expiredEmitKey.value = key
  emit('expired', {
    challengeId,
    reason,
  })
}

function expiredReason() {
  if (activeState.value === 'expired') return 'state'
  if (props.proofExpired) return 'proofExpired'

  const expiresAtUnixMs = activeChallenge.value?.expiresAtUnixMs
  if (Number.isFinite(expiresAtUnixMs) && expiresAtUnixMs! <= nowMs.value) {
    return 'expiresAtUnixMs'
  }

  return null
}
</script>

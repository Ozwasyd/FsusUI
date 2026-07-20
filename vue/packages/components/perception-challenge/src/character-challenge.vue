<template>
  <section :class="rootKls" :aria-busy="isBusy || undefined" v-bind="rootAttrs">
    <div v-if="prompt || description" :class="ns.e('copy')">
      <p v-if="prompt" :class="ns.e('prompt')">{{ prompt }}</p>
      <p v-if="description" :class="ns.e('description')">
        {{ description }}
      </p>
    </div>

    <div
      :id="statusId"
      :class="ns.e('status')"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span v-if="statusText">{{ statusText }}</span>
      <p v-if="visibleError" :id="errorId" :class="ns.e('error')">
        {{ visibleError }}
      </p>
    </div>

    <template v-if="showsChallenge">
      <div :class="ns.e('media')">
        <template v-if="activeMode === 'raster' && media?.raster">
          <slot name="raster" :media="media.raster" :alt="mediaAlt">
            <img
              v-if="media.raster.kind === 'image-url'"
              :key="mediaIdentity"
              :class="ns.e('image')"
              :src="media.raster.src"
              :width="media.raster.width"
              :height="media.raster.height"
              :alt="mediaAlt"
              draggable="false"
              v-bind="rasterAttrs"
            />
            <canvas
              v-else
              :key="mediaIdentity"
              ref="canvasRef"
              :class="ns.e('canvas')"
              :width="media.raster.width"
              :height="media.raster.height"
              role="img"
              :aria-label="mediaAlt"
              v-bind="rasterAttrs"
            />
          </slot>
        </template>

        <template v-else-if="activeMode === 'audio' && media?.audio">
          <slot name="audio" :media="media.audio" :label="mediaAlt">
            <audio
              :key="mediaIdentity"
              ref="audioRef"
              :class="ns.e('audio')"
              controls
              preload="metadata"
              :aria-label="mediaAlt"
              v-bind="audioAttrs"
            >
              <source :src="media.audio.src" :type="media.audio.type" />
            </audio>
          </slot>
        </template>
      </div>

      <div :class="ns.e('media-actions')">
        <ElButton
          v-if="hasAlternative"
          :disabled="controlsDisabled"
          v-bind="alternativeAttrs"
          @click="toggleAlternative"
        >
          {{ activeMode === 'raster' ? alternativeLabel : rasterLabel }}
        </ElButton>
        <ElButton
          :disabled="controlsDisabled"
          v-bind="refreshAttrs"
          @click="requestReplacement('refresh')"
        >
          {{ refreshLabel }}
        </ElButton>
      </div>

      <form :class="ns.e('form')" @submit.prevent="submitResponse">
        <label :class="ns.e('label')" :for="inputId">{{ inputLabel }}</label>
        <input
          :id="inputId"
          ref="inputRef"
          :class="ns.e('input')"
          :value="response"
          :disabled="controlsDisabled"
          :placeholder="placeholder"
          :aria-invalid="isInvalid"
          :aria-describedby="describedBy"
          autocomplete="off"
          enterkeyhint="done"
          inputmode="text"
          v-bind="inputAttrs"
          @input="updateResponse"
          @keydown.enter.prevent="submitResponse"
        />
        <ElButton
          type="primary"
          native-type="submit"
          :disabled="submitDisabled"
          :loading="isBusy"
          v-bind="submitAttrs"
        >
          {{ submitLabel }}
        </ElButton>
      </form>
    </template>

    <div v-if="state === 'retryable'" :class="ns.e('state-actions')">
      <ElButton
        :disabled="isDisabled"
        v-bind="retryAttrs"
        @click="retryResponse"
      >
        {{ retryLabel }}
      </ElButton>
    </div>

    <div
      v-if="state === 'reissue' || state === 'expired'"
      :class="ns.e('state-actions')"
    >
      <ElButton
        :disabled="isDisabled"
        v-bind="reissueAttrs"
        @click="requestReplacement('reissue')"
      >
        {{ reissueLabel }}
      </ElButton>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useId, useNamespace } from '@element-plus/hooks'
import { ElButton } from '@element-plus/components/button'
import { characterChallengeEmits, characterChallengeProps } from './shared'

import type {
  PerceptionCharacterAudioMedia,
  PerceptionChallengeRenderPayload,
} from './shared'

defineOptions({
  name: 'ElPerceptionCharacterChallenge',
})

defineSlots<{
  raster?: (props: {
    media: PerceptionChallengeRenderPayload
    alt: string
  }) => unknown
  audio?: (props: {
    media: PerceptionCharacterAudioMedia
    label: string
  }) => unknown
}>()

const props = defineProps(characterChallengeProps)
const emit = defineEmits(characterChallengeEmits)
const ns = useNamespace('perception-character-challenge')
const uid = useId().value
const inputId = `${uid}-input`
const statusId = `${uid}-status`
const errorId = `${uid}-error`
const inputRef = ref<HTMLInputElement>()
const canvasRef = ref<HTMLCanvasElement>()
const audioRef = ref<HTMLAudioElement>()
const internalResponse = ref(props.modelValue)
const visibleError = ref(props.error)
const activeMode = ref<'raster' | 'audio'>(
  props.media?.raster ? 'raster' : 'audio',
)
const replacementRequest = ref<{
  identity: string
} | null>(null)
const releasedBitmaps = new WeakSet<ImageBitmap>()
const resourceIdentities = new WeakMap<object, number>()
let nextResourceIdentity = 1
const rootAttrs = { 'data-fsus-perception-character-challenge': 'true' }
const rasterAttrs = { 'data-test': 'perception-character-raster' }
const audioAttrs = { 'data-test': 'perception-character-audio' }
const alternativeAttrs = { 'data-test': 'perception-character-alternative' }
const refreshAttrs = { 'data-test': 'perception-character-refresh' }
const inputAttrs = { 'data-test': 'perception-character-input' }
const submitAttrs = { 'data-test': 'perception-character-submit' }
const retryAttrs = { 'data-test': 'perception-character-retry' }
const reissueAttrs = { 'data-test': 'perception-character-reissue' }

const response = computed({
  get: () => internalResponse.value,
  set: (value: string) => {
    internalResponse.value = value
    emit('update:modelValue', value)
  },
})
const normalizedResponse = computed(() => response.value.trim())
const isBusy = computed(
  () =>
    props.loading || props.state === 'loading' || props.state === 'verifying',
)
const isDisabled = computed(() => props.disabled || props.state === 'disabled')
const controlsDisabled = computed(
  () =>
    isDisabled.value ||
    isBusy.value ||
    props.state === 'expired' ||
    props.state === 'reissue' ||
    props.state === 'unavailable',
)
const showsChallenge = computed(() =>
  ['ready', 'verifying', 'retryable', 'disabled'].includes(props.state),
)
const hasAlternative = computed(() =>
  Boolean(props.media?.raster && props.media?.audio),
)
const isInvalid = computed(() =>
  visibleError.value || props.state === 'retryable' ? 'true' : 'false',
)
const describedBy = computed(() =>
  visibleError.value ? `${statusId} ${errorId}` : statusId,
)
const submitDisabled = computed(
  () => controlsDisabled.value || normalizedResponse.value.length === 0,
)
const statusText = computed(() => {
  if (visibleError.value) return ''
  if (props.state === 'loading') return props.loadingText
  if (props.state === 'verifying') return props.verifyingText
  if (props.state === 'retryable') return props.retryableText
  if (props.state === 'reissue') return props.reissueText
  if (props.state === 'unavailable') return props.unavailableText
  if (props.state === 'expired') return props.expiredText
  if (isDisabled.value) return props.disabledText
  return ''
})
const rootKls = computed(() => [
  ns.b(),
  ns.is(props.state),
  ns.is('disabled', isDisabled.value),
  ns.is('invalid', isInvalid.value === 'true'),
])
const mediaIdentity = computed(() => {
  const mediaKey = props.media ? identityFor(props.media) : 0
  const raster = props.media?.raster
  const rasterKey =
    raster?.kind === 'image-url'
      ? `${raster.kind}:${raster.src}`
      : raster
        ? `${raster.kind}:${identityFor(
            raster.kind === 'bitmap' ? raster.bitmap : raster.pixels,
          )}:${raster.width}x${raster.height}`
        : ''
  return `${props.challengeId}:${mediaKey}:${rasterKey}:${props.media?.audio?.src ?? ''}`
})

function identityFor(resource: object) {
  const existing = resourceIdentities.get(resource)
  if (existing) return existing
  const identity = nextResourceIdentity++
  resourceIdentities.set(resource, identity)
  return identity
}

watch(
  () => props.modelValue,
  (value) => {
    internalResponse.value = value
  },
)

watch(
  () => props.error,
  (error) => {
    visibleError.value = error
  },
)

watch(mediaIdentity, (identity, previousIdentity) => {
  if (identity === previousIdentity) return
  reset()
  visibleError.value = ''
  selectAvailableMode()
})

watch(
  () => props.media,
  (media, previousMedia) => {
    releaseReplacedMedia(previousMedia, media)
    selectAvailableMode()
    void drawRaster()
  },
)

watch(
  () => [mediaIdentity.value, props.state] as const,
  async ([identity, state]) => {
    const request = replacementRequest.value
    if (!request || request.identity === identity || state !== 'ready') return

    replacementRequest.value = null
    await nextTick()
    focus()
  },
)

watch(
  () => [activeMode.value, props.media?.raster] as const,
  () => void drawRaster(),
  { immediate: true, deep: true },
)

function selectAvailableMode() {
  if (activeMode.value === 'raster' && props.media?.raster) return
  if (activeMode.value === 'audio' && props.media?.audio) return
  activeMode.value = props.media?.raster ? 'raster' : 'audio'
}

async function drawRaster() {
  await nextTick()
  const raster = props.media?.raster
  const canvas = canvasRef.value
  if (!canvas) return

  const context = canvas.getContext('2d')
  if (!context) return

  context.clearRect(0, 0, canvas.width, canvas.height)
  if (!raster || raster.kind === 'image-url') return
  if (raster.kind === 'bitmap') {
    context.drawImage(raster.bitmap, 0, 0)
    return
  }

  context.putImageData(
    new ImageData(
      new Uint8ClampedArray(raster.pixels),
      raster.width,
      raster.height,
    ),
    0,
    0,
  )
}

function releaseReplacedMedia(
  previousMedia: typeof props.media,
  nextMedia: typeof props.media,
) {
  const previousBitmap =
    previousMedia?.raster?.kind === 'bitmap'
      ? previousMedia.raster.bitmap
      : undefined
  const nextBitmap =
    nextMedia?.raster?.kind === 'bitmap' ? nextMedia.raster.bitmap : undefined
  if (
    previousBitmap &&
    previousBitmap !== nextBitmap &&
    !releasedBitmaps.has(previousBitmap)
  ) {
    if (typeof previousBitmap.close === 'function') previousBitmap.close()
    releasedBitmaps.add(previousBitmap)
  }

  if (
    previousMedia?.audio !== nextMedia?.audio ||
    previousMedia?.audio?.src !== nextMedia?.audio?.src
  ) {
    invalidateAudioElement()
  }
}

function invalidateAudioElement() {
  const audio = audioRef.value
  if (!audio) return
  if (!audio.paused) audio.pause()
  audio.removeAttribute('src')
  for (const source of audio.querySelectorAll('source')) {
    source.removeAttribute('src')
  }
  if (audio.networkState !== HTMLMediaElement.NETWORK_EMPTY) audio.load()
}

function toggleAlternative() {
  if (!hasAlternative.value || controlsDisabled.value) return
  activeMode.value = activeMode.value === 'raster' ? 'audio' : 'raster'
  emit('alternative', activeMode.value)
}

function requestReplacement(action: 'refresh' | 'reissue') {
  if (isDisabled.value || isBusy.value) return
  replacementRequest.value = { identity: mediaIdentity.value }
  if (action === 'refresh') emit('refresh')
  else emit('reissue')
}

function retryResponse() {
  if (isDisabled.value) return
  visibleError.value = ''
  emit('retry')
  focus()
}

function submitResponse() {
  if (submitDisabled.value) return
  emit('submit', {
    kind: 'character',
    value: normalizedResponse.value,
    ...(props.challengeId ? { challengeId: props.challengeId } : {}),
  })
}

function updateResponse(event: Event) {
  response.value = (event.target as HTMLInputElement).value
}

function focus() {
  inputRef.value?.focus()
}

function reset() {
  internalResponse.value = ''
  visibleError.value = ''
  emit('update:modelValue', '')
}

onBeforeUnmount(() => {
  releaseReplacedMedia(props.media, null)
  invalidateAudioElement()
})

defineExpose({
  focus,
  reset,
  inputRef,
})
</script>

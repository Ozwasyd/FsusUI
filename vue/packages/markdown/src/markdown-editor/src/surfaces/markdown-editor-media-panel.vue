<template>
  <form
    :class="ns.e('media-properties')"
    :aria-label="localeText.imageProperties.region"
    @submit.prevent="emit('apply')"
  >
    <label>
      <span>{{ localeText.imageProperties.alt }}</span>
      <input
        :value="alt"
        :disabled="editingBlocked"
        @input="
          emit('update:alt', ($event.target as HTMLInputElement).value)
        "
      />
    </label>
    <label>
      <span>{{ localeText.imageProperties.destination }}</span>
      <input
        :value="destination"
        :aria-invalid="error ? 'true' : undefined"
        :disabled="editingBlocked"
        @input="
          emit('update:destination', ($event.target as HTMLInputElement).value)
        "
      />
    </label>
    <label>
      <span>{{ localeText.imageProperties.title }}</span>
      <input
        :value="title"
        :disabled="editingBlocked"
        @input="
          emit('update:title', ($event.target as HTMLInputElement).value)
        "
      />
    </label>
    <label>
      <span>{{ localeText.imageProperties.caption }}</span>
      <input
        :value="caption"
        :disabled="editingBlocked"
        @input="
          emit('update:caption', ($event.target as HTMLInputElement).value)
        "
      />
    </label>
    <p v-if="error" role="alert">
      {{ error }}
    </p>
    <div :class="ns.e('media-actions')">
      <button type="submit" :disabled="editingBlocked">
        {{ localeText.imageProperties.apply }}
      </button>
      <button
        type="button"
        :disabled="editingBlocked"
        @click="emit('reveal-source')"
      >
        {{ localeText.imageProperties.source }}
      </button>
      <button type="button" :disabled="!openAllowed" @click="emit('open')">
        {{ localeText.imageProperties.open }}
      </button>
      <button type="button" @click="emit('copy', 'exact')">
        {{ localeText.imageProperties.copySource }}
      </button>
      <button
        v-if="hasFigure"
        type="button"
        @click="emit('copy', 'visible')"
      >
        {{ localeText.imageProperties.copyVisible }}
      </button>
      <button
        type="button"
        :disabled="editingBlocked"
        @click="emit('replace')"
      >
        {{ localeText.imageProperties.replace }}
      </button>
      <button
        v-if="hasFigure"
        type="button"
        :disabled="editingBlocked"
        @click="emit('remove-caption')"
      >
        {{ localeText.imageProperties.removeCaption }}
      </button>
      <button
        type="button"
        :disabled="editingBlocked"
        @click="emit('remove-image')"
      >
        {{ localeText.imageProperties.removeImage }}
      </button>
    </div>
  </form>
</template>

<script lang="ts" setup>
import { useNamespace } from '../../../internal/bridge'
import type { MarkdownEditorLocaleText } from '../markdown-editor'

defineProps<{
  alt: string
  caption: string
  destination: string
  editingBlocked: boolean
  error: string
  hasFigure: boolean
  localeText: MarkdownEditorLocaleText
  openAllowed: boolean
  title: string
}>()

const emit = defineEmits<{
  apply: []
  copy: [mode: 'exact' | 'visible']
  open: []
  'remove-caption': []
  'remove-image': []
  replace: []
  'reveal-source': []
  'update:alt': [value: string]
  'update:caption': [value: string]
  'update:destination': [value: string]
  'update:title': [value: string]
}>()

const ns = useNamespace('markdown-editor')
</script>

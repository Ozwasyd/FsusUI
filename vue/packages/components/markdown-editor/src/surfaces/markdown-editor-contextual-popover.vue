<template>
  <form
    v-if="surface === 'link-properties' && activeLink"
    ref="formRef"
    :class="ns.e('property-surface')"
    role="dialog"
    :aria-label="localeText.contextual.editLink"
    :data-markdown-anchor-id="activeLinkNodeId"
    :data-markdown-anchor-epoch="documentEpoch"
    @submit.prevent="emit('apply-link')"
    @keydown.esc.prevent.stop="emit('close')"
  >
    <label :class="ns.e('property-field')">
      <span>{{ localeText.contextual.label }}</span>
      <input
        :value="linkLabel"
        type="text"
        @input="
          emit('update:linkLabel', ($event.target as HTMLInputElement).value)
        "
      />
    </label>
    <label
      v-if="activeLink.ranges.destination"
      :class="ns.e('property-field')"
    >
      <span>{{ localeText.contextual.destination }}</span>
      <input
        :value="linkDestination"
        type="url"
        @input="
          emit(
            'update:linkDestination',
            ($event.target as HTMLInputElement).value,
          )
        "
      />
    </label>
    <label v-if="activeLink.kind === 'inline'" :class="ns.e('property-field')">
      <span>{{ localeText.contextual.title }}</span>
      <input
        :value="linkTitle"
        type="text"
        @input="
          emit('update:linkTitle', ($event.target as HTMLInputElement).value)
        "
      />
    </label>
    <p v-if="error" role="alert">{{ error }}</p>
    <footer :class="ns.e('property-actions')">
      <button type="submit">{{ localeText.contextual.apply }}</button>
      <button v-if="activeLink.url" type="button" @click="emit('open-link')">
        {{ localeText.contextual.open }}
      </button>
      <button type="button" @click="emit('copy-link')">
        {{ localeText.contextual.copy }}
      </button>
      <button type="button" @click="emit('reveal-link')">
        {{ localeText.contextual.sourceReveal }}
      </button>
      <button type="button" @click="emit('remove-link')">
        {{ localeText.contextual.removeLink }}
      </button>
      <button type="button" @click="emit('close')">
        {{ localeText.contextual.cancel }}
      </button>
    </footer>
  </form>

  <form
    v-else-if="surface === 'anchor-properties'"
    ref="formRef"
    :class="ns.e('property-surface')"
    role="dialog"
    :aria-label="
      activeAnchor
        ? localeText.contextual.editAnchor
        : localeText.contextual.insertAnchor
    "
    :data-markdown-anchor-id="activeAnchorNodeId"
    :data-markdown-anchor-epoch="documentEpoch"
    @submit.prevent="emit('apply-anchor')"
    @keydown.esc.prevent.stop="emit('close')"
  >
    <label :class="ns.e('property-field')">
      <span>{{ localeText.contextual.anchorId }}</span>
      <input
        :value="anchorId"
        type="text"
        autocomplete="off"
        pattern="[a-z][a-z0-9-]{0,63}"
        required
        @input="
          emit('update:anchorId', ($event.target as HTMLInputElement).value)
        "
      />
    </label>
    <p v-if="error" role="alert">{{ error }}</p>
    <footer :class="ns.e('property-actions')">
      <button type="submit">{{ localeText.contextual.apply }}</button>
      <button v-if="activeAnchor" type="button" @click="emit('copy-anchor')">
        {{ localeText.contextual.copy }}
      </button>
      <button
        v-if="activeAnchor"
        type="button"
        @click="emit('remove-anchor')"
      >
        {{ localeText.contextual.removeAnchor }}
      </button>
      <button type="button" @click="emit('close')">
        {{ localeText.contextual.cancel }}
      </button>
    </footer>
  </form>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import type { MarkdownEditorLocaleText } from '../markdown-editor'
import type { MarkdownProjectedAnchor } from '../markdown-editor-anchor-commands'
import type { MarkdownParsedLink } from '../markdown-editor-link-image'

defineProps<{
  activeAnchor?: MarkdownProjectedAnchor
  activeAnchorNodeId: string
  activeLink?: MarkdownParsedLink
  activeLinkNodeId: string
  anchorId: string
  documentEpoch: number
  error: string
  linkDestination: string
  linkLabel: string
  linkTitle: string
  localeText: MarkdownEditorLocaleText
  surface: 'anchor-properties' | 'link-properties' | null
}>()

const emit = defineEmits<{
  'apply-anchor': []
  'apply-link': []
  close: []
  'copy-anchor': []
  'copy-link': []
  'open-link': []
  'remove-anchor': []
  'remove-link': []
  'reveal-link': []
  'update:anchorId': [value: string]
  'update:linkDestination': [value: string]
  'update:linkLabel': [value: string]
  'update:linkTitle': [value: string]
}>()

const ns = useNamespace('markdown-editor')
const formRef = ref<HTMLElement | null>(null)

const focusFirstInput = () => {
  formRef.value?.querySelector<HTMLInputElement>('input')?.focus()
}

defineExpose({
  focusFirstInput,
})
</script>

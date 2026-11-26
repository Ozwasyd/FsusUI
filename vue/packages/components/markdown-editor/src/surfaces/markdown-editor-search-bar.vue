<template>
  <div
    :class="[
      ns.e('search-bar'),
      ns.is('compact', true),
      ns.is('replace', searchUiState.replaceOpen),
    ]"
    role="search"
    :aria-label="searchUiState.aria.ariaLabel"
  >
    <div :class="ns.e('search-row')">
      <input
        ref="queryInputRef"
        :value="query"
        type="text"
        :class="ns.e('search-input')"
        :placeholder="localeText.search.find"
        :aria-label="searchUiState.aria.queryAriaLabel"
        data-testid="markdown-search-query"
        @input="onQueryInput"
        @keydown="emit('query-keydown', $event)"
      />
      <span
        :class="ns.e('search-count')"
        role="status"
        :aria-live="searchUiState.aria.statusAriaLive"
        data-testid="markdown-search-count"
      >
        {{ searchUiState.statusText }}
      </span>
      <button
        type="button"
        :class="[
          ns.e('search-toggle'),
          ns.is('active', searchMode === 'plain-case'),
        ]"
        :aria-label="localeText.search.matchCase"
        :title="localeText.search.matchCase"
        @click="emit('toggle-mode', 'plain-case')"
      >
        Aa
      </button>
      <button
        type="button"
        :class="[
          ns.e('search-toggle'),
          ns.is('active', searchMode === 'whole-word'),
        ]"
        :aria-label="localeText.search.wholeWord"
        :title="localeText.search.wholeWord"
        @click="emit('toggle-mode', 'whole-word')"
      >
        &#92;b
      </button>
      <button
        type="button"
        :class="[
          ns.e('search-toggle'),
          ns.is('active', searchMode === 'regex'),
        ]"
        :aria-label="localeText.search.useRegex"
        :title="localeText.search.useRegex"
        @click="emit('toggle-mode', 'regex')"
      >
        .*
      </button>
      <button
        type="button"
        :class="ns.e('search-nav')"
        :disabled="!hasMatches"
        :aria-label="localeText.search.previousMatch"
        :title="localeText.search.previousMatch"
        data-testid="markdown-search-prev"
        @click="emit('navigate', 'previous')"
      >
        ↑
      </button>
      <button
        type="button"
        :class="ns.e('search-nav')"
        :disabled="!hasMatches"
        :aria-label="localeText.search.nextMatch"
        :title="localeText.search.nextMatch"
        data-testid="markdown-search-next"
        @click="emit('navigate', 'next')"
      >
        ↓
      </button>
      <button
        type="button"
        :class="[
          ns.e('search-toggle'),
          ns.is('active', searchUiState.replaceOpen),
        ]"
        :aria-label="localeText.search.toggleReplace"
        :title="localeText.search.toggleReplace"
        @click="emit('toggle-replace')"
      >
        ⇄
      </button>
      <button
        type="button"
        :class="ns.e('search-close')"
        :aria-label="localeText.search.close"
        :title="localeText.search.close"
        data-testid="markdown-search-close"
        @click="emit('close')"
      >
        ×
      </button>
    </div>
    <div v-if="searchUiState.replaceOpen" :class="ns.e('search-row')">
      <input
        ref="replaceInputRef"
        :value="replaceText"
        type="text"
        :class="ns.e('search-input')"
        :placeholder="localeText.search.replace"
        :aria-label="searchUiState.aria.replaceAriaLabel"
        data-testid="markdown-search-replace"
        @input="onReplaceInput"
        @keydown="emit('replace-keydown', $event)"
      />
      <button
        type="button"
        :class="ns.e('search-action')"
        :disabled="!hasMatches || editingBlocked"
        data-testid="markdown-search-replace-current"
        @click="emit('replace-current')"
      >
        {{ localeText.search.replace }}
      </button>
      <button
        type="button"
        :class="ns.e('search-action')"
        :disabled="!hasMatches || editingBlocked"
        data-testid="markdown-search-replace-all"
        @click="emit('replace-all')"
      >
        {{ localeText.search.replaceAll }}
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import type { MarkdownSearchMode } from '../../../../wasm/markdown-search-model'
import type { MarkdownEditorLocaleText } from '../markdown-editor'
import type { MarkdownSearchUiState } from '../markdown-editor-search-ui'

defineProps<{
  editingBlocked: boolean
  hasMatches: boolean
  localeText: MarkdownEditorLocaleText
  query: string
  replaceText: string
  searchMode: MarkdownSearchMode
  searchUiState: MarkdownSearchUiState
}>()

const emit = defineEmits<{
  close: []
  navigate: [direction: 'next' | 'previous']
  'query-input': []
  'query-keydown': [event: KeyboardEvent]
  'replace-all': []
  'replace-current': []
  'replace-keydown': [event: KeyboardEvent]
  'toggle-mode': [mode: MarkdownSearchMode]
  'toggle-replace': []
  'update:query': [value: string]
  'update:replaceText': [value: string]
}>()

const ns = useNamespace('markdown-editor')
const queryInputRef = ref<HTMLInputElement | null>(null)
const replaceInputRef = ref<HTMLInputElement | null>(null)

const onQueryInput = (event: Event) => {
  emit('update:query', (event.target as HTMLInputElement).value)
  emit('query-input')
}

const onReplaceInput = (event: Event) => {
  emit('update:replaceText', (event.target as HTMLInputElement).value)
}

const focusInput = (replace = false) => {
  if (replace && replaceInputRef.value) {
    replaceInputRef.value.focus()
  } else {
    queryInputRef.value?.focus()
  }
}

defineExpose({
  focusInput,
})
</script>

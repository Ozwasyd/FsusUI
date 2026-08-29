<template>
  <main
    data-testid="interaction-trace-fixture"
    aria-label="Real Vue interaction trace fixture"
  >
    <section aria-label="Representative component interactions">
      <el-button type="primary" @click="recordEvent('button.click')">
        Save draft
      </el-button>

      <el-input
        v-model="inputValue"
        placeholder="Trace input"
        @input="recordEvent('input.input', $event)"
        @change="recordEvent('input.change', $event)"
      />

      <el-button @click="dialogOpen = true"> Open trace dialog </el-button>
      <el-dialog
        v-model="dialogOpen"
        title="Trace dialog"
        @open="recordEvent('dialog.open')"
        @opened="recordEvent('dialog.opened')"
        @close="recordEvent('dialog.close')"
        @closed="recordEvent('dialog.closed')"
      >
        <p data-testid="trace-dialog-content">Real default slot content</p>
        <template #footer>
          <el-button @click="dialogOpen = false">
            Close trace dialog
          </el-button>
        </template>
      </el-dialog>
    </section>

    <section aria-label="Markdown editor trace interactions">
      <div data-testid="trace-markdown-editor">
        <el-markdown-editor
          ref="markdownEditor"
          v-model="markdownValue"
          :min-rows="6"
          :show-actions="false"
          :show-mode-switcher="false"
          default-mode="source"
          @change="recordEvent('markdown.change', $event)"
          @command="recordEvent('markdown.command', $event.key)"
          @history-change="recordMarkdownHistory"
          @selection-change="recordMarkdownSelection"
          @transaction="recordMarkdownTransaction"
          @update:model-value="
            recordEvent('markdown.update:modelValue', $event)
          "
        />
      </div>
      <div aria-label="Markdown exposed method controls">
        <button
          type="button"
          data-testid="trace-markdown-exposed"
          @click="dispatchExposedTransaction"
        >
          Dispatch exposed transaction
        </button>
        <button
          type="button"
          data-testid="trace-markdown-undo"
          @click="runExposedUndo"
        >
          Undo through exposed method
        </button>
      </div>
    </section>

    <output data-testid="interaction-trace-state">
      {{ JSON.stringify(publicState) }}
    </output>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { resolveMarkdownLiveCapability } from '../../element-plus'

import type {
  MarkdownEditorDispatchResult,
  MarkdownEditorDocumentIdentity,
  MarkdownEditorHistoryState,
  MarkdownEditorInstance,
  MarkdownEditorSelectionEvent,
  MarkdownEditorTransactionEvent,
} from '../../element-plus'

interface TraceEvent {
  readonly name: string
  readonly payload?: unknown
}

const events = ref<TraceEvent[]>([])
const inputValue = ref('')
const dialogOpen = ref(false)
const markdownEditor = ref<MarkdownEditorInstance>()
const markdownValue = ref('Trace start')
const markdownHistory = ref<MarkdownEditorHistoryState>({
  canRedo: false,
  canUndo: false,
  redoDepth: 0,
  retainedUnits: 0,
  undoDepth: 0,
})
const markdownSelection = ref<MarkdownEditorSelectionEvent | null>(null)
const markdownLastOperation = ref<MarkdownEditorDispatchResult | null>(null)
const markdownDocumentIdentity: MarkdownEditorDocumentIdentity = Object.freeze({
  id: 'markdown-editor-interaction-trace',
  epoch: 347,
})

const recordEvent = (name: string, payload?: unknown) => {
  events.value.push(payload === undefined ? { name } : { name, payload })
}

const recordMarkdownHistory = (history: MarkdownEditorHistoryState) => {
  markdownHistory.value = history
  recordEvent('markdown.history-change', history)
}

const recordMarkdownSelection = (selection: MarkdownEditorSelectionEvent) => {
  markdownSelection.value = selection
  recordEvent('markdown.selection-change', selection)
}

const recordMarkdownTransaction = (
  transaction: MarkdownEditorTransactionEvent,
) => {
  markdownLastOperation.value = transaction
  recordEvent('markdown.transaction', {
    accepted: transaction.accepted,
    origin: transaction.transaction.origin,
    revision: transaction.revision,
  })
}

const dispatchExposedTransaction = () => {
  const from = markdownValue.value.length
  const result = markdownEditor.value?.dispatchTransaction({
    changes: [{ from, insert: ' exposed', to: from }],
    history: 'separate',
    metadata: { fixture: 'exposed-method' },
    origin: 'programmatic',
    selection: {
      direction: 'none',
      start: from + ' exposed'.length,
      end: from + ' exposed'.length,
    },
  })
  if (result) markdownLastOperation.value = result
  recordEvent('markdown.exposed.dispatchTransaction', {
    accepted: result?.accepted ?? false,
    revision: result?.revision ?? -1,
  })
}

const runExposedUndo = () => {
  const result = markdownEditor.value?.undo()
  if (result) markdownLastOperation.value = result
  recordEvent('markdown.exposed.undo', {
    accepted: result?.accepted ?? false,
    revision: result?.revision ?? -1,
  })
}

const markdownRevision = computed(
  () =>
    markdownLastOperation.value?.revision ??
    markdownSelection.value?.revision ??
    0,
)
const markdownCapability = computed(() =>
  resolveMarkdownLiveCapability('supported', {
    documentIdentity: markdownDocumentIdentity,
    revision: markdownRevision.value,
  }),
)
const publicState = computed(() => ({
  runtimeMount: 'vue',
  eventNames: events.value.map((event) => event.name),
  input: {
    value: inputValue.value,
  },
  dialog: {
    open: dialogOpen.value,
  },
  markdown: {
    capability: markdownCapability.value,
    documentIdentity: markdownDocumentIdentity,
    history: markdownHistory.value,
    lastOperation: markdownLastOperation.value,
    revision: markdownRevision.value,
    selection: markdownSelection.value?.selection ?? null,
    value: markdownValue.value,
  },
}))
</script>

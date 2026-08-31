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

    <section aria-label="CheckTag trace interactions">
      <el-check-tag
        v-if="checkTagVisible"
        :checked="checkTagChecked"
        data-testid="trace-check-tag"
        @change="recordCheckTagEvent('change', $event)"
        @update:checked="updateCheckTag"
      >
        Check tag
      </el-check-tag>
    </section>

    <section aria-label="Markdown editor trace interactions">
      <div data-testid="trace-markdown-editor">
        <el-markdown-editor
          :key="markdownDocumentKey"
          ref="markdownEditor"
          v-model="markdownValue"
          :document-identity="markdownDocumentIdentity"
          :editor-profile="markdownProfile"
          :lang="markdownLocale"
          :min-rows="6"
          :mode="markdownMode"
          :readonly="markdownReadonly"
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
      <div data-testid="trace-markdown-atomic-editor">
        <el-markdown-editor
          v-model="markdownAtomicValue"
          :document-identity="markdownAtomicIdentity"
          :min-rows="3"
          :show-actions="false"
          :show-mode-switcher="false"
          default-mode="live"
        />
      </div>
    </section>

    <output data-testid="interaction-trace-state">
      {{ JSON.stringify(publicState) }}
    </output>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { resolveMarkdownLiveCapability } from '../../element-plus'
import {
  createMarkdownEditorProjection,
  createMarkdownSourceCoordinateMap,
  stabilizeMarkdownEditorProjection,
} from '../../element-plus/markdown-runtime'

import type {
  MarkdownEditorDispatchResult,
  MarkdownEditorDocumentIdentity,
  MarkdownEditorHistoryState,
  MarkdownEditorInstance,
  MarkdownEditorMode,
  MarkdownEditorSelectionEvent,
  MarkdownEditorTransaction,
  MarkdownEditorTransactionEvent,
} from '../../element-plus'

interface TraceEvent {
  readonly name: string
  readonly payload?: unknown
}

const events = ref<TraceEvent[]>([])
const inputValue = ref('')
const dialogOpen = ref(false)
const checkTagChecked = ref(false)
const checkTagRevision = ref(0)
const checkTagVisible = ref(true)
const markdownEditor = ref<MarkdownEditorInstance>()
const markdownValue = ref('Trace start')
const markdownAtomicValue = ref('```\natomic\n```\n')
const markdownHistory = ref<MarkdownEditorHistoryState>({
  canRedo: false,
  canUndo: false,
  redoDepth: 0,
  retainedUnits: 0,
  undoDepth: 0,
})
const markdownSelection = ref<MarkdownEditorSelectionEvent | null>(null)
const markdownLastOperation = ref<MarkdownEditorDispatchResult | null>(null)
const markdownDocumentIdentity = ref<MarkdownEditorDocumentIdentity>(
  Object.freeze({
    id: 'markdown-editor-interaction-trace',
    epoch: 348,
  }),
)
const markdownDocumentKey = ref(0)
const markdownMode = ref<MarkdownEditorMode>('source')
const markdownReadonly = ref(false)
const markdownProfile = ref('markdown')
const markdownLocale = ref('zh-CN')
const markdownAtomicIdentity: MarkdownEditorDocumentIdentity = Object.freeze({
  id: 'markdown-editor-interaction-trace-atomic',
  epoch: 349,
})

const recordEvent = (name: string, payload?: unknown) => {
  events.value.push(payload === undefined ? { name } : { name, payload })
}

const recordCheckTagEvent = (name: string, checked: boolean) => {
  recordEvent(`check-tag.${name}`, checked)
}

const updateCheckTag = (checked: boolean) => {
  checkTagChecked.value = checked
  checkTagRevision.value += 1
  recordCheckTagEvent('update:checked', checked)
}

const measureCheckTagMount = async () => {
  checkTagVisible.value = false
  await nextTick()
  const startedAt = performance.now()
  checkTagVisible.value = true
  await nextTick()
  return performance.now() - startedAt
}

;(
  window as Window & {
    __fsusMeasureCheckTagMount?: () => Promise<number>
  }
).__fsusMeasureCheckTagMount = measureCheckTagMount

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

const serializeMarkdownOperation = (
  result: MarkdownEditorDispatchResult | null | undefined,
) => {
  if (!result) return null
  const positionMap = result.positionMap
  return {
    accepted: result.accepted,
    beforeRevision: result.beforeRevision,
    documentIdentity: result.documentIdentity,
    history: result.history,
    positionMap: positionMap
      ? {
          mappedOffsets: [
            {
              association: -1,
              mapped: positionMap.map(0, -1),
              source: 0,
            },
            {
              association: 1,
              mapped: positionMap.map(0, 1),
              source: 0,
            },
            {
              association: -1,
              mapped: positionMap.map(result.value.length, -1),
              source: result.value.length,
            },
          ],
          range: positionMap.mapRange({
            end: Math.min(5, result.value.length),
            start: 0,
          }),
        }
      : null,
    reason: result.reason ?? null,
    revision: result.revision,
    selection: result.selection,
    value: result.value,
  }
}

const readMountedMarkdownState = async () => {
  await nextTick()
  const root = document.querySelector(
    '[data-testid="trace-markdown-editor"] .el-markdown-editor',
  )
  const textarea = root?.querySelector('textarea')
  return {
    capability: markdownCapability.value,
    document: markdownValue.value,
    documentIdentity: markdownDocumentIdentity.value,
    history: markdownHistory.value,
    input: {
      focused: document.activeElement === textarea,
      lang: textarea?.lang ?? null,
      readOnly: textarea?.readOnly ?? null,
      selection: textarea
        ? {
            direction: textarea.selectionDirection,
            end: textarea.selectionEnd,
            start: textarea.selectionStart,
          }
        : null,
    },
    lastOperation: serializeMarkdownOperation(markdownLastOperation.value),
    mode: markdownMode.value,
    profile: markdownProfile.value,
    rendered: {
      classNames: root ? [...root.classList] : [],
      mounted: Boolean(root && textarea),
    },
    revision: markdownRevision.value,
    selection: markdownSelection.value?.selection ?? null,
  }
}

const setMountedMarkdownState = async (state: {
  readonly document?: string
  readonly documentIdentity?: MarkdownEditorDocumentIdentity
  readonly locale?: string
  readonly mode?: MarkdownEditorMode
  readonly profile?: string
  readonly readonly?: boolean
}) => {
  if (state.documentIdentity) {
    if (state.document !== undefined) markdownValue.value = state.document
    markdownDocumentIdentity.value = Object.freeze({
      ...state.documentIdentity,
    })
    markdownDocumentKey.value += 1
    await nextTick()
  } else if (state.document !== undefined) markdownValue.value = state.document
  if (state.locale !== undefined) markdownLocale.value = state.locale
  if (state.mode !== undefined) markdownMode.value = state.mode
  if (state.profile !== undefined) markdownProfile.value = state.profile
  if (state.readonly !== undefined) markdownReadonly.value = state.readonly
  await nextTick()
  return readMountedMarkdownState()
}

const dispatchMountedMarkdownTransaction = async (
  transaction: MarkdownEditorTransaction,
) => {
  const result = markdownEditor.value?.dispatchTransaction(transaction)
  if (result) markdownLastOperation.value = result
  await nextTick()
  return {
    result: serializeMarkdownOperation(result),
    state: await readMountedMarkdownState(),
  }
}

const undoMountedMarkdown = async () => {
  const result = markdownEditor.value?.undo()
  if (result) markdownLastOperation.value = result
  await nextTick()
  return {
    result: serializeMarkdownOperation(result),
    state: await readMountedMarkdownState(),
  }
}

const redoMountedMarkdown = async () => {
  const result = markdownEditor.value?.redo()
  if (result) markdownLastOperation.value = result
  await nextTick()
  return {
    result: serializeMarkdownOperation(result),
    state: await readMountedMarkdownState(),
  }
}

const readMountedMarkdownProjection = async () => {
  const mounted = await readMountedMarkdownState()
  const coordinates = createMarkdownSourceCoordinateMap(mounted.document)
  const projection = stabilizeMarkdownEditorProjection(
    createMarkdownEditorProjection(mounted.document),
    mounted.documentIdentity,
  )
  const crlfOffset = mounted.document.indexOf('\r\n')
  const emojiOffset = mounted.document.indexOf('😀')
  return {
    coordinates: {
      crlf:
        crlfOffset >= 0
          ? {
              normalized: coordinates.toNormalizedOffset(crlfOffset + 2),
              raw: crlfOffset + 2,
              roundTrip: coordinates.toRawOffset(
                coordinates.toNormalizedOffset(crlfOffset + 2),
                { affinity: 'forward' },
              ),
            }
          : null,
      emoji:
        emojiOffset >= 0
          ? {
              boundary: coordinates.graphemeBoundaryAt(emojiOffset + 1),
              raw: emojiOffset,
              utf8: coordinates.toRawUtf8Offset(emojiOffset),
            }
          : null,
      normalizedSource: coordinates.normalizedSource,
      rawSource: coordinates.rawSource,
    },
    documentIdentity: projection.documentIdentity,
    nodes: projection.nodes.map((node) => ({
      id: node.id,
      kind: node.kind,
      rawRange: node.rawRange,
    })),
    rendered: mounted.rendered,
  }
}

;(
  window as Window & {
    __fsusMarkdownContract?: {
      dispatch: typeof dispatchMountedMarkdownTransaction
      projection: typeof readMountedMarkdownProjection
      read: typeof readMountedMarkdownState
      redo: typeof redoMountedMarkdown
      set: typeof setMountedMarkdownState
      undo: typeof undoMountedMarkdown
    }
  }
).__fsusMarkdownContract = {
  dispatch: dispatchMountedMarkdownTransaction,
  projection: readMountedMarkdownProjection,
  read: readMountedMarkdownState,
  redo: redoMountedMarkdown,
  set: setMountedMarkdownState,
  undo: undoMountedMarkdown,
}

const markdownRevision = computed(
  () =>
    markdownLastOperation.value?.revision ??
    markdownSelection.value?.revision ??
    0,
)
const markdownCapability = computed(() =>
  resolveMarkdownLiveCapability('supported', {
    documentIdentity: markdownDocumentIdentity.value,
    revision: markdownRevision.value,
  }),
)
const publicState = computed(() => ({
  runtimeMount: 'vue',
  events: events.value,
  eventNames: events.value.map((event) => event.name),
  input: {
    value: inputValue.value,
  },
  dialog: {
    open: dialogOpen.value,
  },
  checkTag: {
    checked: checkTagChecked.value,
    eventNames: events.value
      .filter((event) => event.name.startsWith('check-tag.'))
      .map((event) => event.name.replace('check-tag.', '')),
    eventPayloads: events.value
      .filter((event) => event.name.startsWith('check-tag.'))
      .map((event) => event.payload),
    revision: checkTagRevision.value,
  },
  markdown: {
    capability: markdownCapability.value,
    documentIdentity: markdownDocumentIdentity.value,
    history: markdownHistory.value,
    lastOperation: markdownLastOperation.value,
    revision: markdownRevision.value,
    selection: markdownSelection.value?.selection ?? null,
    value: markdownValue.value,
  },
}))
</script>

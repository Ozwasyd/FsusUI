<template>
  <section
    :class="[
      ns.b(),
      ns.m(currentMode),
      ns.m(`chrome-${chrome}`),
      ns.m(`mobile-${mobileLayout}`),
      ns.m(`profile-${editorProfile}`),
      ns.m(`interaction-${interactionProfile}`),
      ns.is('commands-expanded', commandsExpanded),
    ]"
    role="region"
    aria-label="Markdown editor"
    :style="editorStyle"
  >
    <header v-if="chrome !== 'minimal'" :class="ns.e('toolbar')">
      <div :class="ns.e('commands')">
        <button
          v-for="command in primaryCommands"
          :key="command.key"
          type="button"
          :class="ns.e('command')"
          :disabled="editingBlocked"
          :title="command.title || command.label"
          @click="runCommand(command)"
        >
          {{ command.label }}
        </button>
        <button
          v-if="overflowItemCount"
          type="button"
          :class="[ns.e('command-more'), ns.is('expanded', commandsExpanded)]"
          :aria-expanded="commandsExpanded"
          :aria-controls="commandTrayId"
          :aria-label="commandOverflowAriaLabel"
          aria-haspopup="true"
          :disabled="editingBlocked"
          @click="toggleCommands"
        >
          <span>{{ commandOverflowLabel }}</span>
          <span :class="ns.e('command-more-count')">{{
            overflowItemCount
          }}</span>
        </button>
      </div>

      <div
        v-if="showModeSwitcher"
        :class="ns.e('modes')"
        role="tablist"
        aria-label="Markdown mode"
      >
        <button
          v-for="mode in visibleModes"
          :key="mode"
          type="button"
          role="tab"
          :aria-selected="currentMode === mode"
          :class="[
            ns.e('mode'),
            `${ns.e('mode')}--${mode}`,
            ns.is('active', currentMode === mode),
          ]"
          :disabled="editingBlocked"
          @click="setMode(mode)"
        >
          {{ modeLabel(mode) }}
        </button>
      </div>

      <div v-if="primaryActions.length" :class="ns.e('actions')">
        <button
          v-for="action in primaryActions"
          :key="action.key"
          type="button"
          :class="ns.e('action')"
          :disabled="editingBlocked"
          @click="runAction(action)"
        >
          {{ action.label }}
        </button>
      </div>

      <div
        v-if="overflowItemCount && commandsExpanded"
        :id="commandTrayId"
        :class="ns.e('command-tray')"
        @keydown.esc.prevent.stop="commandsExpanded = false"
      >
        <button
          v-for="command in overflowCommands"
          :key="command.key"
          type="button"
          :class="ns.e('command')"
          :disabled="editingBlocked"
          :title="command.title || command.label"
          @click="runOverflowCommand(command)"
        >
          {{ command.label }}
        </button>
        <button
          v-for="action in overflowActions"
          :key="action.key"
          type="button"
          :class="[ns.e('command'), ns.e('command-tray-action')]"
          :disabled="editingBlocked"
          @click="runOverflowAction(action)"
        >
          {{ action.label }}
        </button>
      </div>
    </header>

    <div :class="ns.e('body')">
      <textarea
        v-if="currentMode !== 'preview'"
        :id="textareaId"
        ref="textareaRef"
        :class="ns.e('textarea')"
        :aria-label="textareaAriaLabel"
        :aria-busy="loading || undefined"
        :aria-disabled="editingBlocked"
        :disabled="editingBlocked"
        :name="textareaName"
        :placeholder="effectivePlaceholder"
        :rows="minRows"
        :value="editorValue"
        @beforeinput="handleBeforeInput"
        @blur="handleBlur"
        @click="handleSelectionMove"
        @compositionend="handleCompositionEnd"
        @compositionstart="handleCompositionStart"
        @drop="handleDrop"
        @input="handleInput"
        @keydown="handleKeydown"
        @paste="handlePaste"
        @select="handleSelectionMove"
      />

      <el-markdown-renderer
        v-if="currentMode !== 'source'"
        :class="ns.e('preview')"
        :base-url="previewBaseUrl"
        :content="editorValue"
        :csp-nonce="previewCspNonce"
        :features="previewFeatures"
        mode="editor"
        @features-activated="emitRenderEvent('features-activated', $event)"
        @render-complete="emitRenderEvent('render-complete', $event)"
        @render-error="emitRenderEvent('render-error', $event)"
      />
    </div>

    <footer v-if="chrome !== 'minimal'" :class="ns.e('status')">
      <slot
        name="status"
        :characters="characterCount"
        :mode="currentMode"
        :words="wordCount"
      >
        <span>{{ characterCount }} chars</span>
        <span>{{ wordCount }} words</span>
      </slot>
    </footer>
  </section>
</template>

<script lang="ts" setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  triggerRef,
  useId,
  watch,
} from 'vue'
import { ElMarkdownRenderer } from '@element-plus/components/markdown-renderer'
import { CHANGE_EVENT, UPDATE_MODEL_EVENT } from '@element-plus/constants'
import { useNamespace } from '@element-plus/hooks'
import {
  markdownEditorEmits,
  markdownEditorProps,
  runMarkdownEditorCommand,
} from './markdown-editor'
import {
  deriveMarkdownEditorChange,
  MarkdownEditorTransactionStore,
  toMarkdownEditorTransactionEvent,
} from './markdown-editor-transaction'

import type {
  MarkdownEditorActionItem,
  MarkdownEditorActionKey,
  MarkdownEditorCommand,
  MarkdownEditorInsertOptions,
  MarkdownEditorMode,
} from './markdown-editor'
import type {
  BeforeInputSnapshot,
  MarkdownEditorDispatchResult,
  MarkdownEditorHistoryState,
  MarkdownEditorInputMergeDirection,
  MarkdownEditorSelection,
  MarkdownEditorTransaction,
  MarkdownEditorTransactionRejection,
} from './markdown-editor-transaction'

defineOptions({
  name: 'ElMarkdownEditor',
})

const props = defineProps(markdownEditorProps)
const emit = defineEmits(markdownEditorEmits)
const ns = useNamespace('markdown-editor')
const modes: MarkdownEditorMode[] = ['source', 'live', 'split', 'preview']
const commandTrayId = `${useId()}-command-tray`
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const commandsExpanded = ref(false)
const visualViewportHeight = ref(0)
const editingBlocked = computed(() => props.disabled || props.loading)
const textareaAriaLabel = computed(() =>
  currentMode.value === 'live' ? 'Markdown editor live editing surface' : 'Markdown editor source',
)
const compactMode = computed(() => props.mobileLayout === 'compact')
const normalizeModeForLayout = (
  mode: MarkdownEditorMode,
): MarkdownEditorMode =>
  compactMode.value && mode === 'split' ? 'source' : mode
const currentMode = ref<MarkdownEditorMode>(
  normalizeModeForLayout(props.mode ?? props.defaultMode),
)
const initialSelection: MarkdownEditorSelection = {
  direction: 'none',
  end: props.modelValue.length,
  start: props.modelValue.length,
}
const transactionStore = new MarkdownEditorTransactionStore(
  props.modelValue,
  initialSelection,
)
const documentIdentity = Object.freeze({ epoch: 0, id: commandTrayId })
const editorValue = ref(transactionStore.value)
const isComposing = ref(false)

type EditorOperation =
  | {
      readonly allowBlocked?: boolean
      readonly emitValue?: boolean
      readonly internalPropReset?: boolean
      readonly kind: 'transaction'
      readonly mergeDirection?: MarkdownEditorInputMergeDirection
      readonly restoreSelection?: boolean
      readonly transaction: MarkdownEditorTransaction
    }
  | {
      readonly kind: 'undo' | 'redo'
      readonly restoreSelection?: boolean
    }

let beforeInputSnapshot: BeforeInputSnapshot | undefined
let discardInvalidatedCompositionInput = false
let discardInvalidatedCompositionInputEpoch = 0
let invalidatedComposition = false
let invalidatedCompositionEpoch = 0
let pendingInputOrigin: 'drop' | 'paste' | undefined
let pendingCompositionCommit = false
let pendingCompositionCommitEpoch = 0
let restoringSelection = false
let skipCompositionInputValue: string | undefined

const clearPendingCompositionCommit = () => {
  pendingCompositionCommit = false
  pendingCompositionCommitEpoch += 1
}

const deferPendingCompositionCommit = () => {
  pendingCompositionCommit = true
  const epoch = ++pendingCompositionCommitEpoch
  setTimeout(() => {
    if (pendingCompositionCommitEpoch === epoch) {
      pendingCompositionCommit = false
    }
  }, 0)
}

const clearInvalidatedCompositionInput = () => {
  discardInvalidatedCompositionInput = false
  discardInvalidatedCompositionInputEpoch += 1
}

const deferInvalidatedCompositionInput = () => {
  discardInvalidatedCompositionInput = true
  const epoch = ++discardInvalidatedCompositionInputEpoch
  setTimeout(() => {
    if (discardInvalidatedCompositionInputEpoch === epoch) {
      discardInvalidatedCompositionInput = false
    }
  }, 0)
}

const clearInvalidatedComposition = () => {
  invalidatedComposition = false
  invalidatedCompositionEpoch += 1
}

const deferInvalidatedComposition = () => {
  invalidatedComposition = true
  const epoch = ++invalidatedCompositionEpoch
  setTimeout(() => {
    if (invalidatedCompositionEpoch === epoch) {
      invalidatedComposition = false
    }
  }, 0)
}

const historiesEqual = (
  first: MarkdownEditorHistoryState,
  second: MarkdownEditorHistoryState,
) =>
  first.undoDepth === second.undoDepth &&
  first.redoDepth === second.redoDepth &&
  first.retainedUnits === second.retainedUnits &&
  first.canUndo === second.canUndo &&
  first.canRedo === second.canRedo

const rejectedResult = (
  reason: MarkdownEditorTransactionRejection,
): MarkdownEditorDispatchResult =>
  Object.freeze({
    accepted: false,
    history: transactionStore.history,
    reason,
    revision: transactionStore.revision,
    selection: transactionStore.selection,
    value: transactionStore.value,
  })

const operationTransaction = (
  operation: EditorOperation,
): MarkdownEditorTransaction => {
  if (operation.kind === 'transaction') return operation.transaction
  return Object.freeze({
    changes: [],
    history: 'skip',
    metadata: Object.freeze({ action: operation.kind }),
    origin: 'command',
  })
}

const restoreTextareaSelection = async (
  selection: MarkdownEditorSelection,
  focus = true,
) => {
  if (isComposing.value) return
  await nextTick()
  if (isComposing.value) return
  const textarea = textareaRef.value
  if (!textarea) return

  restoringSelection = true
  if (focus) textarea.focus()
  textarea.setSelectionRange(
    selection.start,
    selection.end,
    selection.direction,
  )
  queueMicrotask(() => {
    restoringSelection = false
  })
}

const dispatchEditorOperation = (
  operation: EditorOperation,
): MarkdownEditorDispatchResult => {
  const transaction = operationTransaction(operation)
  const blocked =
    operation.kind === 'transaction'
      ? !operation.allowBlocked && editingBlocked.value
      : editingBlocked.value
  const compositionBlocked =
    isComposing.value &&
    !(operation.kind === 'transaction' && operation.internalPropReset)
  if (blocked || compositionBlocked) {
    const result = rejectedResult(blocked ? 'disabled' : 'composition-active')
    emit('transaction', toMarkdownEditorTransactionEvent(transaction, result))
    return result
  }

  const previousValue = transactionStore.value
  const previousSelection = transactionStore.selection
  const previousHistory = transactionStore.history
  const result =
    operation.kind === 'transaction'
      ? transactionStore.dispatch(operation.transaction, {
          mergeDirection: operation.mergeDirection,
          now: Date.now(),
        })
      : operation.kind === 'undo'
        ? transactionStore.undo()
        : transactionStore.redo()

  editorValue.value = result.value
  emit('transaction', toMarkdownEditorTransactionEvent(transaction, result))

  if (
    result.accepted &&
    result.value !== previousValue &&
    (operation.kind !== 'transaction' || operation.emitValue !== false)
  ) {
    emit(UPDATE_MODEL_EVENT, result.value)
    emit(CHANGE_EVENT, result.value)
  }
  if (
    result.accepted &&
    (result.selection.start !== previousSelection.start ||
      result.selection.end !== previousSelection.end ||
      result.selection.direction !== previousSelection.direction)
  ) {
    emit(
      'selection-change',
      Object.freeze({
        revision: result.revision,
        selection: result.selection,
      }),
    )
  }
  if (result.accepted && !historiesEqual(previousHistory, result.history)) {
    emit('history-change', result.history)
  }
  if (
    result.accepted &&
    operation.restoreSelection !== false &&
    operation.kind !== 'transaction'
  ) {
    void restoreTextareaSelection(result.selection)
  } else if (
    result.accepted &&
    operation.kind === 'transaction' &&
    operation.restoreSelection !== false
  ) {
    void restoreTextareaSelection(result.selection)
  }
  return result
}

const readSelectionFrom = (
  textarea: HTMLTextAreaElement | null,
): MarkdownEditorSelection => {
  if (!textarea) return transactionStore.selection
  return {
    direction: textarea.selectionDirection,
    end: textarea.selectionEnd,
    start: textarea.selectionStart,
  }
}

const captureSelection = (breakMerge = true) => {
  const previous = transactionStore.selection
  transactionStore.setSelection(
    readSelectionFrom(textareaRef.value),
    breakMerge,
  )
  const selection = transactionStore.selection
  if (
    selection.start !== previous.start ||
    selection.end !== previous.end ||
    selection.direction !== previous.direction
  ) {
    emit(
      'selection-change',
      Object.freeze({
        revision: transactionStore.revision,
        selection,
      }),
    )
  }
  return selection
}

const dispatchReplacement = (
  nextValue: string,
  selection: MarkdownEditorSelection,
  options: Omit<MarkdownEditorTransaction, 'changes' | 'selection'>,
  mergeDirection: MarkdownEditorInputMergeDirection = 'none',
) => {
  const change = deriveMarkdownEditorChange(transactionStore.value, nextValue)
  return dispatchEditorOperation({
    kind: 'transaction',
    mergeDirection,
    transaction: {
      ...options,
      changes: change ? [change] : [],
      selection,
    },
  })
}

watch(
  [() => props.mode, () => props.defaultMode, () => props.mobileLayout],
  ([mode, defaultMode]) => {
    transactionStore.breakMergeGroup()
    currentMode.value = normalizeModeForLayout(mode ?? defaultMode)
  },
)

watch(
  () => props.modelValue,
  (value) => {
    if (value === transactionStore.value) return

    if (isComposing.value) deferInvalidatedComposition()
    isComposing.value = false
    beforeInputSnapshot = undefined
    clearPendingCompositionCommit()
    pendingInputOrigin = undefined
    skipCompositionInputValue = undefined
    dispatchEditorOperation({
      allowBlocked: true,
      emitValue: false,
      internalPropReset: true,
      kind: 'transaction',
      restoreSelection: false,
      transaction: {
        changes: [
          {
            from: 0,
            insert: value,
            to: transactionStore.value.length,
          },
        ],
        history: 'skip',
        metadata: Object.freeze({ kind: 'external-reset' }),
        origin: 'external',
        selection: transactionStore.selection,
      },
    })
  },
)

const characterCount = computed(() => editorValue.value.length)
const effectivePlaceholder = computed(
  () => props.writingPlaceholder || props.placeholder,
)
const editorStyle = computed<Record<string, string> | undefined>(() =>
  visualViewportHeight.value > 0
    ? {
        '--el-markdown-editor-visual-viewport-height': `${visualViewportHeight.value}px`,
      }
    : undefined,
)
const primaryCommandKeySet = computed(() =>
  props.primaryCommandKeys?.length ? new Set(props.primaryCommandKeys) : null,
)
const primaryCommands = computed(() => {
  const keySet = primaryCommandKeySet.value
  return keySet
    ? props.commands.filter((command) => keySet.has(command.key))
    : props.commands.slice(0, 6)
})
const overflowCommands = computed(() => {
  const keySet = primaryCommandKeySet.value
  return keySet
    ? props.commands.filter((command) => !keySet.has(command.key))
    : props.commands.slice(6)
})
const visibleActions = computed<MarkdownEditorActionItem[]>(() => {
  if (!props.showActions) return []

  const actions: MarkdownEditorActionItem[] = []
  if (props.showImageAction) {
    actions.push({ key: 'image', label: props.imageActionLabel })
  }
  if (props.showSaveAction) {
    actions.push({ key: 'save', label: props.saveActionLabel })
  }
  if (props.showSubmitAction) {
    actions.push({ key: 'submit', label: props.submitActionLabel })
  }
  return actions
})
const actionOverflowKeySet = computed(
  () => new Set<MarkdownEditorActionKey>(props.actionOverflowKeys),
)
const primaryActions = computed(() =>
  visibleActions.value.filter(
    (action) => !actionOverflowKeySet.value.has(action.key),
  ),
)
const overflowActions = computed(() =>
  visibleActions.value.filter((action) =>
    actionOverflowKeySet.value.has(action.key),
  ),
)
const overflowItemCount = computed(
  () => overflowCommands.value.length + overflowActions.value.length,
)
watch([editingBlocked, overflowItemCount], ([blocked, itemCount]) => {
  if (blocked || !itemCount) commandsExpanded.value = false
  if (!blocked) return

  transactionStore.breakMergeGroup()
  if (isComposing.value) {
    deferInvalidatedComposition()
    isComposing.value = false
    beforeInputSnapshot = undefined
    clearPendingCompositionCommit()
    pendingInputOrigin = undefined
    triggerRef(editorValue)
  }
})
const commandOverflowAriaLabel = computed(
  () => `${props.commandOverflowLabel}，${overflowItemCount.value} 个工具`,
)
const visibleModes = computed(() =>
  compactMode.value
    ? modes.filter((mode) => mode !== 'split' && mode !== 'live')
    : modes,
)
const wordCount = computed(() => {
  const trimmed = editorValue.value.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
})

const updateVisualViewportHeight = () => {
  if (typeof window === 'undefined') return

  visualViewportHeight.value =
    window.visualViewport?.height || window.innerHeight || 0
}

onMounted(() => {
  updateVisualViewportHeight()
  window.visualViewport?.addEventListener('resize', updateVisualViewportHeight)
  window.visualViewport?.addEventListener('scroll', updateVisualViewportHeight)
  window.addEventListener('resize', updateVisualViewportHeight)
})

onBeforeUnmount(() => {
  if (typeof window === 'undefined') return

  window.visualViewport?.removeEventListener(
    'resize',
    updateVisualViewportHeight,
  )
  window.visualViewport?.removeEventListener(
    'scroll',
    updateVisualViewportHeight,
  )
  window.removeEventListener('resize', updateVisualViewportHeight)
})

const handleBeforeInput = (event: InputEvent) => {
  if (editingBlocked.value) {
    event.preventDefault()
    return
  }
  if (
    invalidatedComposition ||
    discardInvalidatedCompositionInput ||
    (!isComposing.value &&
      (event.isComposing || event.inputType === 'insertCompositionText'))
  ) {
    event.preventDefault()
    beforeInputSnapshot = undefined
    pendingInputOrigin = undefined
    triggerRef(editorValue)
    return
  }
  if (event.inputType === 'historyUndo') {
    event.preventDefault()
    undo()
    return
  }
  if (event.inputType === 'historyRedo') {
    event.preventDefault()
    redo()
    return
  }

  beforeInputSnapshot = {
    data: event.data,
    inputType: event.inputType,
    selection: captureSelection(!isComposing.value),
    value: transactionStore.value,
  }
}

const inputMergeDirection = (
  snapshot: BeforeInputSnapshot,
): MarkdownEditorInputMergeDirection => {
  if (snapshot.selection.start !== snapshot.selection.end) return 'none'
  if (snapshot.inputType === 'deleteContentBackward') return 'backward'
  if (
    snapshot.inputType === 'deleteContentForward' ||
    snapshot.inputType === 'insertText' ||
    snapshot.inputType === 'insertLineBreak'
  ) {
    return 'forward'
  }
  return 'none'
}

const handleInput = (event: Event) => {
  const target = event.target
  if (!(target instanceof HTMLTextAreaElement)) return
  const orphanedCompositionInput =
    event instanceof InputEvent &&
    !isComposing.value &&
    (event.isComposing || event.inputType === 'insertCompositionText')
  if (
    invalidatedComposition ||
    discardInvalidatedCompositionInput ||
    orphanedCompositionInput
  ) {
    if (!invalidatedComposition) clearInvalidatedCompositionInput()
    beforeInputSnapshot = undefined
    clearPendingCompositionCommit()
    pendingInputOrigin = undefined
    triggerRef(editorValue)
    return
  }
  if (editingBlocked.value) {
    triggerRef(editorValue)
    return
  }
  if (isComposing.value) return
  if (
    skipCompositionInputValue !== undefined &&
    target.value === skipCompositionInputValue &&
    target.value === transactionStore.value
  ) {
    skipCompositionInputValue = undefined
    return
  }
  skipCompositionInputValue = undefined
  const compositionCommit = pendingCompositionCommit
  clearPendingCompositionCommit()

  const snapshot =
    beforeInputSnapshot?.value === transactionStore.value
      ? beforeInputSnapshot
      : {
          data: null,
          inputType: 'insertText',
          selection: transactionStore.selection,
          value: transactionStore.value,
        }
  const inputType = snapshot.inputType
  const origin = compositionCommit
    ? 'input'
    : (pendingInputOrigin ??
      (inputType === 'insertFromPaste'
        ? 'paste'
        : inputType === 'insertFromDrop'
          ? 'drop'
          : 'input'))
  const history = compositionCommit || origin !== 'input' ? 'separate' : 'merge'
  dispatchReplacement(
    target.value,
    readSelectionFrom(target),
    {
      history,
      metadata: Object.freeze({
        ...(compositionCommit ? { composition: true } : {}),
        data: snapshot.data,
        inputType,
      }),
      origin,
    },
    origin === 'input' && !compositionCommit
      ? inputMergeDirection(snapshot)
      : 'none',
  )
  beforeInputSnapshot = undefined
  pendingInputOrigin = undefined
}

const handleCompositionStart = () => {
  if (editingBlocked.value) return
  clearInvalidatedComposition()
  clearInvalidatedCompositionInput()
  transactionStore.breakMergeGroup()
  captureSelection()
  beforeInputSnapshot = undefined
  clearPendingCompositionCommit()
  pendingInputOrigin = undefined
  isComposing.value = true
}

const handleCompositionEnd = (event: CompositionEvent) => {
  const target = event.target
  if (!(target instanceof HTMLTextAreaElement)) return
  if (invalidatedComposition || !isComposing.value) {
    clearInvalidatedComposition()
    isComposing.value = false
    beforeInputSnapshot = undefined
    clearPendingCompositionCommit()
    pendingInputOrigin = undefined
    skipCompositionInputValue = undefined
    deferInvalidatedCompositionInput()
    triggerRef(editorValue)
    return
  }
  if (editingBlocked.value) {
    isComposing.value = false
    triggerRef(editorValue)
    return
  }

  isComposing.value = false
  const beforeValue = transactionStore.value
  const result = dispatchReplacement(target.value, readSelectionFrom(target), {
    history: 'separate',
    metadata: Object.freeze({
      composition: true,
      data: event.data,
      inputType: 'insertCompositionText',
    }),
    origin: 'input',
  })
  if (result.accepted) {
    if (target.value === beforeValue) deferPendingCompositionCommit()
    else skipCompositionInputValue = result.value
  }
  beforeInputSnapshot = undefined
  pendingInputOrigin = undefined
}

const handlePaste = () => {
  if (!editingBlocked.value && !isComposing.value) pendingInputOrigin = 'paste'
}

const handleDrop = () => {
  if (!editingBlocked.value && !isComposing.value) pendingInputOrigin = 'drop'
}

const handleSelectionMove = () => {
  if (restoringSelection || isComposing.value) return
  captureSelection()
}

const handleBlur = () => {
  transactionStore.breakMergeGroup()
}

const replaceValueRange = (
  start: number,
  end: number,
  replacement: string,
  nextSelection: MarkdownEditorSelection,
  metadata: Readonly<Record<string, unknown>>,
) => {
  const value = transactionStore.value
  const nextValue = value.slice(0, start) + replacement + value.slice(end)
  return dispatchReplacement(nextValue, nextSelection, {
    history: 'separate',
    metadata,
    origin: 'command',
  })
}

const selectedLineRange = (selection: MarkdownEditorSelection) => {
  const value = transactionStore.value
  const rangeStart = selection.start
  const rangeEnd = selection.end
  const blockEndSeed =
    rangeEnd > rangeStart && value[rangeEnd - 1] === '\n'
      ? rangeEnd - 1
      : rangeEnd
  const lineStart = value.lastIndexOf('\n', Math.max(0, rangeStart - 1)) + 1
  const lineEndIndex = value.indexOf('\n', blockEndSeed)
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex
  return {
    lineEnd,
    lineStart,
    rangeEnd,
    rangeStart,
  }
}

const applyLineIndent = (outdent: boolean) => {
  const selection = captureSelection()
  const value = transactionStore.value
  const { lineEnd, lineStart, rangeEnd, rangeStart } =
    selectedLineRange(selection)
  const block = value.slice(lineStart, lineEnd)
  const lines = block.split('\n')
  let charsBeforeSelectionStart = 0
  let charsBeforeSelectionEnd = 0
  let originalOffset = 0

  const nextLines = lines.map((line) => {
    if (!outdent) {
      if (lineStart + originalOffset < rangeStart) {
        charsBeforeSelectionStart += 2
      }
      if (lineStart + originalOffset < rangeEnd) {
        charsBeforeSelectionEnd += 2
      }
      originalOffset += line.length + 1
      return `  ${line}`
    }

    const removable = line.startsWith('  ')
      ? 2
      : line.startsWith(' ') || line.startsWith('\t')
        ? 1
        : 0
    if (lineStart + originalOffset < rangeStart) {
      charsBeforeSelectionStart -= removable
    }
    if (lineStart + originalOffset < rangeEnd) {
      charsBeforeSelectionEnd -= removable
    }
    originalOffset += line.length + 1
    return removable > 0 ? line.slice(removable) : line
  })

  const replacement = nextLines.join('\n')
  replaceValueRange(
    lineStart,
    lineEnd,
    replacement,
    {
      direction: selection.direction,
      start: Math.max(lineStart, rangeStart + charsBeforeSelectionStart),
      end: Math.max(lineStart, rangeEnd + charsBeforeSelectionEnd),
    },
    Object.freeze({ command: outdent ? 'outdent' : 'indent' }),
  )
}

const handleLineContinuation = () => {
  const value = transactionStore.value
  const selection = captureSelection()
  if (selection.start !== selection.end) return false

  const cursor = selection.start
  const lineStart = value.lastIndexOf('\n', Math.max(0, cursor - 1)) + 1
  const beforeCursor = value.slice(lineStart, cursor)
  const unordered = beforeCursor.match(
    /^(\s*)([-*+])\s+(?:(\[[ xX]\])\s+)?(.*)$/u,
  )

  if (unordered) {
    const [, indent, marker, taskMarker, text] = unordered
    if (!text.trim()) {
      const caret = lineStart + indent.length
      replaceValueRange(
        lineStart,
        cursor,
        indent,
        { direction: 'none', start: caret, end: caret },
        Object.freeze({ command: 'continue-list-exit' }),
      )
      return true
    }

    const nextMarker = `${indent}${marker} ${taskMarker ? '[ ] ' : ''}`
    const caret = cursor + nextMarker.length + 1
    replaceValueRange(
      cursor,
      cursor,
      `\n${nextMarker}`,
      { direction: 'none', start: caret, end: caret },
      Object.freeze({ command: 'continue-list' }),
    )
    return true
  }

  const ordered = beforeCursor.match(/^(\s*)(\d+)([.)])\s+(.*)$/u)
  if (ordered) {
    const [, indent, numberText, suffix, text] = ordered
    if (!text.trim()) {
      const caret = lineStart + indent.length
      replaceValueRange(
        lineStart,
        cursor,
        indent,
        { direction: 'none', start: caret, end: caret },
        Object.freeze({ command: 'continue-ordered-exit' }),
      )
      return true
    }

    const nextMarker = `${indent}${Number(numberText) + 1}${suffix} `
    const caret = cursor + nextMarker.length + 1
    replaceValueRange(
      cursor,
      cursor,
      `\n${nextMarker}`,
      { direction: 'none', start: caret, end: caret },
      Object.freeze({ command: 'continue-ordered' }),
    )
    return true
  }

  const quote = beforeCursor.match(/^(\s*> ?)(.*)$/u)
  if (quote) {
    const [, marker, text] = quote
    if (!text.trim()) {
      replaceValueRange(
        lineStart,
        cursor,
        '',
        { direction: 'none', start: lineStart, end: lineStart },
        Object.freeze({ command: 'continue-quote-exit' }),
      )
      return true
    }

    const caret = cursor + marker.length + 1
    replaceValueRange(
      cursor,
      cursor,
      `\n${marker}`,
      { direction: 'none', start: caret, end: caret },
      Object.freeze({ command: 'continue-quote' }),
    )
    return true
  }

  return false
}

const runCommand = async (command: MarkdownEditorCommand) => {
  if (editingBlocked.value || isComposing.value) return

  const selection = captureSelection()
  const controller = new AbortController()
  const result = await runMarkdownEditorCommand(command, {
    dispatch: { dispatch: dispatchTransaction },
    documentIdentity,
    mode: currentMode.value,
    readonly: editingBlocked.value,
    revision: transactionStore.revision,
    selection,
    signal: controller.signal,
    value: transactionStore.value,
  })
  if (!result?.transaction) return
  const dispatchResult = dispatchTransaction({
    ...result.transaction,
    expectedRevision: transactionStore.revision,
    history: result.transaction.history ?? 'separate',
    metadata: Object.freeze({ command: command.key }),
    origin: 'command',
  })
  if (dispatchResult.accepted) emit('command', command)
}

const runOverflowCommand = (command: MarkdownEditorCommand) => {
  runCommand(command)
  commandsExpanded.value = false
}

const runAction = (action: MarkdownEditorActionItem) => {
  if (action.key === 'image') {
    emitUploadImage()
    return
  }
  if (action.key === 'save') {
    emitSave()
    return
  }
  emitSubmit()
}

const runOverflowAction = (action: MarkdownEditorActionItem) => {
  runAction(action)
  commandsExpanded.value = false
}

const toggleCommands = () => {
  if (editingBlocked.value || isComposing.value) return
  commandsExpanded.value = !commandsExpanded.value
}

const setMode = (mode: MarkdownEditorMode) => {
  if (editingBlocked.value || isComposing.value) return

  transactionStore.breakMergeGroup()
  const nextMode = normalizeModeForLayout(mode)
  currentMode.value = nextMode
  emit('mode-change', nextMode)
}

const modeLabel = (mode: MarkdownEditorMode) => {
  if (mode === 'split') return '分屏'
  if (mode === 'preview') return '预览'
  return mode === 'live' ? '实时' : '编写'
}

const emitSave = () => {
  if (editingBlocked.value || isComposing.value) return
  emit('save', editorValue.value)
}

const emitSubmit = () => {
  if (editingBlocked.value || isComposing.value) return
  emit('submit', editorValue.value)
}

const emitUploadImage = () => {
  if (editingBlocked.value || isComposing.value) return
  emit('upload-image')
}

const emitRenderEvent = (
  event: 'features-activated' | 'render-complete' | 'render-error',
  payload: unknown,
) => {
  if (event === 'features-activated') {
    emit('features-activated', payload)
    return
  }
  if (event === 'render-complete') {
    emit('render-complete', payload)
    return
  }
  emit('render-error', payload)
}

const handleKeydown = (event: KeyboardEvent) => {
  if (editingBlocked.value || isComposing.value) return

  const isMod = event.metaKey || event.ctrlKey
  const key = event.key.toLowerCase()
  if (isMod && !event.shiftKey && key === 'z') {
    event.preventDefault()
    undo()
    return
  }
  if (
    isMod &&
    ((event.shiftKey && key === 'z') || (!event.shiftKey && key === 'y'))
  ) {
    event.preventDefault()
    redo()
    return
  }

  if (event.key === 'Tab') {
    event.preventDefault()
    applyLineIndent(event.shiftKey)
    return
  }

  if (
    event.key === 'Enter' &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    handleLineContinuation()
  ) {
    event.preventDefault()
    return
  }

  if (!isMod) return

  if (key === 's') {
    event.preventDefault()
    emitSave()
    return
  }
  if (key === 'enter') {
    event.preventDefault()
    emitSubmit()
    return
  }

  const command = props.commands.find((item) => {
    const shortcut = item.shortcut?.toLowerCase()
    return shortcut === `mod+${key}`
  })

  if (command) {
    event.preventDefault()
    runCommand(command)
  }
}

const dispatchTransaction = (transaction: MarkdownEditorTransaction) =>
  dispatchEditorOperation({
    kind: 'transaction',
    transaction,
  })

function undo() {
  return dispatchEditorOperation({ kind: 'undo' })
}

function redo() {
  return dispatchEditorOperation({ kind: 'redo' })
}

const insertMarkdownAtCursor = (
  markdown: string,
  options: MarkdownEditorInsertOptions = {},
) => {
  const selection = options.selection ?? captureSelection()
  const cursor = selection.start + markdown.length
  return dispatchEditorOperation({
    kind: 'transaction',
    transaction: {
      changes: [
        {
          from: selection.start,
          insert: markdown,
          to: selection.end,
        },
      ],
      expectedRevision: options.expectedRevision,
      history: 'separate',
      metadata: options.metadata,
      origin: 'programmatic',
      selection: {
        direction: 'none',
        end: cursor,
        start: cursor,
      },
    },
  }).accepted
}

defineExpose({
  dispatchTransaction,
  insertMarkdownAtCursor,
  redo,
  undo,
})
</script>

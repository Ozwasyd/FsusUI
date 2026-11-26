import { triggerRef, type ComputedRef, type Ref } from 'vue'
import {
  createMarkdownAnchorMap,
  type MarkdownDocumentIdentity,
} from '../../../../wasm/markdown-runtime'
import {
  resolveMarkdownEditorShortcut,
  type MarkdownEditorCommand,
  type MarkdownEditorMode,
} from '../markdown-editor'
import {
  markdownClipboardItemsFromDataTransfer,
  resolveMarkdownClipboardCopy,
  resolveMarkdownClipboardCut,
  resolveMarkdownClipboardPaste,
  writeMarkdownClipboardPayload,
} from '../markdown-editor-clipboard'
import {
  resolveMarkdownBlockInputIntent,
  type MarkdownBlockInputKey,
} from '../markdown-editor-input-intent'
import type { MarkdownWebLanguageController } from '../markdown-editor-language-web'
import type { MarkdownLiveLayoutGesture } from '../markdown-editor-live-layout'
import type { MarkdownLiveRevealIntent } from '../markdown-editor-live-reveal'
import {
  resolveMarkdownAtomicNodeIntent,
  type MarkdownAtomicNodePlan,
  type MarkdownAtomicNodeSession,
  type MarkdownLiveSelectionMotion,
} from '../markdown-editor-live-selection'
import type { MarkdownEditorNativeEventMachine } from '../markdown-editor-native-event'
import {
  MARKDOWN_PAIR_DEFAULTS,
  resolveMarkdownPairInput,
} from '../markdown-editor-pair-input'
import { dispatchMarkdownSearchKeydown } from '../markdown-editor-search-ui'
import type {
  BeforeInputSnapshot,
  MarkdownEditorDispatchResult,
  MarkdownEditorInputMergeDirection,
  MarkdownEditorSelection,
  MarkdownEditorTransaction,
} from '../markdown-editor-transaction'
import type {
  MarkdownEditorWritingAidsController,
  MarkdownEditorWritingAidsState,
} from '../markdown-editor-writing-aids'
import type { MarkdownEditorKernel } from '../kernel/editor-kernel'

const PAIR_CHARS = new Set<string>(
  MARKDOWN_PAIR_DEFAULTS.flatMap(([open, close]) => [open, close]),
)

export interface UseEditorInputPipelineOptions {
  readonly activeSlashIndex: Ref<number>
  readonly activeSlashTrigger: ComputedRef<unknown>
  readonly applyAtomicIntent: (
    action: Parameters<typeof resolveMarkdownAtomicNodeIntent>[0]['action'],
  ) => MarkdownAtomicNodePlan
  readonly applyLiveSelectionMotion: (
    motion: MarkdownLiveSelectionMotion,
    extras?: {
      readonly dragOffset?: number
      readonly pointerOffset?: number
      readonly shift?: boolean
    },
  ) => unknown
  readonly atomicSession: Ref<MarkdownAtomicNodeSession | null>
  readonly captureAttachmentFiles: (
    sourceKind: 'drop' | 'paste' | 'pick',
    files: readonly File[],
    selection: MarkdownEditorSelection,
    eventFingerprint?: string,
    nodeId?: string | null,
  ) => unknown
  readonly captureSelection: (breakMerge?: boolean) => MarkdownEditorSelection
  readonly clearTypewriterScrollTarget: () => void
  readonly closeSearch: () => void
  readonly closeSlashMenu: () => void
  readonly commands: ComputedRef<readonly MarkdownEditorCommand[]>
  readonly currentMode: Ref<MarkdownEditorMode>
  readonly disabled: ComputedRef<boolean>
  readonly dispatchReplacement: (
    nextValue: string,
    selection: MarkdownEditorSelection,
    options: Omit<MarkdownEditorTransaction, 'changes' | 'selection'>,
    mergeDirection?: MarkdownEditorInputMergeDirection,
  ) => MarkdownEditorDispatchResult
  readonly dispatchTransaction: (
    transaction: MarkdownEditorTransaction,
  ) => MarkdownEditorDispatchResult
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly editingBlocked: ComputedRef<boolean>
  readonly editorValue: Ref<string>
  readonly emitSave: () => void
  readonly emitSubmit: () => void
  readonly executeSlashCommand: (command: MarkdownEditorCommand) => void
  readonly getLanguageToolsController: () => MarkdownWebLanguageController | null
  readonly isComposing: Ref<boolean>
  readonly isRestoringSelection: () => boolean
  readonly isSearchOpen: () => boolean
  readonly kernel: MarkdownEditorKernel
  readonly liveRevealState: () => string
  readonly markLayoutGesture: (gesture: MarkdownLiveLayoutGesture) => void
  readonly moveSlashIndex: (delta: 1 | -1) => void
  readonly nativeCompositionValue: Ref<string>
  readonly nativeMachine: MarkdownEditorNativeEventMachine
  readonly openSearch: (replace?: boolean) => void
  readonly readSelectionFrom: (
    textarea: HTMLTextAreaElement | null,
  ) => MarkdownEditorSelection
  readonly redo: () => MarkdownEditorDispatchResult
  readonly refreshCurrentTableCell: () => void
  readonly refreshLiveReveal: (extras?: {
    readonly intent?: MarkdownLiveRevealIntent
    readonly pointerOffset?: number
  }) => void
  readonly refreshWritingAidsDocument: () => void
  readonly restoreTextareaSelection: (
    selection: MarkdownEditorSelection,
    focus?: boolean,
  ) => Promise<void>
  readonly runCommand: (command: MarkdownEditorCommand) => Promise<void>
  readonly slashCommands: ComputedRef<readonly MarkdownEditorCommand[]>
  readonly suspendTypewriterForUserScroll: () => void
  readonly syncLanguageToolsState: () => unknown
  readonly syncNativeComposing: () => void
  readonly textareaRef: Ref<HTMLTextAreaElement | null>
  readonly tryHandleTableClipboardPaste: (event: ClipboardEvent) => boolean
  readonly tryHandleTableKeydown: (event: KeyboardEvent) => boolean
  readonly undo: () => MarkdownEditorDispatchResult
  readonly writingAidsController: MarkdownEditorWritingAidsController
  readonly writingAidsState: Ref<MarkdownEditorWritingAidsState>
}

export function useEditorInputPipeline(options: UseEditorInputPipelineOptions) {
  const {
    activeSlashIndex,
    activeSlashTrigger,
    applyAtomicIntent,
    applyLiveSelectionMotion,
    atomicSession,
    captureAttachmentFiles,
    captureSelection,
    clearTypewriterScrollTarget,
    closeSearch,
    closeSlashMenu,
    commands,
    currentMode,
    disabled,
    dispatchReplacement,
    dispatchTransaction,
    documentIdentity,
    editingBlocked,
    editorValue,
    emitSave,
    emitSubmit,
    executeSlashCommand,
    getLanguageToolsController,
    isComposing,
    isRestoringSelection,
    isSearchOpen,
    kernel,
    liveRevealState,
    markLayoutGesture,
    moveSlashIndex,
    nativeCompositionValue,
    nativeMachine,
    openSearch,
    readSelectionFrom,
    redo,
    refreshCurrentTableCell,
    refreshLiveReveal,
    refreshWritingAidsDocument,
    restoreTextareaSelection,
    runCommand,
    slashCommands,
    suspendTypewriterForUserScroll,
    syncLanguageToolsState,
    syncNativeComposing,
    textareaRef,
    tryHandleTableClipboardPaste,
    tryHandleTableKeydown,
    undo,
    writingAidsController,
    writingAidsState,
  } = options

  let beforeInputSnapshot: BeforeInputSnapshot | undefined
  let pendingClipboardIdentity: string | undefined
  let pendingInputOrigin: 'drop' | 'paste' | undefined

  const resetPendingInputState = () => {
    beforeInputSnapshot = undefined
    pendingClipboardIdentity = undefined
    pendingInputOrigin = undefined
  }

  const recordPasteIdentity = (identity: string) => {
    pendingClipboardIdentity = identity
    pendingInputOrigin = 'paste'
    nativeMachine.apply({
      clipboardIdentity: identity,
      documentIdentity,
      kind: 'paste',
      origin: 'paste',
      revision: kernel.revision,
    })
  }

  const resolveDropSelection = (
    event: DragEvent,
  ): MarkdownEditorSelection | null => {
    const textarea = textareaRef.value
    if (!textarea || typeof document === 'undefined') return null
    const caretDocument = document as Document & {
      caretPositionFromPoint?: (
        x: number,
        y: number,
      ) => { readonly offset: number; readonly offsetNode: Node } | null
      caretRangeFromPoint?: (x: number, y: number) => Range | null
    }
    const position = caretDocument.caretPositionFromPoint?.(
      event.clientX,
      event.clientY,
    )
    const range = position
      ? null
      : caretDocument.caretRangeFromPoint?.(event.clientX, event.clientY)
    const offset =
      position?.offsetNode === textarea
        ? position.offset
        : range?.startContainer === textarea
          ? range.startOffset
          : null
    if (offset === null) return null

    const bounded = Math.max(0, Math.min(kernel.value.length, offset))
    const anchorMap = createMarkdownAnchorMap({
      identity: documentIdentity,
      source: kernel.value,
    })
    const mapped = anchorMap.visualAnchorToSourceSelection(
      anchorMap.sourceRangeToVisual({ start: bounded, end: bounded }),
    )
    return Object.freeze({
      direction: 'none' as const,
      start: mapped.anchor,
      end: mapped.focus,
    })
  }

  const handleBeforeInput = (event: InputEvent) => {
    syncLanguageToolsState()
    const languageToolsController = getLanguageToolsController()
    if (event.inputType === 'insertReplacementText' && languageToolsController) {
      const replacement = languageToolsController.handleBeforeInput(event)
      if (replacement.handled && replacement.transaction) {
        dispatchTransaction(replacement.transaction)
        resetPendingInputState()
        return
      }
      if (replacement.handled) {
        resetPendingInputState()
        return
      }
    }
    const plan = nativeMachine.apply({
      clipboardIdentity: pendingClipboardIdentity,
      data: event.data,
      disabled: editingBlocked.value,
      documentIdentity,
      inputType: event.inputType,
      isComposing: event.isComposing,
      kind: 'beforeinput',
      origin: pendingInputOrigin,
      previousValue: kernel.value,
      revision: kernel.revision,
      selection: captureSelection(!nativeMachine.composing),
    })
    syncNativeComposing()
    if (plan.snapshot) beforeInputSnapshot = plan.snapshot
    if (plan.preventDefault) event.preventDefault()
    if (plan.restoreDisplay) triggerRef(editorValue)
    if (plan.action === 'undo') {
      undo()
      return
    }
    if (plan.action === 'redo') {
      redo()
      return
    }
  }

  const handleInput = (event: Event) => {
    const target = event.target
    if (!(target instanceof HTMLTextAreaElement)) return
    const inputEvent = event instanceof InputEvent ? event : undefined
    if (nativeMachine.composing || inputEvent?.isComposing) {
      nativeCompositionValue.value = target.value
    }
    const snapshot =
      beforeInputSnapshot?.value === kernel.value
        ? beforeInputSnapshot
        : nativeMachine.snapshot
    const plan = nativeMachine.apply({
      clipboardIdentity: pendingClipboardIdentity,
      data: inputEvent?.data ?? snapshot?.data ?? null,
      disabled: editingBlocked.value,
      documentIdentity,
      inputType: inputEvent?.inputType ?? snapshot?.inputType,
      isComposing: inputEvent?.isComposing,
      kind: 'input',
      origin: pendingInputOrigin,
      previousValue: kernel.value,
      revision: kernel.revision,
      selection: readSelectionFrom(target),
      value: target.value,
    })
    syncNativeComposing()
    beforeInputSnapshot = undefined
    if (
      plan.action === 'dedup' ||
      plan.action === 'prevent' ||
      plan.action === 'ignore'
    ) {
      pendingClipboardIdentity = undefined
      pendingInputOrigin = undefined
      if (plan.restoreDisplay && target.value !== kernel.value) {
        triggerRef(editorValue)
        void restoreTextareaSelection(kernel.selection)
      } else if (plan.restoreDisplay) {
        triggerRef(editorValue)
      }
      return
    }
    if (plan.action !== 'dispatch' && plan.action !== 'commit') {
      pendingClipboardIdentity = undefined
      pendingInputOrigin = undefined
      return
    }

    dispatchReplacement(
      target.value,
      readSelectionFrom(target),
      {
        history: plan.history,
        metadata: Object.freeze({
          ...(plan.composition ? { composition: true } : {}),
          data: snapshot?.data ?? inputEvent?.data ?? null,
          identity: plan.identity,
          inputType:
            snapshot?.inputType ?? inputEvent?.inputType ?? 'insertText',
        }),
        origin: plan.origin,
      },
      plan.mergeDirection,
    )
    pendingClipboardIdentity = undefined
    pendingInputOrigin = undefined
  }

  const handleCompositionStart = (event: CompositionEvent) => {
    const target = event.target
    nativeCompositionValue.value =
      target instanceof HTMLTextAreaElement ? target.value : kernel.value
    nativeMachine.apply({
      disabled: editingBlocked.value,
      documentIdentity,
      kind: 'compositionstart',
      revision: kernel.revision,
    })
    syncNativeComposing()
    if (editingBlocked.value || !nativeMachine.composing) return
    writingAidsController.handleCompositionStart()
    writingAidsState.value = writingAidsController.state
    kernel.store.breakMergeGroup()
    captureSelection()
    resetPendingInputState()
    refreshLiveReveal()
  }

  const handleCompositionEnd = (event: CompositionEvent) => {
    const target = event.target
    if (!(target instanceof HTMLTextAreaElement)) return
    const plan = nativeMachine.apply({
      data: event.data,
      disabled: editingBlocked.value,
      documentIdentity,
      kind: 'compositionend',
      previousValue: kernel.value,
      revision: kernel.revision,
      selection: readSelectionFrom(target),
      value: target.value,
    })
    syncNativeComposing()
    writingAidsController.handleCompositionEnd()
    writingAidsState.value = writingAidsController.state
    resetPendingInputState()
    if (plan.action !== 'commit') {
      if (plan.restoreDisplay) triggerRef(editorValue)
      refreshLiveReveal()
      return
    }
    const laggedComposition =
      target.value === kernel.value && event.data
        ? `${kernel.value}${event.data}`
        : target.value
    const laggedSelection = {
      direction: 'forward' as const,
      end: laggedComposition.length,
      start: laggedComposition.length,
    }
    dispatchReplacement(
      laggedComposition,
      target.value === kernel.value && event.data
        ? laggedSelection
        : readSelectionFrom(target),
      {
        history: plan.history,
        metadata: Object.freeze({
          composition: true,
          data: event.data,
          identity: plan.identity,
          inputType: 'insertCompositionText',
        }),
        origin: 'input',
      },
    )
    refreshLiveReveal()
  }

  const applyClipboardTransfer = (
    event: { preventDefault(): void; dataTransfer?: DataTransfer | null },
    origin: 'paste' | 'drop',
    data: DataTransfer | null | undefined,
    attachmentSelection?: MarkdownEditorSelection | null,
  ) => {
    const transfer = markdownClipboardItemsFromDataTransfer(data ?? null)
    const hasTransfer = transfer.items.length > 0 || transfer.files.length > 0
    if (!hasTransfer) {
      if (!editingBlocked.value && !nativeMachine.freezeSmartInput) {
        pendingInputOrigin = origin
      }
      return
    }

    const plan = resolveMarkdownClipboardPaste({
      composing: isComposing.value,
      disabled: editingBlocked.value,
      documentIdentity,
      files: transfer.files,
      items: transfer.items,
      mode: currentMode.value,
      origin,
      revision: kernel.revision,
      selection: attachmentSelection ?? captureSelection(),
      source: kernel.value,
    })

    if (
      plan.rejected === 'composition-active' ||
      plan.rejected === 'disabled' ||
      plan.rejected === 'preview' ||
      plan.rejected === 'readonly' ||
      plan.rejected === 'stale-document' ||
      plan.rejected === 'budget-exceeded' ||
      plan.rejected === 'cancelled'
    ) {
      event.preventDefault()
      return
    }

    if (plan.action === 'attachment-intent' || plan.transaction) {
      event.preventDefault()
      pendingClipboardIdentity = plan.identity
      pendingInputOrigin = origin
      nativeMachine.apply({
        clipboardIdentity: plan.identity,
        documentIdentity,
        kind: origin,
        origin,
        revision: kernel.revision,
      })
      if (plan.action === 'attachment-intent') {
        if (origin === 'drop' && !attachmentSelection) return
        captureAttachmentFiles(
          origin,
          Array.from(data?.files ?? []),
          attachmentSelection ?? captureSelection(),
          plan.identity,
        )
      }
      if (plan.transaction) dispatchTransaction(plan.transaction)
      return
    }

    event.preventDefault()
  }

  const handlePaste = (event: ClipboardEvent) => {
    if (tryHandleTableClipboardPaste(event)) return
    applyClipboardTransfer(event, 'paste', event.clipboardData)
  }

  const handleDrop = (event: DragEvent) => {
    event.preventDefault()
    applyClipboardTransfer(
      event,
      'drop',
      event.dataTransfer,
      resolveDropSelection(event),
    )
  }

  const handleCopy = (event: ClipboardEvent) => {
    if (
      currentMode.value === 'live' &&
      atomicSession.value?.phase === 'selected'
    ) {
      const atomic = applyAtomicIntent('copy-source')
      if (atomic.copy && 'payload' in atomic.copy) {
        event.preventDefault()
        writeMarkdownClipboardPayload(event.clipboardData, atomic.copy.payload)
        return
      }
    }
    const plan = resolveMarkdownClipboardCopy({
      composing: isComposing.value,
      disabled: editingBlocked.value,
      documentIdentity,
      mode: currentMode.value,
      revision: kernel.revision,
      selection: captureSelection(false),
      source: kernel.value,
    })
    if (plan.rejected) {
      event.preventDefault()
      return
    }
    event.preventDefault()
    writeMarkdownClipboardPayload(event.clipboardData, plan.payload)
  }

  const handleCut = (event: ClipboardEvent) => {
    if (
      currentMode.value === 'live' &&
      atomicSession.value?.phase === 'selected'
    ) {
      const atomic = applyAtomicIntent('cut')
      if (atomic.copy && 'payload' in atomic.copy) {
        event.preventDefault()
        writeMarkdownClipboardPayload(event.clipboardData, atomic.copy.payload)
        return
      }
      if (atomic.copy && 'copy' in atomic.copy) {
        event.preventDefault()
        writeMarkdownClipboardPayload(
          event.clipboardData,
          atomic.copy.copy.payload,
        )
        return
      }
    }
    const plan = resolveMarkdownClipboardCut({
      composing: isComposing.value,
      disabled: editingBlocked.value,
      documentIdentity,
      mode: currentMode.value,
      revision: kernel.revision,
      selection: captureSelection(),
      source: kernel.value,
    })
    if (plan.rejected || !plan.transaction) {
      event.preventDefault()
      return
    }
    event.preventDefault()
    writeMarkdownClipboardPayload(event.clipboardData, plan.copy.payload)
    dispatchTransaction(plan.transaction)
  }

  const handleSelectionMove = () => {
    if (isRestoringSelection() || isComposing.value) return
    captureSelection()
    refreshCurrentTableCell()
    refreshWritingAidsDocument()
    writingAidsController.handleSelectionChange()
    writingAidsState.value = writingAidsController.state
    syncLanguageToolsState()
    if (currentMode.value === 'live') {
      const selection = kernel.selection
      if (selection.start !== selection.end) {
        markLayoutGesture('selection-drag')
        applyLiveSelectionMotion('pointer-drag', {
          dragOffset:
            selection.direction === 'backward'
              ? selection.start
              : selection.end,
        })
        return
      }
    }
    refreshLiveReveal()
  }

  const handleSelectionKeyup = (event: KeyboardEvent) => {
    if (
      currentMode.value !== 'live' ||
      isComposing.value ||
      isRestoringSelection()
    ) {
      return
    }
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    const textarea = textareaRef.value
    if (!textarea) return
    if (
      textarea.selectionStart !== kernel.selection.start ||
      textarea.selectionEnd !== kernel.selection.end
    ) {
      handleSelectionMove()
    }
  }

  const handleSelectionDragStart = () => {
    if (isComposing.value) return
    clearTypewriterScrollTarget()
    writingAidsController.handleSelectionDragStart()
    writingAidsState.value = writingAidsController.state
  }

  const handleSelectionDragEnd = () => {
    writingAidsController.handleSelectionDragEnd()
    writingAidsState.value = writingAidsController.state
  }

  const handlePointerReveal = () => {
    if (isRestoringSelection() || isComposing.value) return
    captureSelection()
    refreshCurrentTableCell()
    refreshWritingAidsDocument()
    if (currentMode.value === 'live') {
      applyLiveSelectionMotion('pointer-click', {
        pointerOffset: kernel.selection.start,
      })
    }
    refreshLiveReveal({
      intent: 'pointer',
      pointerOffset: kernel.selection.start,
    })
  }

  const handleBlur = () => {
    kernel.store.breakMergeGroup()
  }

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && isSearchOpen()) {
      event.preventDefault()
      closeSearch()
      return
    }
    const searchAction = dispatchMarkdownSearchKeydown({
      ctrlKey: event.ctrlKey,
      key: event.key,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
    })
    if (searchAction === 'open-find' || searchAction === 'open-replace') {
      event.preventDefault()
      openSearch(searchAction === 'open-replace')
      return
    }
    if (
      event.key === 'PageUp' ||
      event.key === 'PageDown' ||
      ((event.ctrlKey || event.metaKey) &&
        (event.key === 'Home' || event.key === 'End'))
    ) {
      suspendTypewriterForUserScroll()
    }

    if (editingBlocked.value || nativeMachine.freezeSmartInput) return
    if (activeSlashTrigger.value && slashCommands.value.length) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeSlashMenu()
        return
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        moveSlashIndex(event.key === 'ArrowDown' ? 1 : -1)
        return
      }
      if (event.key === 'Enter') {
        const command = slashCommands.value[activeSlashIndex.value]
        if (command) {
          event.preventDefault()
          executeSlashCommand(command)
        }
        return
      }
    }

    if (tryHandleTableKeydown(event)) return

    if (event.key === 'Escape' && currentMode.value === 'live') {
      if (atomicSession.value) {
        event.preventDefault()
        applyAtomicIntent('escape')
        return
      }
      if (liveRevealState() !== 'inactive') {
        event.preventDefault()
        refreshLiveReveal({ intent: 'escape' })
        return
      }
    }

    if (currentMode.value === 'live') {
      const motionKey =
        event.key === 'ArrowLeft'
          ? event.ctrlKey || event.altKey
            ? 'word-left'
            : 'left'
          : event.key === 'ArrowRight'
            ? event.ctrlKey || event.altKey
              ? 'word-right'
              : 'right'
            : event.key === 'Home'
              ? 'home'
              : event.key === 'End'
                ? 'end'
                : event.key === 'PageUp'
                  ? 'page-up'
                  : event.key === 'PageDown'
                    ? 'page-down'
                    : null
      if (motionKey) {
        event.preventDefault()
        applyLiveSelectionMotion(motionKey, { shift: event.shiftKey })
        return
      }
      if (
        event.key === 'Enter' &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        const atomic = resolveMarkdownAtomicNodeIntent({
          action: 'caret-before',
          composing: isComposing.value,
          documentIdentity,
          mode: currentMode.value,
          revision: kernel.revision,
          selection: captureSelection(),
          session: atomicSession.value,
          source: kernel.value,
        })
        if (atomic.state === 'current') {
          event.preventDefault()
          applyAtomicIntent(event.shiftKey ? 'enter-source' : 'enter')
          return
        }
      }
      if (
        (event.key === 'Backspace' || event.key === 'Delete') &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        const selection = captureSelection()
        const atomic = resolveMarkdownAtomicNodeIntent({
          action: event.key === 'Backspace' ? 'backspace' : 'delete',
          composing: isComposing.value,
          documentIdentity,
          mode: currentMode.value,
          revision: kernel.revision,
          selection,
          session: atomicSession.value,
          source: kernel.value,
        })
        if (atomic.state === 'current' && atomic.nodeId) {
          const before = resolveMarkdownAtomicNodeIntent({
            action: 'caret-before',
            documentIdentity,
            mode: currentMode.value,
            nodeId: atomic.nodeId,
            revision: kernel.revision,
            selection,
            source: kernel.value,
          })
          const after = resolveMarkdownAtomicNodeIntent({
            action: 'caret-after',
            documentIdentity,
            mode: currentMode.value,
            nodeId: atomic.nodeId,
            revision: kernel.revision,
            selection,
            source: kernel.value,
          })
          const caret = selection.start
          const shouldDelete =
            atomicSession.value?.phase === 'selected' ||
            (event.key === 'Delete' && caret === before.selection.start) ||
            (event.key === 'Backspace' && caret === after.selection.start)
          if (shouldDelete) {
            event.preventDefault()
            applyAtomicIntent(
              event.key === 'Backspace' ? 'backspace' : 'delete',
            )
            return
          }
        }
      }
    }

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

    if (
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      (event.key === 'Backspace' || PAIR_CHARS.has(event.key))
    ) {
      const pairPlan = resolveMarkdownPairInput({
        source: kernel.value,
        selection: captureSelection(),
        inserted: event.key === 'Backspace' ? undefined : event.key,
        key: event.key === 'Backspace' ? 'backspace' : undefined,
        composing: isComposing.value,
        readonly: disabled.value,
        mode: currentMode.value,
        documentIdentity,
      })
      if (pairPlan.transaction) {
        event.preventDefault()
        dispatchTransaction(pairPlan.transaction)
        return
      }
    }

    const blockKey =
      event.key === 'Tab'
        ? event.shiftKey
          ? 'shift-tab'
          : 'tab'
        : event.key === 'Enter'
          ? event.shiftKey
            ? 'shift-enter'
            : 'enter'
          : event.key === 'Backspace'
            ? 'backspace'
            : event.key === 'Delete'
              ? 'delete'
              : null
    if (blockKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
      const plan = resolveMarkdownBlockInputIntent({
        source: kernel.value,
        selection: captureSelection(),
        key: blockKey as MarkdownBlockInputKey,
        composing: isComposing.value,
        documentIdentity,
      })
      if (plan.rejected === 'composition-active') return
      if (!plan.transaction) return
      event.preventDefault()
      dispatchTransaction(plan.transaction)
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

    const command = resolveMarkdownEditorShortcut(commands.value, `mod+${key}`)
    if (command) {
      event.preventDefault()
      void runCommand(command)
    }
  }

  return {
    handleBeforeInput,
    handleBlur,
    handleCompositionEnd,
    handleCompositionStart,
    handleCopy,
    handleCut,
    handleDrop,
    handleInput,
    handleKeydown,
    handlePaste,
    handlePointerReveal,
    handleSelectionDragEnd,
    handleSelectionDragStart,
    handleSelectionKeyup,
    handleSelectionMove,
    recordPasteIdentity,
    resetPendingInputState,
  }
}

import { computed, nextTick, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { MarkdownHtmlImportSnapshot } from '../../../../wasm/markdown-html-import'
import {
  cancelMarkdownPasteAsMarkdown,
  confirmMarkdownPasteAsMarkdown,
  openMarkdownPasteAsMarkdown,
  type MarkdownPasteAsMarkdownChoice,
  type MarkdownPasteAsMarkdownRejection,
  type MarkdownPasteAsMarkdownSession,
} from '../markdown-editor-paste-markdown'
import type { MarkdownAttachmentBatchIntent } from '../markdown-editor-attachment'
import type {
  MarkdownEditorDocumentIdentity,
  MarkdownEditorLocaleText,
  MarkdownEditorMode,
} from '../markdown-editor'
import type {
  MarkdownEditorDispatchResult,
  MarkdownEditorSelection,
  MarkdownEditorTransaction,
} from '../markdown-editor-transaction'

class MarkdownClipboardUnavailableError extends Error {}

const readPasteAsMarkdownClipboard =
  async (): Promise<MarkdownHtmlImportSnapshot> => {
    const clipboard = navigator.clipboard
    if (typeof clipboard?.read === 'function') {
      const items = await clipboard.read()
      const item = items[0]
      if (!item) return Object.freeze({ explicit: true })
      const types = new Set(item.types)
      const readType = async (type: string) =>
        types.has(type) ? (await item.getType(type)).text() : undefined
      const [html, markdown, plain] = await Promise.all([
        readType('text/html'),
        readType('text/markdown'),
        readType('text/plain'),
      ])
      return Object.freeze({
        explicit: true,
        html,
        markdown,
        plain,
        sourceApplication: undefined,
      })
    }
    if (typeof clipboard?.readText === 'function') {
      return Object.freeze({
        explicit: true,
        plain: await clipboard.readText(),
      })
    }
    throw new MarkdownClipboardUnavailableError()
  }

export const useEditorPasteSurface = (options: {
  captureSelection: (breakMerge?: boolean) => MarkdownEditorSelection
  currentMode: Ref<MarkdownEditorMode>
  disabled: () => boolean
  dispatchTransaction: (
    transaction: MarkdownEditorTransaction,
  ) => MarkdownEditorDispatchResult
  documentIdentity: MarkdownEditorDocumentIdentity
  focusPastePrimaryAction: () => void
  getDialogElement: () => HTMLElement | null
  getRevision: () => number
  getSource: () => string
  isComposing: Ref<boolean>
  loading: () => boolean
  localeText: ComputedRef<MarkdownEditorLocaleText>
  onAttachmentBatch: (batch: MarkdownAttachmentBatchIntent) => void
  readonly: () => boolean
  restoreTextareaSelection: (
    selection: MarkdownEditorSelection,
    focus?: boolean,
  ) => Promise<void>
}) => {
  const pasteAsMarkdownSession = ref<MarkdownPasteAsMarkdownSession | null>(
    null,
  )
  const pasteAsMarkdownError = ref('')
  const pasteAsMarkdownBusy = ref(false)

  const pasteAsMarkdownGate = computed<
    'composition' | 'readonly' | 'disabled' | 'loading' | 'previewOnly' | null
  >(() => {
    if (options.isComposing.value) return 'composition'
    if (options.readonly()) return 'readonly'
    if (options.loading()) return 'loading'
    if (options.disabled()) return 'disabled'
    if (options.currentMode.value === 'preview') return 'previewOnly'
    return null
  })

  const pasteAsMarkdownGateDescription = computed(() => {
    const gate = pasteAsMarkdownGate.value
    return gate
      ? options.localeText.value.pasteAsMarkdown.disabledDescriptions[gate]
      : ''
  })

  const pasteAsMarkdownRejectionText = (
    rejection: MarkdownPasteAsMarkdownRejection,
  ) => {
    if (rejection === 'composition-active') {
      return options.localeText.value.pasteAsMarkdown.disabledDescriptions
        .composition
    }
    if (rejection === 'readonly') {
      return options.localeText.value.pasteAsMarkdown.disabledDescriptions
        .readonly
    }
    if (rejection === 'disabled') {
      return options.localeText.value.pasteAsMarkdown.disabledDescriptions
        .disabled
    }
    if (rejection === 'preview-only') {
      return options.localeText.value.pasteAsMarkdown.disabledDescriptions
        .previewOnly
    }
    return options.localeText.value.pasteAsMarkdown.stale
  }

  const restoreFocus = (selection: MarkdownEditorSelection) => {
    void options.restoreTextareaSelection(selection)
  }

  const openPasteAsMarkdownSurface = async () => {
    if (pasteAsMarkdownGate.value || pasteAsMarkdownBusy.value) return
    const anchor = Object.freeze({
      documentIdentity: options.documentIdentity,
      revision: options.getRevision(),
      selection: Object.freeze({ ...options.captureSelection() }),
      source: options.getSource(),
    })
    pasteAsMarkdownBusy.value = true
    pasteAsMarkdownError.value = ''
    try {
      const snapshot = await readPasteAsMarkdownClipboard()
      const opened = openMarkdownPasteAsMarkdown({
        anchor,
        composition: options.isComposing.value,
        disabled: options.disabled() || options.loading(),
        explicit: true,
        previewOnly: options.currentMode.value === 'preview',
        readonly: options.readonly(),
        snapshot,
      })
      if (opened.ok === false) {
        pasteAsMarkdownError.value =
          pasteAsMarkdownGateDescription.value ||
          pasteAsMarkdownRejectionText(opened.rejected)
        restoreFocus(anchor.selection)
        return
      }
      pasteAsMarkdownSession.value = opened.session
      await nextTick()
      options.focusPastePrimaryAction()
    } catch (error) {
      pasteAsMarkdownError.value =
        error instanceof MarkdownClipboardUnavailableError
          ? options.localeText.value.pasteAsMarkdown.clipboardUnavailable
          : options.localeText.value.pasteAsMarkdown.clipboardFailed
      restoreFocus(anchor.selection)
    } finally {
      pasteAsMarkdownBusy.value = false
    }
  }

  const closePasteAsMarkdownSurface = (selection: MarkdownEditorSelection) => {
    pasteAsMarkdownSession.value = null
    pasteAsMarkdownError.value = ''
    restoreFocus(selection)
  }

  const cancelPasteAsMarkdownSurface = () => {
    const session = pasteAsMarkdownSession.value
    if (!session) return
    const cancelled = cancelMarkdownPasteAsMarkdown(session)
    closePasteAsMarkdownSurface(cancelled.selection)
  }

  const confirmPasteAsMarkdownChoice = (
    choice: Exclude<MarkdownPasteAsMarkdownChoice, 'cancel'>,
  ) => {
    const session = pasteAsMarkdownSession.value
    if (!session) return
    if (pasteAsMarkdownGate.value) {
      pasteAsMarkdownError.value = pasteAsMarkdownGateDescription.value
      return
    }
    const current = Object.freeze({
      documentIdentity: options.documentIdentity,
      revision: options.getRevision(),
      selection: Object.freeze({ ...options.captureSelection(false) }),
      source: options.getSource(),
    })
    const confirmed = confirmMarkdownPasteAsMarkdown(session, choice, current)
    if ('rejected' in confirmed) {
      pasteAsMarkdownError.value =
        options.localeText.value.pasteAsMarkdown.stale
      return
    }
    const result = options.dispatchTransaction(confirmed.transaction)
    if (!result.accepted) {
      pasteAsMarkdownError.value =
        options.localeText.value.pasteAsMarkdown.stale
      return
    }
    if (confirmed.attachmentBatch) {
      options.onAttachmentBatch(confirmed.attachmentBatch)
    }
    closePasteAsMarkdownSurface(result.selection)
  }

  const handlePasteAsMarkdownDialogKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancelPasteAsMarkdownSurface()
      return
    }
    if (event.key !== 'Tab') return
    const buttons = Array.from(
      options
        .getDialogElement()
        ?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [],
    )
    if (!buttons.length) return
    const first = buttons[0]!
    const last = buttons[buttons.length - 1]!
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const resetPasteSurface = () => {
    pasteAsMarkdownSession.value = null
    pasteAsMarkdownError.value = ''
  }

  return {
    cancelPasteAsMarkdownSurface,
    confirmPasteAsMarkdownChoice,
    handlePasteAsMarkdownDialogKeydown,
    openPasteAsMarkdownSurface,
    pasteAsMarkdownBusy,
    pasteAsMarkdownError,
    pasteAsMarkdownGate,
    pasteAsMarkdownGateDescription,
    pasteAsMarkdownSession,
    resetPasteSurface,
  }
}

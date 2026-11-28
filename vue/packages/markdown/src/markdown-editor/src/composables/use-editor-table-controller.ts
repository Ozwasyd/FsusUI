import { computed, nextTick, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import {
  planMarkdownTableAlignColumn,
  planMarkdownTableDeleteColumn,
  planMarkdownTableDeleteRow,
  planMarkdownTableInsertColumn,
  planMarkdownTableInsertRow,
  planMarkdownTableMoveColumn,
  planMarkdownTableMoveRow,
  resolveMarkdownTableCellAtOffset,
  resolveMarkdownTableCellCoordinates,
  type MarkdownTableCellIdentity,
} from '../markdown-editor-table-structure'
import {
  planMarkdownTableFormat,
  planMarkdownTablePaste,
  resolveMarkdownTableInputIntent,
} from '../markdown-editor-table-input'
import { resolveMarkdownTableContextActions } from '../markdown-editor-table-acceptance'
import {
  markdownClipboardItemsFromDataTransfer,
  resolveMarkdownClipboardPaste,
} from '../markdown-editor-clipboard'
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

export const useEditorTableController = (options: {
  captureSelection: (breakMerge?: boolean) => MarkdownEditorSelection
  currentMode: Ref<MarkdownEditorMode>
  dispatchTransaction: (
    transaction: MarkdownEditorTransaction,
  ) => MarkdownEditorDispatchResult
  documentIdentity: MarkdownEditorDocumentIdentity
  editingBlocked: ComputedRef<boolean>
  getRevision: () => number
  getSelection: () => MarkdownEditorSelection
  getSource: () => string
  isComposing: Ref<boolean>
  localeText: ComputedRef<MarkdownEditorLocaleText>
  recordPasteIdentity: (identity: string) => void
  restoreTextareaSelection: (
    selection: MarkdownEditorSelection,
    focus?: boolean,
  ) => Promise<void>
  setSelection: (
    selection: MarkdownEditorSelection,
    breakMerge?: boolean,
  ) => void
}) => {
  const currentTableCell = ref<MarkdownTableCellIdentity | null>(null)
  const tableAnnouncement = ref('')
  const tableMenuOpen = ref(false)
  const tableMenuRef = ref<HTMLElement | null>(null)
  const tableMenuTriggerRef = ref<HTMLButtonElement | null>(null)

  const tableContextActions = computed(() =>
    resolveMarkdownTableContextActions(
      undefined,
      undefined,
      options.localeText.value.table,
    ).filter(
      (action) =>
        action.key !== 'delete-row' || currentTableCell.value?.row !== 0,
    ),
  )

  const resetTableState = () => {
    currentTableCell.value = null
    tableMenuOpen.value = false
  }

  const refreshCurrentTableCell = (offset = options.getSelection().start) => {
    const previousCellId = currentTableCell.value?.cellId
    const nextCell = resolveMarkdownTableCellAtOffset(
      options.getSource(),
      options.documentIdentity,
      offset,
    )
    currentTableCell.value = nextCell
    if (!nextCell || (previousCellId && nextCell.cellId !== previousCellId)) {
      tableMenuOpen.value = false
    }
    return nextCell
  }

  const selectTableCell = async (cell: MarkdownTableCellIdentity) => {
    const resolved = resolveMarkdownTableCellCoordinates(
      options.getSource(),
      options.documentIdentity,
      cell.tableId,
      cell.row,
      cell.column,
      cell.cellId,
    )
    if (!resolved?.anchor) {
      currentTableCell.value = null
      return
    }
    currentTableCell.value = resolved
    options.setSelection(
      {
        direction: 'none',
        end: resolved.anchor.end,
        start: resolved.anchor.start,
      },
      true,
    )
    await options.restoreTextareaSelection(options.getSelection())
  }

  const focusTableMenuItem = (index: number) => {
    const items = Array.from(
      tableMenuRef.value?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]',
      ) ?? [],
    )
    if (!items.length) return
    items[(index + items.length) % items.length]?.focus()
  }

  const closeTableMenu = (restoreTrigger = false) => {
    tableMenuOpen.value = false
    if (restoreTrigger) {
      void nextTick(() => tableMenuTriggerRef.value?.focus())
    }
  }

  const toggleTableMenu = () => {
    tableMenuOpen.value = !tableMenuOpen.value
    if (tableMenuOpen.value) {
      void nextTick(() => focusTableMenuItem(0))
    }
  }

  const handleTableContextMenu = (event: MouseEvent) => {
    const cell = refreshCurrentTableCell(options.captureSelection(false).start)
    if (!cell || options.editingBlocked.value) return
    event.preventDefault()
    tableAnnouncement.value = `Table row ${cell.row + 1}, column ${cell.column + 1}`
    tableMenuOpen.value = true
    void nextTick(() =>
      tableMenuRef.value
        ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
        ?.focus(),
    )
  }

  const handleTableMenuKeydown = (event: KeyboardEvent) => {
    const items = Array.from(
      tableMenuRef.value?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]',
      ) ?? [],
    )
    const currentIndex = items.indexOf(
      document.activeElement as HTMLButtonElement,
    )
    if (event.key === 'Escape') {
      event.preventDefault()
      closeTableMenu(true)
      return
    }
    if (event.key === 'Tab') {
      tableMenuOpen.value = false
      return
    }
    const targetIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : event.key === 'ArrowDown'
            ? currentIndex + 1
            : event.key === 'ArrowUp'
              ? currentIndex - 1
              : null
    if (targetIndex === null) return
    event.preventDefault()
    focusTableMenuItem(targetIndex)
  }

  const runTableContextAction = (key: string) => {
    const cell = currentTableCell.value
    if (!cell || options.editingBlocked.value || options.isComposing.value)
      return
    const source = options.getSource()
    const revision = options.getRevision()
    let plan: MarkdownEditorTransaction | { readonly rejected: string }
    switch (key) {
      case 'insert-row-above':
        plan = planMarkdownTableInsertRow(
          source,
          options.documentIdentity,
          cell.tableId,
          cell.row,
          'above',
          revision,
          cell.column,
        )
        break
      case 'insert-row-below':
        plan = planMarkdownTableInsertRow(
          source,
          options.documentIdentity,
          cell.tableId,
          cell.row,
          'below',
          revision,
          cell.column,
        )
        break
      case 'move-row-up':
      case 'move-row-down':
        plan = planMarkdownTableMoveRow(
          source,
          options.documentIdentity,
          cell.tableId,
          cell.row,
          key === 'move-row-up' ? 'up' : 'down',
          revision,
          cell.column,
        )
        break
      case 'delete-row':
        plan = planMarkdownTableDeleteRow(
          source,
          options.documentIdentity,
          cell.tableId,
          cell.row,
          revision,
          cell.column,
        )
        break
      case 'insert-col-left':
        plan = planMarkdownTableInsertColumn(
          source,
          options.documentIdentity,
          cell.tableId,
          cell.column,
          'left',
          revision,
          cell.row,
        )
        break
      case 'insert-col-right':
        plan = planMarkdownTableInsertColumn(
          source,
          options.documentIdentity,
          cell.tableId,
          cell.column,
          'right',
          revision,
          cell.row,
        )
        break
      case 'move-col-left':
      case 'move-col-right':
        plan = planMarkdownTableMoveColumn(
          source,
          options.documentIdentity,
          cell.tableId,
          cell.column,
          key === 'move-col-left' ? 'left' : 'right',
          revision,
          cell.row,
        )
        break
      case 'delete-col':
        plan = planMarkdownTableDeleteColumn(
          source,
          options.documentIdentity,
          cell.tableId,
          cell.column,
          revision,
          cell.row,
        )
        break
      case 'align-left':
      case 'align-center':
      case 'align-right':
        plan = planMarkdownTableAlignColumn(
          source,
          options.documentIdentity,
          cell.tableId,
          cell.column,
          key.slice('align-'.length) as 'left' | 'center' | 'right',
          revision,
          cell.row,
        )
        break
      case 'format-table':
        plan = planMarkdownTableFormat(
          source,
          options.documentIdentity,
          cell.tableId,
          revision,
          cell,
        )
        break
      default:
        return
    }
    if (!('changes' in plan)) return
    const targetCell = (
      plan.metadata?.markdownTable as
        | {
            readonly targetCell?: Readonly<{ row: number; column: number }>
          }
        | undefined
    )?.targetCell
    const result = options.dispatchTransaction(plan)
    if (!result.accepted) return
    tableAnnouncement.value =
      tableContextActions.value.find((action) => action.key === key)?.title ??
      'Table updated'
    closeTableMenu()
    const nextCell = targetCell
      ? resolveMarkdownTableCellCoordinates(
          options.getSource(),
          options.documentIdentity,
          cell.tableId,
          targetCell.row,
          targetCell.column,
        )
      : resolveMarkdownTableCellAtOffset(
          options.getSource(),
          options.documentIdentity,
          result.selection.start,
        )
    currentTableCell.value = nextCell
      ? Object.freeze({
          ...nextCell,
          ...(!key.startsWith('delete-') && cell.cellId
            ? { cellId: cell.cellId }
            : {}),
        })
      : null
  }

  const tryHandleTableClipboardPaste = (event: ClipboardEvent): boolean => {
    const cell = refreshCurrentTableCell(options.captureSelection(false).start)
    const clipboard = event.clipboardData
    if (
      !cell ||
      !clipboard ||
      clipboard.files.length > 0 ||
      options.isComposing.value ||
      options.editingBlocked.value
    ) {
      return false
    }
    const tsv = clipboard.getData('text/tab-separated-values')
    const csv = clipboard.getData('text/csv')
    const plain = clipboard.getData('text/plain')
    const carriesHtml = Array.from(clipboard.types).includes('text/html')
    const payload = tsv || csv || (carriesHtml ? '' : plain)
    const mime = tsv
      ? 'text/tab-separated-values'
      : csv
        ? 'text/csv'
        : undefined
    if (!payload.includes('\t') && mime !== 'text/csv') {
      return false
    }
    const transfer = markdownClipboardItemsFromDataTransfer(clipboard)
    const clipboardPlan = resolveMarkdownClipboardPaste({
      composing: options.isComposing.value,
      disabled: options.editingBlocked.value,
      documentIdentity: options.documentIdentity,
      files: transfer.files,
      items: transfer.items,
      mode: options.currentMode.value,
      origin: 'paste',
      revision: options.getRevision(),
      selection: options.getSelection(),
      source: options.getSource(),
    })
    const plan = planMarkdownTablePaste(
      options.getSource(),
      options.documentIdentity,
      cell.tableId,
      cell,
      payload,
      mime,
      options.getRevision(),
    )
    if (!('changes' in plan)) return false
    event.preventDefault()
    options.recordPasteIdentity(clipboardPlan.identity)
    const result = options.dispatchTransaction(plan)
    if (result.accepted) {
      tableAnnouncement.value = 'Pasted table data'
      void selectTableCell(cell)
    }
    return true
  }

  const tryHandleTableKeydown = (event: KeyboardEvent): boolean => {
    if (event.altKey || event.ctrlKey || event.metaKey) return false
    const selection = options.captureSelection(false)
    const cell = refreshCurrentTableCell(selection.start)
    if (!cell?.anchor) return false

    const tableKey =
      event.key === 'Tab' && event.shiftKey
        ? 'Shift+Tab'
        : event.key === 'Enter' && event.shiftKey
          ? 'Shift+Enter'
          : event.key
    const plan = resolveMarkdownTableInputIntent({
      cell,
      cellOffset: Math.max(0, selection.start - cell.anchor.start),
      cellText: options
        .getSource()
        .slice(cell.anchor.start, cell.anchor.end),
      compositionActive: options.isComposing.value,
      documentIdentity: options.documentIdentity,
      expectedRevision: options.getRevision(),
      key: tableKey,
      selection,
      source: options.getSource(),
    })
    const moved =
      plan.nextCell.row !== cell.row ||
      plan.nextCell.column !== cell.column ||
      plan.nextCell.status !== cell.status
    if (
      !plan.transaction &&
      !moved &&
      tableKey !== 'Tab' &&
      tableKey !== 'Shift+Tab'
    ) {
      return false
    }
    event.preventDefault()
    if (plan.transaction) {
      const result = options.dispatchTransaction(plan.transaction)
      if (!result.accepted) return true
    }
    tableAnnouncement.value = plan.screenReaderText
    if (plan.nextCell.status === 'current') {
      void selectTableCell(plan.nextCell)
    } else {
      currentTableCell.value = null
    }
    return true
  }

  return {
    closeTableMenu,
    currentTableCell,
    handleTableContextMenu,
    handleTableMenuKeydown,
    refreshCurrentTableCell,
    resetTableState,
    runTableContextAction,
    selectTableCell,
    tableAnnouncement,
    tableContextActions,
    tableMenuOpen,
    tableMenuRef,
    tableMenuTriggerRef,
    toggleTableMenu,
    tryHandleTableClipboardPaste,
    tryHandleTableKeydown,
  }
}

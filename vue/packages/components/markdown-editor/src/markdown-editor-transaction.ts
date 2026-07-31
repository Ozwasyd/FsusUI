export type MarkdownEditorSelectionDirection = 'backward' | 'forward' | 'none'

export interface MarkdownEditorSelection {
  readonly direction?: MarkdownEditorSelectionDirection
  readonly end: number
  readonly start: number
}

export interface MarkdownEditorResolvedSelection extends MarkdownEditorSelection {
  readonly direction: MarkdownEditorSelectionDirection
}

export interface MarkdownEditorChange {
  readonly from: number
  readonly insert: string
  readonly to: number
}

export type MarkdownEditorTransactionOrigin =
  | 'input'
  | 'command'
  | 'paste'
  | 'drop'
  | 'programmatic'
  | 'external'

export type MarkdownEditorHistoryMode = 'merge' | 'separate' | 'skip'

export interface MarkdownEditorTransaction {
  readonly changes: readonly MarkdownEditorChange[]
  readonly expectedRevision?: number
  readonly history: MarkdownEditorHistoryMode
  readonly metadata?: Readonly<Record<string, unknown>>
  readonly origin: MarkdownEditorTransactionOrigin
  readonly selection?: MarkdownEditorSelection
}

export type MarkdownEditorTransactionRejection =
  | 'disabled'
  | 'composition-active'
  | 'invalid-change'
  | 'invalid-selection'
  | 'no-history'
  | 'stale-revision'

export interface MarkdownEditorHistoryState {
  readonly canRedo: boolean
  readonly canUndo: boolean
  readonly redoDepth: number
  readonly retainedUnits: number
  readonly undoDepth: number
}

export interface MarkdownEditorDispatchResult {
  readonly accepted: boolean
  readonly history: MarkdownEditorHistoryState
  readonly reason?: MarkdownEditorTransactionRejection
  readonly revision: number
  readonly selection: MarkdownEditorResolvedSelection
  readonly value: string
}

export interface MarkdownEditorTransactionEvent extends MarkdownEditorDispatchResult {
  readonly transaction: MarkdownEditorTransaction
}

export interface MarkdownEditorSelectionEvent {
  readonly revision: number
  readonly selection: MarkdownEditorResolvedSelection
}

export type MarkdownEditorInputMergeDirection = 'backward' | 'forward' | 'none'

interface MarkdownEditorDispatchContext {
  readonly mergeDirection?: MarkdownEditorInputMergeDirection
  readonly now?: number
}

interface AppliedChanges {
  readonly inverse: readonly MarkdownEditorChange[]
  readonly value: string
}

interface HistoryStep {
  readonly changes: readonly MarkdownEditorChange[]
  readonly inverse: readonly MarkdownEditorChange[]
}

interface HistoryEntry {
  readonly afterSelection: MarkdownEditorResolvedSelection
  readonly beforeSelection: MarkdownEditorResolvedSelection
  readonly history: Exclude<MarkdownEditorHistoryMode, 'skip'>
  readonly mergeDirection: MarkdownEditorInputMergeDirection
  readonly origin: MarkdownEditorTransactionOrigin
  readonly retainedUnits: number
  readonly steps: readonly HistoryStep[]
  readonly timestamp: number
}

interface MarkdownEditorStoreMutation extends MarkdownEditorDispatchResult {
  readonly historyChanged: boolean
  readonly selectionChanged: boolean
  readonly valueChanged: boolean
}

const HISTORY_ENTRY_LIMIT = 100
const HISTORY_RETAINED_UNIT_LIMIT = 1_000_000
const INPUT_MERGE_WINDOW_MS = 1000

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : undefined

const isFiniteInteger = (value: number) =>
  Number.isFinite(value) && Number.isInteger(value)

const isSplitSurrogateBoundary = (value: string, offset: number) => {
  if (offset <= 0 || offset >= value.length) return false
  const previous = value.charCodeAt(offset - 1)
  const next = value.charCodeAt(offset)
  return (
    previous >= 0xd800 && previous <= 0xdbff && next >= 0xdc00 && next <= 0xdfff
  )
}

const fallbackGraphemeBoundaries = (value: string) => {
  const boundaries = [0]
  for (let offset = 1; offset < value.length; offset += 1) {
    if (!isSplitSurrogateBoundary(value, offset)) boundaries.push(offset)
  }
  boundaries.push(value.length)
  return boundaries
}

const graphemeBoundaries = (value: string) => {
  if (!segmenter) return fallbackGraphemeBoundaries(value)
  const boundaries = [0]
  for (const segment of segmenter.segment(value)) {
    if (segment.index > 0) boundaries.push(segment.index)
  }
  if (boundaries.at(-1) !== value.length) boundaries.push(value.length)
  return boundaries
}

const clampOffset = (value: string, offset: number) => {
  if (!Number.isFinite(offset)) return 0
  return Math.max(0, Math.min(value.length, Math.trunc(offset)))
}

const snapOffset = (
  value: string,
  offset: number,
  affinity: 'nearest' | 'start' | 'end',
) => {
  const clamped = clampOffset(value, offset)
  const boundaries = graphemeBoundaries(value)
  let previous = 0
  for (const boundary of boundaries) {
    if (boundary === clamped) return boundary
    if (boundary > clamped) {
      if (affinity === 'start') return previous
      if (affinity === 'end') return boundary
      return clamped - previous <= boundary - clamped ? previous : boundary
    }
    previous = boundary
  }
  return value.length
}

const isSelectionDirection = (
  direction: unknown,
): direction is MarkdownEditorSelectionDirection =>
  direction === 'backward' || direction === 'forward' || direction === 'none'

export const normalizeMarkdownEditorSelection = (
  value: string,
  selection: MarkdownEditorSelection,
): MarkdownEditorResolvedSelection | undefined => {
  const direction = selection.direction ?? 'none'
  if (
    !isFiniteInteger(selection.start) ||
    !isFiniteInteger(selection.end) ||
    selection.start > selection.end ||
    !isSelectionDirection(direction)
  ) {
    return undefined
  }

  if (selection.start === selection.end) {
    const caret = snapOffset(value, selection.start, 'nearest')
    return {
      direction,
      end: caret,
      start: caret,
    }
  }

  return {
    direction,
    end: snapOffset(value, selection.end, 'end'),
    start: snapOffset(value, selection.start, 'start'),
  }
}

const cloneSelection = (
  selection: MarkdownEditorSelection,
): MarkdownEditorResolvedSelection =>
  Object.freeze({
    direction: selection.direction ?? 'none',
    end: selection.end,
    start: selection.start,
  })

const cloneChanges = (changes: readonly MarkdownEditorChange[]) =>
  Object.freeze(
    changes.map((change) =>
      Object.freeze({
        from: change.from,
        insert: change.insert,
        to: change.to,
      }),
    ),
  )

export const validateMarkdownEditorChanges = (
  value: string,
  changes: readonly MarkdownEditorChange[],
) => {
  let previousTo = 0
  for (const [index, change] of changes.entries()) {
    if (
      !isFiniteInteger(change.from) ||
      !isFiniteInteger(change.to) ||
      typeof change.insert !== 'string' ||
      change.from < 0 ||
      change.to < change.from ||
      change.to > value.length ||
      (index > 0 && change.from < previousTo) ||
      isSplitSurrogateBoundary(value, change.from) ||
      isSplitSurrogateBoundary(value, change.to)
    ) {
      return false
    }
    previousTo = change.to
  }
  return true
}

export const applyMarkdownEditorChanges = (
  value: string,
  changes: readonly MarkdownEditorChange[],
): AppliedChanges | undefined => {
  if (!validateMarkdownEditorChanges(value, changes)) return undefined

  let cursor = 0
  let delta = 0
  const output: string[] = []
  const inverse: MarkdownEditorChange[] = []

  for (const change of changes) {
    output.push(value.slice(cursor, change.from), change.insert)
    const deleted = value.slice(change.from, change.to)
    const inverseFrom = change.from + delta
    inverse.push({
      from: inverseFrom,
      insert: deleted,
      to: inverseFrom + change.insert.length,
    })
    delta += change.insert.length - (change.to - change.from)
    cursor = change.to
  }
  output.push(value.slice(cursor))

  return {
    inverse: cloneChanges(inverse),
    value: output.join(''),
  }
}

export const deriveMarkdownEditorChange = (
  previous: string,
  next: string,
): MarkdownEditorChange | undefined => {
  if (previous === next) return undefined

  let prefix = 0
  const prefixLimit = Math.min(previous.length, next.length)
  while (prefix < prefixLimit && previous[prefix] === next[prefix]) {
    prefix += 1
  }
  if (
    isSplitSurrogateBoundary(previous, prefix) ||
    isSplitSurrogateBoundary(next, prefix)
  ) {
    prefix -= 1
  }

  let previousSuffix = previous.length
  let nextSuffix = next.length
  while (
    previousSuffix > prefix &&
    nextSuffix > prefix &&
    previous[previousSuffix - 1] === next[nextSuffix - 1]
  ) {
    previousSuffix -= 1
    nextSuffix -= 1
  }
  if (
    isSplitSurrogateBoundary(previous, previousSuffix) ||
    isSplitSurrogateBoundary(next, nextSuffix)
  ) {
    previousSuffix += 1
    nextSuffix += 1
  }

  return {
    from: prefix,
    insert: next.slice(prefix, nextSuffix),
    to: previousSuffix,
  }
}

const selectionsEqual = (
  first: MarkdownEditorResolvedSelection,
  second: MarkdownEditorResolvedSelection,
) =>
  first.start === second.start &&
  first.end === second.end &&
  first.direction === second.direction

const retainedUnitsFor = (
  changes: readonly MarkdownEditorChange[],
  inverse: readonly MarkdownEditorChange[],
) =>
  changes.reduce((total, change) => total + change.insert.length, 0) +
  inverse.reduce((total, change) => total + change.insert.length, 0)

const isCollapsed = (selection: MarkdownEditorResolvedSelection) =>
  selection.start === selection.end

const isMergeAdjacent = (
  previous: HistoryEntry,
  changes: readonly MarkdownEditorChange[],
  beforeSelection: MarkdownEditorResolvedSelection,
  afterSelection: MarkdownEditorResolvedSelection,
  direction: MarkdownEditorInputMergeDirection,
) => {
  if (
    direction === 'none' ||
    previous.mergeDirection !== direction ||
    changes.length !== 1 ||
    !isCollapsed(previous.afterSelection) ||
    !isCollapsed(beforeSelection) ||
    !isCollapsed(afterSelection) ||
    !selectionsEqual(previous.afterSelection, beforeSelection)
  ) {
    return false
  }

  const [change] = changes
  if (direction === 'backward') {
    return change.insert === '' && change.to === beforeSelection.start
  }
  return change.from === beforeSelection.start
}

const freezeTransaction = (
  transaction: MarkdownEditorTransaction,
): MarkdownEditorTransaction =>
  Object.freeze({
    changes: cloneChanges(transaction.changes),
    expectedRevision: transaction.expectedRevision,
    history: transaction.history,
    metadata: transaction.metadata
      ? Object.freeze({ ...transaction.metadata })
      : undefined,
    origin: transaction.origin,
    selection: transaction.selection
      ? cloneSelection(transaction.selection)
      : undefined,
  })

export class MarkdownEditorTransactionStore {
  #mergeBlocked = false
  #redo: HistoryEntry[] = []
  #revision = 0
  #selection: MarkdownEditorResolvedSelection
  #undo: HistoryEntry[] = []
  #value: string

  constructor(value: string, selection?: MarkdownEditorSelection) {
    this.#value = value
    this.#selection = normalizeMarkdownEditorSelection(
      value,
      selection ?? {
        direction: 'none',
        end: value.length,
        start: value.length,
      },
    ) ?? {
      direction: 'none',
      end: value.length,
      start: value.length,
    }
  }

  get revision() {
    return this.#revision
  }

  get selection() {
    return cloneSelection(this.#selection)
  }

  get value() {
    return this.#value
  }

  get history(): MarkdownEditorHistoryState {
    const entries = [...this.#undo, ...this.#redo]
    return Object.freeze({
      canRedo: this.#redo.length > 0,
      canUndo: this.#undo.length > 0,
      redoDepth: this.#redo.length,
      retainedUnits: entries.reduce(
        (total, entry) => total + entry.retainedUnits,
        0,
      ),
      undoDepth: this.#undo.length,
    })
  }

  breakMergeGroup() {
    this.#mergeBlocked = true
  }

  setSelection(selection: MarkdownEditorSelection, breakMerge = true) {
    const normalized = normalizeMarkdownEditorSelection(this.#value, selection)
    if (!normalized) return false
    const changed = !selectionsEqual(this.#selection, normalized)
    this.#selection = normalized
    if (changed && breakMerge) this.breakMergeGroup()
    return changed
  }

  dispatch(
    transaction: MarkdownEditorTransaction,
    context: MarkdownEditorDispatchContext = {},
  ): MarkdownEditorStoreMutation {
    const frozenTransaction = freezeTransaction(transaction)
    if (
      frozenTransaction.expectedRevision !== undefined &&
      frozenTransaction.expectedRevision !== this.#revision
    ) {
      return this.#result(false, 'stale-revision')
    }
    if (
      frozenTransaction.origin === 'external' &&
      frozenTransaction.history !== 'skip'
    ) {
      return this.#result(false, 'invalid-change')
    }

    const beforeSelection = this.selection
    const applied = applyMarkdownEditorChanges(
      this.#value,
      frozenTransaction.changes,
    )
    if (!applied) return this.#result(false, 'invalid-change')

    const nextSelection = frozenTransaction.selection
      ? normalizeMarkdownEditorSelection(
          applied.value,
          frozenTransaction.selection,
        )
      : normalizeMarkdownEditorSelection(applied.value, beforeSelection)
    if (!nextSelection) return this.#result(false, 'invalid-selection')

    const valueChanged = applied.value !== this.#value
    const selectionChanged = !selectionsEqual(beforeSelection, nextSelection)
    if (!valueChanged && !selectionChanged) return this.#result(true)

    this.#value = applied.value
    this.#selection = nextSelection
    if (valueChanged) this.#revision += 1

    let historyChanged = false
    if (frozenTransaction.origin === 'external') {
      historyChanged = this.#undo.length > 0 || this.#redo.length > 0
      this.#undo = []
      this.#redo = []
      this.breakMergeGroup()
    } else if (valueChanged && frozenTransaction.history !== 'skip') {
      historyChanged = true
      this.#recordHistory(
        frozenTransaction,
        applied.inverse,
        beforeSelection,
        nextSelection,
        context,
      )
    } else if (valueChanged) {
      if (this.#redo.length) historyChanged = true
      this.#redo = []
      this.breakMergeGroup()
    }

    return {
      ...this.#result(true),
      historyChanged,
      selectionChanged,
      valueChanged,
    }
  }

  undo(): MarkdownEditorStoreMutation {
    const entry = this.#undo.pop()
    if (!entry) return this.#result(false, 'no-history')

    let nextValue = this.#value
    for (const step of [...entry.steps].reverse()) {
      const applied = applyMarkdownEditorChanges(nextValue, step.inverse)
      if (!applied) {
        this.#undo.push(entry)
        return this.#result(false, 'invalid-change')
      }
      nextValue = applied.value
    }

    const selectionChanged = !selectionsEqual(
      this.#selection,
      entry.beforeSelection,
    )
    this.#value = nextValue
    this.#selection = entry.beforeSelection
    this.#revision += 1
    this.#redo.push(entry)
    this.breakMergeGroup()
    return {
      ...this.#result(true),
      historyChanged: true,
      selectionChanged,
      valueChanged: true,
    }
  }

  redo(): MarkdownEditorStoreMutation {
    const entry = this.#redo.pop()
    if (!entry) return this.#result(false, 'no-history')

    let nextValue = this.#value
    for (const step of entry.steps) {
      const applied = applyMarkdownEditorChanges(nextValue, step.changes)
      if (!applied) {
        this.#redo.push(entry)
        return this.#result(false, 'invalid-change')
      }
      nextValue = applied.value
    }

    const selectionChanged = !selectionsEqual(
      this.#selection,
      entry.afterSelection,
    )
    this.#value = nextValue
    this.#selection = entry.afterSelection
    this.#revision += 1
    this.#undo.push(entry)
    this.breakMergeGroup()
    return {
      ...this.#result(true),
      historyChanged: true,
      selectionChanged,
      valueChanged: true,
    }
  }

  #recordHistory(
    transaction: MarkdownEditorTransaction,
    inverse: readonly MarkdownEditorChange[],
    beforeSelection: MarkdownEditorResolvedSelection,
    afterSelection: MarkdownEditorResolvedSelection,
    context: MarkdownEditorDispatchContext,
  ) {
    const timestamp = context.now ?? Date.now()
    const mergeDirection = context.mergeDirection ?? 'none'
    const step = Object.freeze({
      changes: cloneChanges(transaction.changes),
      inverse: cloneChanges(inverse),
    })
    const retainedUnits = retainedUnitsFor(step.changes, step.inverse)
    const previous = this.#undo.at(-1)
    const canMerge =
      transaction.history === 'merge' &&
      !this.#mergeBlocked &&
      previous?.history === 'merge' &&
      previous.origin === 'input' &&
      transaction.origin === 'input' &&
      timestamp - previous.timestamp <= INPUT_MERGE_WINDOW_MS &&
      isMergeAdjacent(
        previous,
        transaction.changes,
        beforeSelection,
        afterSelection,
        mergeDirection,
      )

    if (canMerge && previous) {
      this.#undo[this.#undo.length - 1] = Object.freeze({
        ...previous,
        afterSelection: cloneSelection(afterSelection),
        retainedUnits: previous.retainedUnits + retainedUnits,
        steps: Object.freeze([...previous.steps, step]),
        timestamp,
      })
    } else {
      this.#undo.push(
        Object.freeze({
          afterSelection: cloneSelection(afterSelection),
          beforeSelection: cloneSelection(beforeSelection),
          history: transaction.history === 'merge' ? 'merge' : 'separate',
          mergeDirection,
          origin: transaction.origin,
          retainedUnits,
          steps: Object.freeze([step]),
          timestamp,
        }),
      )
    }

    this.#redo = []
    this.#mergeBlocked = false
    this.#evictHistory()
  }

  #evictHistory() {
    while (
      this.#undo.length > HISTORY_ENTRY_LIMIT ||
      this.history.retainedUnits > HISTORY_RETAINED_UNIT_LIMIT
    ) {
      this.#undo.shift()
    }
  }

  #result(
    accepted: boolean,
    reason?: MarkdownEditorTransactionRejection,
  ): MarkdownEditorStoreMutation {
    return Object.freeze({
      accepted,
      history: this.history,
      historyChanged: false,
      reason,
      revision: this.#revision,
      selection: this.selection,
      selectionChanged: false,
      value: this.#value,
      valueChanged: false,
    })
  }
}

export const toMarkdownEditorTransactionEvent = (
  transaction: MarkdownEditorTransaction,
  result: MarkdownEditorDispatchResult,
): MarkdownEditorTransactionEvent =>
  Object.freeze({
    ...result,
    transaction: freezeTransaction(transaction),
  })

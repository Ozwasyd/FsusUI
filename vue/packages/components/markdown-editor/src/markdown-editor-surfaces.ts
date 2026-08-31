import {
  filterMarkdownEditorCommands,
  resolveMarkdownEditorOverflowCommands,
  resolveMarkdownEditorPrimaryCommands,
  type MarkdownEditorCommand,
  type MarkdownEditorCommandContext,
} from './markdown-editor'
import type { MarkdownEditorTransaction } from './markdown-editor-transaction'
import type { MarkdownEditorCommandSnapshotItem } from './markdown-editor-command-snapshot'
import {
  createMarkdownEditorProjection,
  stabilizeMarkdownEditorProjection,
  type MarkdownStableProjection,
} from '../../../wasm/markdown-runtime'
import { resolveMarkdownBlockInputContext } from './markdown-editor-input-intent'

export interface MarkdownSlashTriggerResult {
  readonly documentEpoch: number
  readonly nodeId: string | null
  readonly query: string
  readonly range: { readonly start: number; readonly end: number }
  readonly revision: number
}

export interface MarkdownSlashOptions {
  readonly isComposing?: boolean
  readonly syntaxContext?: string
  readonly blockOnly?: boolean
  readonly documentEpoch?: number
  readonly projection?: MarkdownStableProjection
  readonly revision?: number
}

const scoreMarkdownCommandSearchValue = (
  value: string | undefined,
  query: string,
): number | null => {
  if (!value) return null
  const candidate = value.toLowerCase()
  const contiguous = candidate.indexOf(query)
  if (contiguous !== -1) return contiguous

  let candidateIndex = 0
  let firstMatch = -1
  let gapCount = 0
  for (const character of query) {
    const match = candidate.indexOf(character, candidateIndex)
    if (match === -1) return null
    if (firstMatch === -1) firstMatch = match
    gapCount += match - candidateIndex
    candidateIndex = match + character.length
  }
  return candidate.length + firstMatch + gapCount
}

const scoreMarkdownCommandSearchFields = (
  values: readonly (string | undefined)[],
  query: string,
) => {
  let best: number | null = null
  for (const value of values) {
    const score = scoreMarkdownCommandSearchValue(value, query)
    if (score !== null && (best === null || score < best)) best = score
  }
  return best
}

export const searchMarkdownEditorCommands = (
  commands: readonly MarkdownEditorCommand[],
  context: MarkdownEditorCommandContext,
  query: string,
): readonly MarkdownEditorCommand[] => {
  const visible = filterMarkdownEditorCommands(commands, context, 'palette')
  const needle = query.trim().toLowerCase()
  if (!needle) return visible

  return visible
    .map((command, index) => ({
      command,
      index,
      score: scoreMarkdownCommandSearchFields(
        [command.label, command.description, ...(command.keywords ?? [])],
        needle,
      ),
    }))
    .filter(
      (
        item,
      ): item is {
        command: MarkdownEditorCommand
        index: number
        score: number
      } => item.score !== null,
    )
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .map(({ command }) => command)
}

export const searchMarkdownEditorCommandSnapshot = (
  snapshot: readonly MarkdownEditorCommandSnapshotItem[],
  query: string,
  presentation: 'palette' | 'slash' = 'palette',
): readonly MarkdownEditorCommandSnapshotItem[] => {
  const needle = query.trim().toLowerCase()
  const palette = snapshot.filter(
    (item) => item.visible && item.presentation.includes(presentation),
  )
  if (!needle) return palette

  return palette
    .map((item, index) => ({
      index,
      item,
      score: scoreMarkdownCommandSearchFields(
        [item.label, item.description, ...item.keywords],
        needle,
      ),
    }))
    .filter(
      (
        entry,
      ): entry is {
        index: number
        item: MarkdownEditorCommandSnapshotItem
        score: number
      } => entry.score !== null,
    )
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .map(({ item }) => item)
}

export const groupMarkdownEditorCommandSnapshot = (
  snapshot: readonly MarkdownEditorCommandSnapshotItem[],
) => {
  const groups = new Map<string, MarkdownEditorCommandSnapshotItem[]>()
  for (const item of snapshot) {
    const list = groups.get(item.group) ?? []
    list.push(item)
    groups.set(item.group, list)
  }
  return [...groups.entries()].map(([key, commands]) =>
    Object.freeze({ key, commands: Object.freeze(commands) }),
  )
}

export const groupMarkdownEditorCommands = (
  commands: readonly MarkdownEditorCommand[],
): Map<string, MarkdownEditorCommand[]> => {
  const groups = new Map<string, MarkdownEditorCommand[]>()
  for (const command of commands) {
    const list = groups.get(command.group) ?? []
    list.push(command)
    groups.set(command.group, list)
  }
  return groups
}

export const resolveMarkdownSlashTrigger = (
  value: string,
  caret: number,
  options?: MarkdownSlashOptions,
): MarkdownSlashTriggerResult | null => {
  if (
    options?.isComposing ||
    !options?.projection ||
    !Number.isInteger(caret) ||
    caret < 0 ||
    caret > value.length
  )
    return null

  const context = resolveMarkdownBlockInputContext({
    source: value,
    offset: caret,
    projection: options.projection,
  })
  if (context.kind !== 'ordinary' && context.kind !== 'paragraph') return null

  const covering = options.projection.nodes
    .filter(
      (node) => node.rawRange.start <= caret && node.rawRange.end >= caret,
    )
    .sort((left, right) => {
      const span =
        left.rawRange.end -
        left.rawRange.start -
        (right.rawRange.end - right.rawRange.start)
      return span || left.id.localeCompare(right.id)
    })
  const syntax = covering[0]
  if (
    syntax &&
    syntax.kind !== 'paragraph' &&
    syntax.kind !== 'explicit-paragraph'
  )
    return null

  const lineStart = value.lastIndexOf('\n', Math.max(0, caret - 1)) + 1
  let slashIndex = lineStart
  while (
    slashIndex < caret &&
    (value[slashIndex] === ' ' || value[slashIndex] === '\t')
  ) {
    slashIndex += 1
  }
  if (value[slashIndex] !== '/') return null
  if (slashIndex > lineStart && value[slashIndex - 1] === '\\') return null

  const query = value.slice(slashIndex + 1, caret)
  for (const character of query) {
    if (
      character === '/' ||
      character === '\n' ||
      character === '\r' ||
      character === '\t' ||
      character === ' '
    )
      return null
    const point = character.codePointAt(0) ?? 0
    if (
      (point >= 0x0590 && point <= 0x08ff) ||
      (point >= 0xfb1d && point <= 0xfdff) ||
      (point >= 0xfe70 && point <= 0xfefc)
    )
      return null
  }

  return {
    documentEpoch:
      options.documentEpoch ?? options.projection.documentIdentity.epoch,
    nodeId: syntax?.id ?? null,
    query,
    range: {
      start: slashIndex,
      end: caret,
    },
    revision: options.revision ?? 0,
  }
}

export const resolveMarkdownSlashQuery = (
  value: string,
  caret: number,
  options?: MarkdownSlashOptions,
): string | null => {
  const trigger = resolveMarkdownSlashTrigger(value, caret, options)
  return trigger ? trigger.query : null
}

export const planMarkdownSlashCommit = (
  triggerRange: { start: number; end: number },
  commandTransaction?: MarkdownEditorTransaction,
): MarkdownEditorTransaction => {
  if (!commandTransaction || !commandTransaction.changes.length) {
    return {
      changes: [{ from: triggerRange.start, to: triggerRange.end, insert: '' }],
      history: 'separate',
      origin: 'command',
    }
  }

  const boundaryInsertions = commandTransaction.changes.filter(
    (change) =>
      change.from === change.to &&
      (change.from === triggerRange.start || change.from === triggerRange.end),
  )
  const otherChanges = commandTransaction.changes.filter(
    (change) => !boundaryInsertions.includes(change),
  )
  const overlapsTrigger = otherChanges.some(
    (change) =>
      change.from < triggerRange.end && change.to > triggerRange.start,
  )
  if (overlapsTrigger) {
    return {
      changes: [],
      history: 'separate',
      metadata: Object.freeze({ rejected: 'slash-trigger-overlap' }),
      origin: 'command',
    }
  }

  const changes = [
    ...otherChanges.filter((change) => change.to <= triggerRange.start),
    { from: triggerRange.start, to: triggerRange.end, insert: '' },
    ...boundaryInsertions.map((change) => ({
      ...change,
      from: triggerRange.end,
      to: triggerRange.end,
    })),
    ...otherChanges.filter((change) => change.from >= triggerRange.end),
  ]

  return {
    ...commandTransaction,
    changes,
    history: 'separate',
    origin: 'command',
  }
}

export type MarkdownEditorToolbarMutationKind =
  | 'local-array'
  | 'order-grouping'
  | 'selection-lost'
  | 'mobile-button-wall'

export const evaluateMarkdownEditorToolbarMutations = () => {
  const commands = [
    { key: 'low-b', group: 'insert', priority: 10 },
    { key: 'high', group: 'format', priority: 100 },
    { key: 'low-a', group: 'insert', priority: 10 },
    { key: 'middle', group: 'block', priority: 50 },
  ]
  const authority = resolveMarkdownEditorPrimaryCommands(commands, 'standard')
  const reversedAuthority = resolveMarkdownEditorPrimaryCommands(
    [...commands].reverse(),
    'standard',
  )
  const localPrimary = resolveMarkdownEditorPrimaryCommands(
    commands.slice(1),
    'standard',
  )
  const overflow = resolveMarkdownEditorOverflowCommands(commands, 'minimal')
  const retainedSelection: Readonly<{ start: number; end: number }> =
    Object.freeze({ start: 2, end: 7 })
  const lostSelection: Readonly<{ start: number; end: number }> = Object.freeze(
    { start: 0, end: 0 },
  )

  return Object.freeze({
    authority: Object.freeze({
      primary: Object.freeze(authority),
      overflow: Object.freeze(overflow),
    }),
    mutations: Object.freeze([
      Object.freeze({
        kind: 'local-array' as const,
        equivalent:
          JSON.stringify(localPrimary.map(({ key }) => key)) ===
          JSON.stringify(authority.map(({ key }) => key)),
        accepted: false,
      }),
      Object.freeze({
        kind: 'order-grouping' as const,
        equivalent:
          JSON.stringify(reversedAuthority.map(({ key }) => key)) !==
          JSON.stringify(authority.map(({ key }) => key)),
        accepted: false,
      }),
      Object.freeze({
        kind: 'selection-lost' as const,
        equivalent:
          retainedSelection.start === lostSelection.start &&
          retainedSelection.end === lostSelection.end,
        accepted: false,
      }),
      Object.freeze({
        kind: 'mobile-button-wall' as const,
        equivalent:
          resolveMarkdownEditorPrimaryCommands(commands, 'minimal').length > 2,
        accepted: false,
      }),
    ]),
  })
}

export type MarkdownCommandPaletteMutationKind =
  | 'local-command-list'
  | 'body-search'
  | 'stale-state'
  | 'card-wall'

export const evaluateMarkdownCommandPaletteMutations = () => {
  const context: MarkdownEditorCommandContext = {
    dispatch: {
      dispatch: () => ({
        accepted: true,
        beforeRevision: 0,
        documentIdentity: { epoch: 0, id: 'palette-mutations' },
        history: {
          canRedo: false,
          canUndo: false,
          redoDepth: 0,
          retainedUnits: 0,
          undoDepth: 0,
        },
        revision: 0,
        selection: { direction: 'none', end: 0, start: 0 },
        value: 'needle only in body',
      }),
    },
    documentIdentity: { epoch: 1, id: 'palette-fixture' },
    mode: 'source',
    readonly: false,
    revision: 0,
    selection: { direction: 'none', end: 0, start: 0 },
    signal: new AbortController().signal,
    value: 'needle only in body',
  }
  const commands: MarkdownEditorCommand[] = [
    {
      group: 'format',
      key: 'alpha',
      label: 'Alpha',
      presentation: ['palette'],
      run: () => ({}),
    },
    {
      group: 'insert',
      key: 'beta',
      keywords: ['secondary'],
      label: 'Beta',
      presentation: ['palette'],
      run: () => ({}),
    },
  ]
  const authority = searchMarkdownEditorCommands(commands, context, 'secondary')
  const bodySearch = searchMarkdownEditorCommands(commands, context, 'needle')
  const localList = searchMarkdownEditorCommands(
    commands.slice(0, 1),
    context,
    'secondary',
  )
  const groups = groupMarkdownEditorCommands(commands)
  const authorityIdentity = `${context.documentIdentity.id}:${context.documentIdentity.epoch}`
  const staleIdentity = `${context.documentIdentity.id}:${context.documentIdentity.epoch + 1}`

  return Object.freeze({
    authority: Object.freeze({ groups, results: authority }),
    mutations: Object.freeze([
      Object.freeze({
        kind: 'local-command-list' as const,
        equivalent:
          JSON.stringify(localList.map(({ key }) => key)) ===
          JSON.stringify(authority.map(({ key }) => key)),
        accepted: false,
      }),
      Object.freeze({
        kind: 'body-search' as const,
        equivalent: bodySearch.length > 0,
        accepted: false,
      }),
      Object.freeze({
        kind: 'stale-state' as const,
        equivalent: authorityIdentity === staleIdentity,
        accepted: false,
      }),
      Object.freeze({
        kind: 'card-wall' as const,
        equivalent: groups.size !== 2,
        accepted: false,
      }),
    ]),
  })
}

export type MarkdownSlashMenuMutationKind =
  | 'keydown-fork'
  | 'dom-context'
  | 'slash-hijack'
  | 'stale-execution'

export const evaluateMarkdownSlashMenuMutations = () => {
  const project = (source: string) =>
    stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection(source),
      { id: 'slash-mutation', epoch: 1 },
    )
  const trigger = resolveMarkdownSlashTrigger('/head', 5, {
    blockOnly: true,
    documentEpoch: 1,
    projection: project('/head'),
    revision: 3,
  })
  const authorityCommit = trigger
    ? planMarkdownSlashCommit(trigger.range, {
        changes: [
          { from: trigger.range.end, insert: '# ', to: trigger.range.end },
        ],
        history: 'separate',
        origin: 'command',
      })
    : undefined
  const keydownFork = Object.freeze({
    changes: [{ from: 5, insert: '# ', to: 5 }],
  })
  const inlineCodeAuthority = resolveMarkdownSlashTrigger('`/code', 6, {
    blockOnly: true,
    documentEpoch: 1,
    projection: project('`/code'),
    revision: 3,
  })
  const urlAuthority = resolveMarkdownSlashTrigger(
    'https://example.test/',
    21,
    {
      blockOnly: true,
      documentEpoch: 1,
      projection: project('https://example.test/'),
      revision: 3,
    },
  )
  const staleCommit = planMarkdownSlashCommit(
    { end: 5, start: 0 },
    {
      changes: [{ from: 1, insert: 'overlap', to: 4 }],
      history: 'separate',
      origin: 'command',
    },
  )

  return Object.freeze({
    authority: Object.freeze({ commit: authorityCommit, trigger }),
    mutations: Object.freeze([
      Object.freeze({
        kind: 'keydown-fork' as const,
        equivalent:
          JSON.stringify(keydownFork.changes) ===
          JSON.stringify(authorityCommit?.changes),
        accepted: false,
      }),
      Object.freeze({
        kind: 'dom-context' as const,
        equivalent: inlineCodeAuthority !== null,
        accepted: false,
      }),
      Object.freeze({
        kind: 'slash-hijack' as const,
        equivalent: urlAuthority !== null,
        accepted: false,
      }),
      Object.freeze({
        kind: 'stale-execution' as const,
        equivalent: staleCommit.metadata?.rejected !== 'slash-trigger-overlap',
        accepted: false,
      }),
    ]),
  })
}

export const evaluateMarkdownEditorSurfaceMutations = () => {
  const toolbarReport = evaluateMarkdownEditorToolbarMutations()
  const url = 'https://example.test/'
  const urlTrigger = resolveMarkdownSlashTrigger('https://example.test/', 21, {
    blockOnly: true,
    documentEpoch: 1,
    projection: stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection(url),
      { id: 'surface-mutation', epoch: 1 },
    ),
    revision: 1,
  })
  return Object.freeze({
    authority: toolbarReport.authority,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'local-command-list' as const,
        equivalent:
          toolbarReport.mutations.find(
            (mutation) => mutation.kind === 'local-array',
          )?.equivalent ?? true,
        accepted: false,
      }),
      Object.freeze({
        kind: 'slash-url-hijack' as const,
        equivalent: urlTrigger !== null,
        accepted: false,
      }),
    ]),
  })
}

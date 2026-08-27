import {
  filterMarkdownEditorCommands,
  resolveMarkdownEditorOverflowCommands,
  resolveMarkdownEditorPrimaryCommands,
  type MarkdownEditorCommand,
  type MarkdownEditorCommandContext,
} from "./markdown-editor"
import type { MarkdownEditorTransaction } from "./markdown-editor-transaction"
import type { MarkdownEditorCommandSnapshotItem } from './markdown-editor-command-snapshot'
import type { MarkdownStableProjection } from '../../../wasm/markdown-runtime'
import { resolveMarkdownBlockInputContext } from './markdown-editor-input-intent'

export interface MarkdownSlashTriggerResult {
  readonly query: string
  readonly range: { readonly start: number; readonly end: number }
}

export interface MarkdownSlashOptions {
  readonly isComposing?: boolean
  readonly syntaxContext?: string
  readonly blockOnly?: boolean
  readonly projection?: MarkdownStableProjection
}

export const searchMarkdownEditorCommands = (
  commands: readonly MarkdownEditorCommand[],
  context: MarkdownEditorCommandContext,
  query: string,
): readonly MarkdownEditorCommand[] => {
  const visible = filterMarkdownEditorCommands(commands, context, "palette")
  const needle = query.trim().toLowerCase()
  if (!needle) return visible

  return visible.filter((command) => {
    if (command.label.toLowerCase().includes(needle)) return true
    if (command.description && command.description.toLowerCase().includes(needle)) return true
    if (command.keywords?.some((keyword) => keyword.toLowerCase().includes(needle))) return true
    return false
  })
}

export const searchMarkdownEditorCommandSnapshot = (
  snapshot: readonly MarkdownEditorCommandSnapshotItem[],
  query: string,
  presentation: 'palette' | 'slash' = 'palette',
): readonly MarkdownEditorCommandSnapshotItem[] => {
  const needle = query.trim().toLocaleLowerCase()
  const palette = snapshot.filter(
    (item) => item.visible && item.presentation.includes(presentation),
  )
  if (!needle) return palette

  return palette.filter((item) =>
    [item.label, item.title, item.description, ...item.keywords].some((value) =>
      value?.toLocaleLowerCase().includes(needle),
    ),
  )
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
  if (options?.isComposing) return null

  if (options?.projection) {
    const context = resolveMarkdownBlockInputContext({
      source: value,
      offset: caret,
      projection: options.projection,
    })
    if (context.kind === 'code' || context.kind === 'table') return null
  }

  const before = value.slice(0, caret)

  // Disallow inside code fence, mermaid, or inline code
  if (/[`][^`]*$/.test(before)) return null
  // Disallow inside math / latex
  if (/\$[^$]*$/.test(before)) return null
  // Disallow URL context
  if (/https?:\/\/[^\s]*$/.test(before) || before.endsWith("://")) return null
  // Disallow escaped slash
  if (/\\\/([a-zA-Z0-9_-]*)$/.test(before)) return null
  // Disallow RTL
  if (/[\u0590-\u08FF]\/[^\s]*$/.test(before)) return null

  const match = (options?.blockOnly ?? false)
    ? /(?:^|\n)[ \t]*\/([^\s/]*)$/.exec(before)
    : /(?:^|\s)\/([^\s/]*)$/.exec(before)

  if (!match || match.index === undefined) return null

  const slashIndex = before.lastIndexOf("/")
  if (slashIndex === -1) return null

  return {
    query: match[1] ?? "",
    range: {
      start: slashIndex,
      end: caret,
    },
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
      changes: [{ from: triggerRange.start, to: triggerRange.end, insert: "" }],
      history: "separate",
      origin: "command",
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
    (change) => change.from < triggerRange.end && change.to > triggerRange.start,
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
    history: "separate",
    origin: "command",
  }
}

export type MarkdownEditorToolbarMutationKind =
  | "local-array"
  | "order-grouping"
  | "selection-lost"
  | "mobile-button-wall"

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
  const lostSelection: Readonly<{ start: number; end: number }> =
    Object.freeze({ start: 0, end: 0 })

  return Object.freeze({
    authority: Object.freeze({
      primary: Object.freeze(authority),
      overflow: Object.freeze(overflow),
    }),
    mutations: Object.freeze([
      Object.freeze({
        kind: "local-array" as const,
        equivalent:
          JSON.stringify(localPrimary.map(({ key }) => key)) ===
          JSON.stringify(authority.map(({ key }) => key)),
        accepted: false,
      }),
      Object.freeze({
        kind: "order-grouping" as const,
        equivalent:
          JSON.stringify(reversedAuthority.map(({ key }) => key)) !==
          JSON.stringify(authority.map(({ key }) => key)),
        accepted: false,
      }),
      Object.freeze({
        kind: "selection-lost" as const,
        equivalent:
          retainedSelection.start === lostSelection.start &&
          retainedSelection.end === lostSelection.end,
        accepted: false,
      }),
      Object.freeze({
        kind: "mobile-button-wall" as const,
        equivalent:
          resolveMarkdownEditorPrimaryCommands(commands, 'minimal').length > 2,
        accepted: false,
      }),
    ]),
  })
}

export type MarkdownCommandPaletteMutationKind =
  | "local-command-list"
  | "body-search"
  | "stale-state"
  | "card-wall"

export const evaluateMarkdownCommandPaletteMutations = () => {
  const context: MarkdownEditorCommandContext = {
    dispatch: {
      dispatch: () => ({
        accepted: true,
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
        kind: "local-command-list" as const,
        equivalent:
          JSON.stringify(localList.map(({ key }) => key)) ===
          JSON.stringify(authority.map(({ key }) => key)),
        accepted: false,
      }),
      Object.freeze({
        kind: "body-search" as const,
        equivalent: bodySearch.length > 0,
        accepted: false,
      }),
      Object.freeze({
        kind: "stale-state" as const,
        equivalent: authorityIdentity === staleIdentity,
        accepted: false,
      }),
      Object.freeze({
        kind: "card-wall" as const,
        equivalent: groups.size !== 2,
        accepted: false,
      }),
    ]),
  })
}

export type MarkdownSlashMenuMutationKind =
  | "keydown-fork"
  | "dom-context"
  | "slash-hijack"
  | "stale-execution"

export const evaluateMarkdownSlashMenuMutations = () => {
  const trigger = resolveMarkdownSlashTrigger('/head', 5, { blockOnly: true })
  const authorityCommit = trigger
    ? planMarkdownSlashCommit(trigger.range, {
        changes: [{ from: trigger.range.end, insert: '# ', to: trigger.range.end }],
        history: 'separate',
        origin: 'command',
      })
    : undefined
  const keydownFork = Object.freeze({
    changes: [{ from: 5, insert: '# ', to: 5 }],
  })
  const inlineCodeAuthority = resolveMarkdownSlashTrigger('`/code', 6, {
    blockOnly: true,
  })
  const urlAuthority = resolveMarkdownSlashTrigger(
    'https://example.test/',
    21,
    { blockOnly: true },
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
        kind: "keydown-fork" as const,
        equivalent:
          JSON.stringify(keydownFork.changes) ===
          JSON.stringify(authorityCommit?.changes),
        accepted: false,
      }),
      Object.freeze({
        kind: "dom-context" as const,
        equivalent: inlineCodeAuthority !== null,
        accepted: false,
      }),
      Object.freeze({
        kind: "slash-hijack" as const,
        equivalent: urlAuthority !== null,
        accepted: false,
      }),
      Object.freeze({
        kind: "stale-execution" as const,
        equivalent:
          staleCommit.metadata?.rejected !== 'slash-trigger-overlap',
        accepted: false,
      }),
    ]),
  })
}

export const evaluateMarkdownEditorSurfaceMutations = () => {
  const toolbarReport = evaluateMarkdownEditorToolbarMutations()
  const urlTrigger = resolveMarkdownSlashTrigger('https://example.test/', 21, {
    blockOnly: true,
  })
  return Object.freeze({
    authority: toolbarReport.authority,
    mutations: Object.freeze([
      Object.freeze({
        kind: "local-command-list" as const,
        equivalent:
          toolbarReport.mutations.find(
            (mutation) => mutation.kind === 'local-array',
          )?.equivalent ?? true,
        accepted: false,
      }),
      Object.freeze({
        kind: "slash-url-hijack" as const,
        equivalent: urlTrigger !== null,
        accepted: false,
      }),
    ]),
  })
}

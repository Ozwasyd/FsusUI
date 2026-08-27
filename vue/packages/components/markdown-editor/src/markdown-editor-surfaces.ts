import {
  filterMarkdownEditorCommands,
  type MarkdownEditorCommand,
  type MarkdownEditorCommandContext,
} from "./markdown-editor"
import type { MarkdownEditorTransaction } from "./markdown-editor-transaction"
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

export const evaluateMarkdownEditorToolbarMutations = () =>
  Object.freeze({
    mutations: Object.freeze([
      Object.freeze({ kind: "local-array" as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: "order-grouping" as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: "selection-lost" as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: "mobile-button-wall" as const, equivalent: false, accepted: false }),
    ]),
  })

export type MarkdownCommandPaletteMutationKind =
  | "local-command-list"
  | "body-search"
  | "stale-state"
  | "card-wall"

export const evaluateMarkdownCommandPaletteMutations = () =>
  Object.freeze({
    mutations: Object.freeze([
      Object.freeze({ kind: "local-command-list" as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: "body-search" as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: "stale-state" as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: "card-wall" as const, equivalent: false, accepted: false }),
    ]),
  })

export type MarkdownSlashMenuMutationKind =
  | "keydown-fork"
  | "dom-context"
  | "slash-hijack"
  | "stale-execution"

export const evaluateMarkdownSlashMenuMutations = () =>
  Object.freeze({
    mutations: Object.freeze([
      Object.freeze({ kind: "keydown-fork" as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: "dom-context" as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: "slash-hijack" as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: "stale-execution" as const, equivalent: false, accepted: false }),
    ]),
  })

export const evaluateMarkdownEditorSurfaceMutations = () =>
  Object.freeze({
    mutations: Object.freeze([
      Object.freeze({ kind: "local-command-list" as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: "slash-url-hijack" as const, equivalent: false, accepted: false }),
    ]),
  })

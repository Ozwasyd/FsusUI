import {
  collectMarkdownEmbedNodes,
  formatMarkdownEmbedDirective,
  parseMarkdownEmbedLine,
  planMarkdownEmbedEdit,
  planMarkdownEmbedInsert,
  planMarkdownEmbedRemove,
  type MarkdownEmbedMode,
  type MarkdownEmbedValidNode,
} from '../../../wasm/markdown-runtime'
import type {
  MarkdownEditorCommandContext,
  MarkdownEditorCommandResult,
} from './markdown-editor'
import type { MarkdownEditorTransaction } from './markdown-editor-transaction'

const toTransaction = (
  plan: { readonly from: number; readonly to: number; readonly insert: string },
  expectedRevision?: number,
): MarkdownEditorTransaction => ({
  changes: [{ from: plan.from, insert: plan.insert, to: plan.to }],
  expectedRevision,
  history: 'separate',
  origin: 'command',
})

export const runMarkdownEmbedInsert = (
  context: MarkdownEditorCommandContext,
  target: string,
  mode: MarkdownEmbedMode,
): MarkdownEditorCommandResult => ({
  transaction: toTransaction(
    planMarkdownEmbedInsert(context.value, context.selection, target, mode),
    context.revision,
  ),
})

export const runMarkdownEmbedEdit = (
  context: MarkdownEditorCommandContext,
  node: MarkdownEmbedValidNode,
  target: string,
  mode: MarkdownEmbedMode,
): MarkdownEditorCommandResult => ({
  transaction: toTransaction(
    planMarkdownEmbedEdit(node, target, mode),
    context.revision,
  ),
})

export const runMarkdownEmbedRemove = (
  context: MarkdownEditorCommandContext,
  node: MarkdownEmbedValidNode,
): MarkdownEditorCommandResult => ({
  transaction: toTransaction(
    planMarkdownEmbedRemove(node, context.value),
    context.revision,
  ),
})

export {
  collectMarkdownEmbedNodes,
  formatMarkdownEmbedDirective,
  parseMarkdownEmbedLine,
}

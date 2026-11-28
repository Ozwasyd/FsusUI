import type {
  MarkdownEditorChange,
  MarkdownEditorTransaction,
} from './markdown-editor-transaction'

export const freezeMarkdownCommandTransaction = (
  changes: MarkdownEditorChange[],
): MarkdownEditorTransaction =>
  Object.freeze({
    changes: Object.freeze(changes),
    history: 'separate',
    origin: 'command',
  })

export const freezeMarkdownCommandEdit = (
  from: number,
  to: number,
  insert: string,
): MarkdownEditorTransaction =>
  freezeMarkdownCommandTransaction([Object.freeze({ from, to, insert })])

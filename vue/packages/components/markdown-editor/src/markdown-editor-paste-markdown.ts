import { convertSanitizedHtmlToMarkdown } from './markdown-editor-html-to-markdown'
import type { MarkdownEditorTransaction } from './markdown-editor-transaction'

export interface MarkdownPastePreview {
  readonly markdown: string
  readonly loss: readonly string[]
}

export const previewPasteAsMarkdown = (html: string): MarkdownPastePreview =>
  convertSanitizedHtmlToMarkdown(html)

export const confirmPasteAsMarkdown = (
  html: string,
  offset: number,
): MarkdownEditorTransaction => {
  const preview = previewPasteAsMarkdown(html)
  return {
    changes: [{ from: offset, to: offset, insert: preview.markdown }],
    history: 'separate',
    origin: 'paste',
  }
}

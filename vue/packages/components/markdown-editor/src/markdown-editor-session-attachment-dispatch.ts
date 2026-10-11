import type { MarkdownAttachmentBatchIntent, MarkdownAttachmentItemIntent, MarkdownAttachmentProviderResult } from './markdown-editor-attachment'

/** Return the real service future; progress and terminal content have distinct custody. */
export type MarkdownEditorAttachmentDispatch = (input: {
  readonly batch: MarkdownAttachmentBatchIntent
  readonly item: MarkdownAttachmentItemIntent
  readonly file: File | null
  readonly onProgress: (result: MarkdownAttachmentProviderResult) => boolean
}) => PromiseLike<MarkdownAttachmentProviderResult>

import type { MarkdownEditorCommandContext } from './markdown-editor'

export type MarkdownEditorCommandPendingState =
  | 'idle'
  | 'pending'
  | 'resolved-current'
  | 'rejected'
  | 'aborted'
  | 'stale'

export interface MarkdownEditorCommandSession {
  readonly key: string
  readonly revision: number
  readonly documentId: string
  readonly epoch: number
  state: MarkdownEditorCommandPendingState
  abort: AbortController
}

export const createMarkdownEditorCommandSession = (
  key: string,
  context: MarkdownEditorCommandContext,
): MarkdownEditorCommandSession => ({
  key,
  revision: context.revision,
  documentId: context.documentIdentity.id,
  epoch: context.documentIdentity.epoch,
  state: 'pending',
  abort: new AbortController(),
})

export const resolveMarkdownEditorCommandSession = (
  session: MarkdownEditorCommandSession,
  context: MarkdownEditorCommandContext,
  outcome: 'resolved-current' | 'rejected' | 'aborted',
): MarkdownEditorCommandPendingState => {
  if (session.abort.signal.aborted) return 'aborted'
  if (
    session.revision !== context.revision ||
    session.documentId !== context.documentIdentity.id ||
    session.epoch !== context.documentIdentity.epoch
  ) {
    return 'stale'
  }
  session.state = outcome
  return outcome
}

export const evaluateMarkdownEditorCommandAsyncMutations = () =>
  Object.freeze({
    mutations: Object.freeze([
      Object.freeze({ kind: 'stale-commit' as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: 'uncancelled' as const, equivalent: false, accepted: false }),
    ]),
  })

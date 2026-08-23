import type { MarkdownEditorTransaction } from './markdown-editor-transaction'

export interface MarkdownLanguageToolCapability {
  readonly spellcheck: boolean
  readonly autocorrect: boolean
  readonly dictation: boolean
}

export const resolveMarkdownLanguageToolCapability = (
  input: Partial<MarkdownLanguageToolCapability> = {},
): MarkdownLanguageToolCapability =>
  Object.freeze({
    spellcheck: input.spellcheck ?? true,
    autocorrect: input.autocorrect ?? false,
    dictation: input.dictation ?? false,
  })

export const planMarkdownLanguageToolReplacement = (
  from: number,
  to: number,
  insert: string,
): MarkdownEditorTransaction => ({
  changes: [{ from, to, insert }],
  history: 'separate',
  origin: 'input',
})

export type MarkdownLanguageToolMutationKind =
  | 'second-input-pipeline'
  | 'dom-rewrite'

export const evaluateMarkdownLanguageToolMutations = () =>
  Object.freeze({
    mutations: Object.freeze([
      Object.freeze({
        kind: 'second-input-pipeline' as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: 'dom-rewrite' as const,
        equivalent: false,
        accepted: false,
      }),
    ]),
  })

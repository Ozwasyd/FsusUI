import type { MarkdownDocumentIdentity } from '../../../wasm/markdown-runtime'
import type { MarkdownLiveLayoutPlan } from './markdown-editor-live-layout'
import {
  commitMarkdownTechnicalPreview,
  markdownTechnicalUnsafeFragmentIndex,
  markdownTechnicalUnsafeFragmentRange,
  planMarkdownTechnicalPreview,
  type MarkdownTechnicalDiagnostic,
  type MarkdownTechnicalFeatureCommit,
  type MarkdownTechnicalFeatureRequest,
  type MarkdownTechnicalNodePlan,
  type MarkdownTechnicalNodeState,
  type MarkdownTechnicalPreviewAction,
  type MarkdownTechnicalPreviewInput,
  type MarkdownTechnicalPreviewPresentation,
  type MarkdownTechnicalPreviewVerdict,
} from './markdown-editor-technical'

export const MARKDOWN_LATEX_BUDGET = Object.freeze({
  maxBodyBytes: 8192,
  maxBodyLines: 80,
})

export type MarkdownLatexDisplay = 'inline' | 'block'

export type MarkdownLatexVerdict = MarkdownTechnicalPreviewVerdict
export type MarkdownLatexPreviewAction = MarkdownTechnicalPreviewAction
export type MarkdownLatexPresentation = MarkdownTechnicalPreviewPresentation

export interface MarkdownLatexClassification {
  readonly diagnosticCode: string | null
  readonly display: MarkdownLatexDisplay
  readonly range: Readonly<{ end: number; start: number }>
  readonly rewrite: false
  readonly wraps: boolean
  readonly verdict: MarkdownLatexVerdict
}

export interface MarkdownLatexPreviewPlan {
  readonly accessibility: {
    readonly kind: 'latex'
    readonly name: string
    readonly status: MarkdownTechnicalNodeState
    readonly tabStop: false
    readonly value: string
  }
  readonly action: MarkdownLatexPreviewAction
  readonly classification: MarkdownLatexClassification
  readonly diagnostic: MarkdownTechnicalDiagnostic | null
  readonly display: MarkdownLatexDisplay
  readonly editorCapability: 'supported'
  readonly height: MarkdownLiveLayoutPlan
  readonly node: MarkdownTechnicalNodePlan | null
  readonly presentation: MarkdownLatexPresentation
  readonly request: MarkdownTechnicalFeatureRequest | null
  readonly sourceUnchanged: true
  readonly wraps: boolean
}

export type MarkdownLatexMutationKind =
  | 'innerHTML'
  | 'regex-parse'
  | 'auto-rewrite'
  | 'whole-editor-failure'

const UNSAFE_FRAGMENTS = Object.freeze([
  '<script',
  'javascript:',
  'onerror=',
  'onclick=',
  '\\href{javascript',
  '\\input{',
  '\\write18',
  '\\special{',
])

const displayOf = (node: MarkdownTechnicalNodePlan, source: string): MarkdownLatexDisplay => {
  const opening = source.slice(node.ranges.opening.raw.start, node.ranges.opening.raw.end)
  if (opening.includes('$$') || opening.includes('\\[')) return 'block'
  return 'inline'
}

const latexClassification = (
  input: Pick<MarkdownLatexClassification, 'display' | 'range'>,
  wraps: boolean,
  verdict: MarkdownLatexVerdict,
  diagnosticCode: string | null,
  unsafeAt?: number,
): MarkdownLatexClassification =>
  Object.freeze({
    diagnosticCode,
    display: input.display,
    range:
      unsafeAt === undefined
        ? input.range
        : markdownTechnicalUnsafeFragmentRange(input, unsafeAt),
    rewrite: false,
    wraps,
    verdict,
  })

export const classifyMarkdownLatexBody = (input: {
  readonly body: string
  readonly display: MarkdownLatexDisplay
  readonly range: Readonly<{ end: number; start: number }>
}): MarkdownLatexClassification => {
  const wraps = input.display === 'inline'
  const trimmed = input.body.trim()
  if (!trimmed) {
    return latexClassification(input, wraps, 'invalid', 'empty-body')
  }
  const attack = markdownTechnicalUnsafeFragmentIndex(
    input.body,
    UNSAFE_FRAGMENTS,
  )
  if (attack >= 0) {
    return latexClassification(input, wraps, 'unsafe', 'unsafe-output', attack)
  }
  const lines = input.body.split(/\r\n|\n|\r/).length
  if (
    input.body.length > MARKDOWN_LATEX_BUDGET.maxBodyBytes ||
    lines > MARKDOWN_LATEX_BUDGET.maxBodyLines
  ) {
    return latexClassification(input, wraps, 'large', 'budget-exceeded')
  }
  let depth = 0
  for (const char of input.body) {
    if (char === '{') depth += 1
    if (char === '}') depth -= 1
    if (depth < 0) break
  }
  if (depth !== 0) {
    return latexClassification(input, wraps, 'invalid', 'unbalanced-braces')
  }
  return latexClassification(input, wraps, 'valid', null)
}

export const planMarkdownLatexPreview = (
  input: MarkdownTechnicalPreviewInput,
): MarkdownLatexPreviewPlan => {
  const { accessibility, action, classification, diagnostic, ...layout } =
    planMarkdownTechnicalPreview(
      'latex',
      input,
      (body, range, node) =>
        classifyMarkdownLatexBody({
          body,
          display: node ? displayOf(node, input.source) : 'block',
          range,
        }),
      ({ display }) => ({ ...input.config, display }),
    )
  return Object.freeze({
    accessibility,
    action,
    classification,
    diagnostic,
    display: classification.display,
    editorCapability: 'supported',
    ...layout,
    sourceUnchanged: true,
    wraps: classification.wraps,
  })
}

const payloadLooksUnsafe = (value: unknown) => {
  if (!value || typeof value !== 'object') return true
  const record = value as { kind?: string; payload?: string }
  if (record.kind !== 'latex' || typeof record.payload !== 'string') return true
  return (
    markdownTechnicalUnsafeFragmentIndex(record.payload, UNSAFE_FRAGMENTS) >= 0
  )
}

export const commitMarkdownLatexPreview = (input: {
  readonly aborted?: boolean
  readonly consumerHtml?: string
  readonly currentIdentity?: MarkdownDocumentIdentity
  readonly currentRevision?: number
  readonly documentIdentity?: MarkdownDocumentIdentity
  readonly innerHTML?: boolean
  readonly output?: unknown
  readonly plan: MarkdownLatexPreviewPlan
  readonly source: string
}): MarkdownTechnicalFeatureCommit & {
  readonly rewrite: false
} =>
  commitMarkdownTechnicalPreview(
    input,
    'consumerHtml',
    '<span class="katex"></span>',
    payloadLooksUnsafe,
  )

export const evaluateMarkdownLatexMutations = () => {
  const identity = Object.freeze({ epoch: 1, id: 'latex-doc' })
  const source = '$$\nx^2\n$$\n'
  const plan = planMarkdownLatexPreview({
    documentIdentity: identity,
    revision: 1,
    source,
  })
  const html = commitMarkdownLatexPreview({
    innerHTML: true,
    plan,
    source,
  })
  const regex = /\$\$[\s\S]*?\$\$/.exec(source)
  const failed = planMarkdownLatexPreview({
    documentIdentity: identity,
    source: '$$\n{\n$$\n',
  })
  return Object.freeze({
    authority: plan,
    mutations: Object.freeze([
      Object.freeze({
        accepted: html.accepted,
        detail: 'latex output must not accept consumer innerHTML or DOM',
        kind: 'innerHTML' as const,
      }),
      Object.freeze({
        accepted:
          !plan.node?.nodeId.startsWith('syn:') ||
          plan.node.nodeId === `regex:${regex?.index ?? -1}`,
        detail: 'latex nodes come from the projection, not a math regex',
        kind: 'regex-parse' as const,
      }),
      Object.freeze({
        accepted: failed.classification.rewrite || !failed.sourceUnchanged,
        detail: 'malformed latex must not rewrite source',
        kind: 'auto-rewrite' as const,
      }),
      Object.freeze({
        accepted: failed.editorCapability !== 'supported',
        detail: 'local latex failure must not degrade the whole editor',
        kind: 'whole-editor-failure' as const,
      }),
    ]),
  })
}

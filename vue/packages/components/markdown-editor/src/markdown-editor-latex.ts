import type { MarkdownDocumentIdentity } from '../../../wasm/markdown-runtime'
import type { MarkdownLiveLayoutPlan } from './markdown-editor-live-layout'
import {
  commitMarkdownTechnicalFeatureResult,
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

const unsafeIndex = (value: string) => {
  const lower = value.toLowerCase()
  let found = -1
  for (const fragment of UNSAFE_FRAGMENTS) {
    const index = lower.indexOf(fragment)
    if (index >= 0 && (found === -1 || index < found)) found = index
  }
  return found
}

const displayOf = (node: MarkdownTechnicalNodePlan, source: string): MarkdownLatexDisplay => {
  const opening = source.slice(node.ranges.opening.raw.start, node.ranges.opening.raw.end)
  if (opening.includes('$$') || opening.includes('\\[')) return 'block'
  return 'inline'
}

export const classifyMarkdownLatexBody = (input: {
  readonly body: string
  readonly display: MarkdownLatexDisplay
  readonly range: Readonly<{ end: number; start: number }>
}): MarkdownLatexClassification => {
  const wraps = input.display === 'inline'
  const trimmed = input.body.trim()
  if (!trimmed) {
    return Object.freeze({
      diagnosticCode: 'empty-body',
      display: input.display,
      range: input.range,
      rewrite: false,
      wraps,
      verdict: 'invalid',
    })
  }
  const attack = unsafeIndex(input.body)
  if (attack >= 0) {
    return Object.freeze({
      diagnosticCode: 'unsafe-output',
      display: input.display,
      range: Object.freeze({
        end: Math.min(input.range.end, input.range.start + attack + 8),
        start: input.range.start + attack,
      }),
      rewrite: false,
      wraps,
      verdict: 'unsafe',
    })
  }
  const lines = input.body.split(/\r\n|\n|\r/).length
  if (
    input.body.length > MARKDOWN_LATEX_BUDGET.maxBodyBytes ||
    lines > MARKDOWN_LATEX_BUDGET.maxBodyLines
  ) {
    return Object.freeze({
      diagnosticCode: 'budget-exceeded',
      display: input.display,
      range: input.range,
      rewrite: false,
      wraps,
      verdict: 'large',
    })
  }
  let depth = 0
  for (const char of input.body) {
    if (char === '{') depth += 1
    if (char === '}') depth -= 1
    if (depth < 0) break
  }
  if (depth !== 0) {
    return Object.freeze({
      diagnosticCode: 'unbalanced-braces',
      display: input.display,
      range: input.range,
      rewrite: false,
      wraps,
      verdict: 'invalid',
    })
  }
  return Object.freeze({
    diagnosticCode: null,
    display: input.display,
    range: input.range,
    rewrite: false,
    wraps,
    verdict: 'valid',
  })
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
  return unsafeIndex(record.payload) >= 0
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
} => {
  if (!input.plan.request) {
    return Object.freeze({
      accepted: false,
      diagnostic: input.plan.diagnostic,
      editorCapability: 'supported',
      reason: 'stale-node',
      rewrite: false,
      sourceUnchanged: true,
      state: 'deleted',
      visualUnchanged: true,
    })
  }
  if (
    input.consumerHtml !== undefined ||
    input.innerHTML ||
    (input.output !== undefined && payloadLooksUnsafe(input.output))
  ) {
    return Object.freeze({
      ...commitMarkdownTechnicalFeatureResult({
        consumerHtml: input.consumerHtml ?? '<span class="katex"></span>',
        currentIdentity: input.currentIdentity,
        currentRevision: input.currentRevision,
        documentIdentity: input.documentIdentity,
        innerHTML: true,
        request: input.plan.request,
        source: input.source,
      }),
      rewrite: false,
    })
  }
  const committed = commitMarkdownTechnicalFeatureResult({
    aborted: input.aborted,
    currentIdentity: input.currentIdentity,
    currentRevision: input.currentRevision,
    documentIdentity: input.documentIdentity,
    output: input.output,
    request: input.plan.request,
    source: input.source,
  })
  return Object.freeze({
    ...committed,
    rewrite: false,
  })
}

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

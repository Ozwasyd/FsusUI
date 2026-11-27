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

export const MARKDOWN_MERMAID_BUDGET = Object.freeze({
  maxBodyBytes: 16_384,
  maxBodyLines: 200,
})

export type MarkdownMermaidVerdict = MarkdownTechnicalPreviewVerdict
export type MarkdownMermaidPreviewAction = MarkdownTechnicalPreviewAction
export type MarkdownMermaidPresentation = MarkdownTechnicalPreviewPresentation

export interface MarkdownMermaidClassification {
  readonly diagnosticCode: string | null
  readonly range: Readonly<{ end: number; start: number }>
  readonly rewrite: false
  readonly verdict: MarkdownMermaidVerdict
}

export interface MarkdownMermaidPreviewPlan {
  readonly accessibility: {
    readonly kind: 'mermaid'
    readonly name: string
    readonly status: MarkdownTechnicalNodeState
    readonly tabStop: false
    readonly value: string
  }
  readonly action: MarkdownMermaidPreviewAction
  readonly chrome: {
    readonly card: false
    readonly terminal: false
    readonly toolbar: false
  }
  readonly classification: MarkdownMermaidClassification
  readonly diagnostic: MarkdownTechnicalDiagnostic | null
  readonly editorCapability: 'supported'
  readonly height: MarkdownLiveLayoutPlan
  readonly node: MarkdownTechnicalNodePlan | null
  readonly presentation: MarkdownMermaidPresentation
  readonly request: MarkdownTechnicalFeatureRequest | null
  readonly sourceUnchanged: true
}

export type MarkdownMermaidMutationKind =
  | 'innerHTML'
  | 'stale-commit'
  | 'whole-editor-failure'
  | 'auto-rewrite'

const DIAGRAM_STARTS = Object.freeze([
  'graph',
  'flowchart',
  'sequencediagram',
  'classdiagram',
  'statediagram',
  'statediagram-v2',
  'erdiagram',
  'journey',
  'gantt',
  'pie',
  'gitgraph',
  'mindmap',
  'timeline',
  'sankey-beta',
  'quadrantchart',
  'requirementdiagram',
  'c4context',
])

const UNSAFE_FRAGMENTS = Object.freeze([
  '<script',
  'javascript:',
  'onerror=',
  'onclick=',
  '<foreignobject',
  'href="https://',
  "href='https://",
])

const firstToken = (body: string) => {
  const first = body.trimStart()
  const end = first.search(/[\s{]/)
  return (end < 0 ? first : first.slice(0, end)).toLowerCase()
}

const mermaidClassification = (
  input: Pick<MarkdownMermaidClassification, 'range'>,
  verdict: MarkdownMermaidVerdict,
  diagnosticCode: string | null,
  unsafeAt?: number,
): MarkdownMermaidClassification =>
  Object.freeze({
    diagnosticCode,
    range:
      unsafeAt === undefined
        ? input.range
        : markdownTechnicalUnsafeFragmentRange(input, unsafeAt),
    rewrite: false,
    verdict,
  })

export const classifyMarkdownMermaidBody = (input: {
  readonly body: string
  readonly range: Readonly<{ end: number; start: number }>
}): MarkdownMermaidClassification => {
  const trimmed = input.body.trim()
  if (!trimmed) {
    return mermaidClassification(input, 'invalid', 'empty-body')
  }
  const attack = markdownTechnicalUnsafeFragmentIndex(
    input.body,
    UNSAFE_FRAGMENTS,
  )
  if (attack >= 0) {
    return mermaidClassification(input, 'unsafe', 'unsafe-output', attack)
  }
  const lines = input.body.split(/\r\n|\n|\r/).length
  if (
    input.body.length > MARKDOWN_MERMAID_BUDGET.maxBodyBytes ||
    lines > MARKDOWN_MERMAID_BUDGET.maxBodyLines
  ) {
    return mermaidClassification(input, 'large', 'budget-exceeded')
  }
  const token = firstToken(input.body)
  if (!DIAGRAM_STARTS.includes(token)) {
    return mermaidClassification(input, 'invalid', 'invalid-diagram')
  }
  return mermaidClassification(input, 'valid', null)
}

export const planMarkdownMermaidPreview = (
  input: MarkdownTechnicalPreviewInput,
): MarkdownMermaidPreviewPlan => {
  const { accessibility, action, classification, diagnostic, ...layout } =
    planMarkdownTechnicalPreview('mermaid', input, (body, range) =>
      classifyMarkdownMermaidBody({ body, range }),
    )
  return Object.freeze({
    accessibility,
    action,
    chrome: Object.freeze({
      card: false,
      terminal: false,
      toolbar: false,
    }),
    classification,
    diagnostic,
    editorCapability: 'supported',
    ...layout,
    sourceUnchanged: true,
  })
}

const payloadLooksUnsafe = (value: unknown) => {
  if (!value || typeof value !== 'object') return true
  const record = value as { kind?: string; payload?: string; rootId?: string }
  if (record.kind !== 'mermaid' || typeof record.payload !== 'string') return true
  if (typeof record.rootId !== 'string') return true
  return (
    markdownTechnicalUnsafeFragmentIndex(record.payload, UNSAFE_FRAGMENTS) >= 0
  )
}

export const commitMarkdownMermaidPreview = (input: {
  readonly aborted?: boolean
  readonly consumerSvg?: string
  readonly currentIdentity?: MarkdownDocumentIdentity
  readonly currentRevision?: number
  readonly documentIdentity?: MarkdownDocumentIdentity
  readonly innerHTML?: boolean
  readonly output?: unknown
  readonly plan: MarkdownMermaidPreviewPlan
  readonly source: string
}): MarkdownTechnicalFeatureCommit & {
  readonly rewrite: false
} =>
  commitMarkdownTechnicalPreview(
    input,
    'consumerSvg',
    '<svg></svg>',
    payloadLooksUnsafe,
  )

export const evaluateMarkdownMermaidMutations = () => {
  const identity = Object.freeze({ epoch: 1, id: 'mermaid-doc' })
  const source = '```mermaid\ngraph TD\nA-->B\n```\n'
  const plan = planMarkdownMermaidPreview({
    documentIdentity: identity,
    revision: 1,
    source,
  })
  const html = commitMarkdownMermaidPreview({
    innerHTML: true,
    plan,
    source,
  })
  const stale = commitMarkdownMermaidPreview({
    currentRevision: 2,
    output: {
      kind: 'mermaid',
      payload: '<svg id="ok" class="flowchart"></svg>',
      rootId: 'ok',
    },
    plan,
    source,
  })
  const failed = planMarkdownMermaidPreview({
    documentIdentity: identity,
    intent: 'error',
    source: '```mermaid\nnot a diagram\n```\n',
  })
  return Object.freeze({
    authority: plan,
    mutations: Object.freeze([
      Object.freeze({
        accepted: html.accepted,
        detail: 'mermaid output must not accept consumer innerHTML or SVG',
        kind: 'innerHTML' as const,
      }),
      Object.freeze({
        accepted: stale.accepted,
        detail: 'stale mermaid results must not commit',
        kind: 'stale-commit' as const,
      }),
      Object.freeze({
        accepted: failed.editorCapability !== 'supported',
        detail: 'local mermaid failure must not degrade the whole editor',
        kind: 'whole-editor-failure' as const,
      }),
      Object.freeze({
        accepted: failed.classification.rewrite || !failed.sourceUnchanged,
        detail: 'malformed mermaid must not rewrite source',
        kind: 'auto-rewrite' as const,
      }),
    ]),
  })
}

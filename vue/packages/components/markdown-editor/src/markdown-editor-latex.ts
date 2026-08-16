import type { MarkdownDocumentIdentity } from '../../../wasm/markdown-runtime'
import type { MarkdownEditorMode } from './markdown-editor-live-contract'
import type { MarkdownLiveLayoutPlan } from './markdown-editor-live-layout'
import {
  commitMarkdownTechnicalFeatureResult,
  createMarkdownTechnicalFeatureRequest,
  resolveMarkdownTechnicalAtomic,
  resolveMarkdownTechnicalDiagnostic,
  resolveMarkdownTechnicalHeight,
  resolveMarkdownTechnicalNode,
  type MarkdownTechnicalDiagnostic,
  type MarkdownTechnicalFeatureCommit,
  type MarkdownTechnicalFeatureRequest,
  type MarkdownTechnicalNodePlan,
  type MarkdownTechnicalNodeState,
} from './markdown-editor-technical'
import type { MarkdownEditorSelection } from './markdown-editor-transaction'

export const MARKDOWN_LATEX_BUDGET = Object.freeze({
  maxBodyBytes: 8192,
  maxBodyLines: 80,
})

export type MarkdownLatexDisplay = 'inline' | 'block'

export type MarkdownLatexVerdict = 'valid' | 'invalid' | 'large' | 'unsafe'

export type MarkdownLatexPreviewAction =
  | 'pending'
  | 'preview'
  | 'error'
  | 'retry'
  | 'cancel'
  | 'source-reveal'
  | 'degraded'

export type MarkdownLatexPresentation = 'preview' | 'source-only' | 'degraded'

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

const selectionOf = (start: number, end = start): MarkdownEditorSelection =>
  Object.freeze({
    direction: start === end ? ('none' as const) : ('forward' as const),
    end,
    start,
  })

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

const presentationOf = (
  verdict: MarkdownLatexVerdict,
  action: MarkdownLatexPreviewAction,
): MarkdownLatexPresentation => {
  if (action === 'preview' && verdict === 'valid') return 'preview'
  if (verdict === 'large' || action === 'degraded') return 'degraded'
  return 'source-only'
}

const actionFor = (
  intent: MarkdownLatexPreviewAction | undefined,
  verdict: MarkdownLatexVerdict,
): MarkdownLatexPreviewAction => {
  if (intent === 'retry') return 'pending'
  if (intent === 'cancel') return 'cancel'
  if (intent === 'source-reveal') return 'source-reveal'
  if (verdict === 'valid') return intent ?? 'pending'
  if (verdict === 'large') return 'degraded'
  return 'error'
}

export const planMarkdownLatexPreview = (input: {
  readonly abortSignal?: AbortSignal | null
  readonly config?: Readonly<Record<string, unknown>>
  readonly documentIdentity?: MarkdownDocumentIdentity
  readonly intent?: MarkdownLatexPreviewAction
  readonly mode?: MarkdownEditorMode
  readonly nodeId?: string
  readonly revision?: number
  readonly selection?: MarkdownEditorSelection
  readonly source: string
  readonly theme?: string | null
}): MarkdownLatexPreviewPlan => {
  const identity = input.documentIdentity ?? { epoch: 0, id: 'latex' }
  const node = resolveMarkdownTechnicalNode({
    documentIdentity: identity,
    kind: 'latex',
    nodeId: input.nodeId,
    revision: input.revision,
    selection: input.selection,
    source: input.source,
  })
  const display = node ? displayOf(node, input.source) : 'block'
  const body = node
    ? input.source.slice(node.ranges.body.raw.start, node.ranges.body.raw.end)
    : ''
  const classification = classifyMarkdownLatexBody({
    body,
    display,
    range: node?.ranges.body.raw ?? { end: 0, start: 0 },
  })
  const action = actionFor(input.intent, classification.verdict)
  const request =
    node && action !== 'cancel'
      ? createMarkdownTechnicalFeatureRequest({
          abortSignal: input.abortSignal,
          config: { ...input.config, display },
          documentIdentity: identity,
          kind: 'latex',
          mode: input.mode,
          nodeId: node.nodeId,
          revision: input.revision,
          source: input.source,
          theme: input.theme,
        })
      : null
  const diagnostic =
    classification.verdict === 'valid'
      ? null
      : resolveMarkdownTechnicalDiagnostic({
          code: classification.diagnosticCode ?? 'technical-error',
          documentIdentity: identity,
          kind: 'latex',
          nodeId: node?.nodeId,
          selection: selectionOf(classification.range.start),
          source: input.source,
        })
  const atomic = resolveMarkdownTechnicalAtomic({
    action: action === 'source-reveal' ? 'enter-source' : 'caret-before',
    documentIdentity: identity,
    kind: 'latex',
    mode: input.mode,
    nodeId: node?.nodeId,
    revision: input.revision,
    selection: input.selection ?? selectionOf(node?.rawRange.start ?? 0),
    source: input.source,
  })
  const height = resolveMarkdownTechnicalHeight({
    documentIdentity: identity,
    kind: 'latex',
    revision: input.revision,
    selection: input.selection ?? selectionOf(node?.rawRange.start ?? 0),
    source: input.source,
  })
  const status: MarkdownTechnicalNodeState =
    action === 'pending'
      ? 'pending'
      : action === 'preview'
        ? 'resolved'
        : action === 'degraded'
          ? 'degraded'
          : action === 'cancel'
            ? 'error'
            : 'error'
  return Object.freeze({
    accessibility: Object.freeze({
      kind: 'latex' as const,
      name: atomic.accessibility.name,
      status,
      tabStop: false,
      value: diagnostic?.message ?? atomic.accessibility.value,
    }),
    action,
    classification,
    diagnostic,
    display,
    editorCapability: 'supported',
    height,
    node,
    presentation: presentationOf(classification.verdict, action),
    request,
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

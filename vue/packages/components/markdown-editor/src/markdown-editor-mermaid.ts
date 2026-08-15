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

export const MARKDOWN_MERMAID_BUDGET = Object.freeze({
  maxBodyBytes: 16_384,
  maxBodyLines: 200,
})

export type MarkdownMermaidVerdict = 'valid' | 'invalid' | 'large' | 'unsafe'

export type MarkdownMermaidPreviewAction =
  | 'pending'
  | 'preview'
  | 'error'
  | 'retry'
  | 'cancel'
  | 'source-reveal'
  | 'degraded'

export type MarkdownMermaidPresentation = 'preview' | 'source-only' | 'degraded'

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

const selectionOf = (start: number, end = start): MarkdownEditorSelection =>
  Object.freeze({
    direction: start === end ? ('none' as const) : ('forward' as const),
    end,
    start,
  })

const firstToken = (body: string) => {
  const line = body
    .split(/\r\n|\n|\r/)
    .map((item) => item.trim())
    .find((item) => item.length > 0)
  if (!line) return ''
  return line.split(/[\s{]/, 1)[0]!.toLowerCase()
}

const unsafeIndex = (value: string) => {
  const lower = value.toLowerCase()
  let found = -1
  for (const fragment of UNSAFE_FRAGMENTS) {
    const index = lower.indexOf(fragment)
    if (index >= 0 && (found === -1 || index < found)) found = index
  }
  return found
}

export const classifyMarkdownMermaidBody = (input: {
  readonly body: string
  readonly range: Readonly<{ end: number; start: number }>
}): MarkdownMermaidClassification => {
  const trimmed = input.body.trim()
  if (!trimmed) {
    return Object.freeze({
      diagnosticCode: 'empty-body',
      range: input.range,
      rewrite: false,
      verdict: 'invalid',
    })
  }
  const attack = unsafeIndex(input.body)
  if (attack >= 0) {
    return Object.freeze({
      diagnosticCode: 'unsafe-output',
      range: Object.freeze({
        end: Math.min(input.range.end, input.range.start + attack + 8),
        start: input.range.start + attack,
      }),
      rewrite: false,
      verdict: 'unsafe',
    })
  }
  const lines = input.body.split(/\r\n|\n|\r/).length
  if (
    input.body.length > MARKDOWN_MERMAID_BUDGET.maxBodyBytes ||
    lines > MARKDOWN_MERMAID_BUDGET.maxBodyLines
  ) {
    return Object.freeze({
      diagnosticCode: 'budget-exceeded',
      range: input.range,
      rewrite: false,
      verdict: 'large',
    })
  }
  const token = firstToken(input.body)
  if (!DIAGRAM_STARTS.includes(token)) {
    return Object.freeze({
      diagnosticCode: 'invalid-diagram',
      range: input.range,
      rewrite: false,
      verdict: 'invalid',
    })
  }
  return Object.freeze({
    diagnosticCode: null,
    range: input.range,
    rewrite: false,
    verdict: 'valid',
  })
}

const presentationOf = (
  verdict: MarkdownMermaidVerdict,
  action: MarkdownMermaidPreviewAction,
): MarkdownMermaidPresentation => {
  if (action === 'preview' && verdict === 'valid') return 'preview'
  if (verdict === 'large' || action === 'degraded') return 'degraded'
  return 'source-only'
}

const actionFor = (
  intent: MarkdownMermaidPreviewAction | undefined,
  verdict: MarkdownMermaidVerdict,
): MarkdownMermaidPreviewAction => {
  if (intent === 'retry') return 'pending'
  if (intent === 'cancel') return 'cancel'
  if (intent === 'source-reveal') return 'source-reveal'
  if (verdict === 'valid') return intent ?? 'pending'
  if (verdict === 'large') return 'degraded'
  return 'error'
}

export const planMarkdownMermaidPreview = (input: {
  readonly abortSignal?: AbortSignal | null
  readonly config?: Readonly<Record<string, unknown>>
  readonly documentIdentity?: MarkdownDocumentIdentity
  readonly intent?: MarkdownMermaidPreviewAction
  readonly mode?: MarkdownEditorMode
  readonly nodeId?: string
  readonly revision?: number
  readonly selection?: MarkdownEditorSelection
  readonly source: string
  readonly theme?: string | null
}): MarkdownMermaidPreviewPlan => {
  const identity = input.documentIdentity ?? { epoch: 0, id: 'mermaid' }
  const node = resolveMarkdownTechnicalNode({
    documentIdentity: identity,
    kind: 'mermaid',
    nodeId: input.nodeId,
    revision: input.revision,
    selection: input.selection,
    source: input.source,
  })
  const body = node
    ? input.source.slice(node.ranges.body.raw.start, node.ranges.body.raw.end)
    : ''
  const classification = classifyMarkdownMermaidBody({
    body,
    range: node?.ranges.body.raw ?? { end: 0, start: 0 },
  })
  const action = actionFor(input.intent, classification.verdict)
  const request =
    node && action !== 'cancel'
      ? createMarkdownTechnicalFeatureRequest({
          abortSignal: input.abortSignal,
          config: input.config,
          documentIdentity: identity,
          kind: 'mermaid',
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
          kind: 'mermaid',
          nodeId: node?.nodeId,
          selection: selectionOf(classification.range.start),
          source: input.source,
        })
  const atomic = resolveMarkdownTechnicalAtomic({
    action: action === 'source-reveal' ? 'enter-source' : 'caret-before',
    documentIdentity: identity,
    kind: 'mermaid',
    mode: input.mode,
    nodeId: node?.nodeId,
    revision: input.revision,
    selection: input.selection ?? selectionOf(node?.rawRange.start ?? 0),
    source: input.source,
  })
  const height = resolveMarkdownTechnicalHeight({
    documentIdentity: identity,
    kind: 'mermaid',
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
      kind: 'mermaid' as const,
      name: atomic.accessibility.name,
      status,
      tabStop: false,
      value: diagnostic?.message ?? atomic.accessibility.value,
    }),
    action,
    chrome: Object.freeze({
      card: false,
      terminal: false,
      toolbar: false,
    }),
    classification,
    diagnostic,
    editorCapability: 'supported',
    height,
    node,
    presentation: presentationOf(classification.verdict, action),
    request,
    sourceUnchanged: true,
  })
}

const payloadLooksUnsafe = (value: unknown) => {
  if (!value || typeof value !== 'object') return true
  const record = value as { kind?: string; payload?: string; rootId?: string }
  if (record.kind !== 'mermaid' || typeof record.payload !== 'string') return true
  if (typeof record.rootId !== 'string') return true
  return unsafeIndex(record.payload) >= 0
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
    input.consumerSvg !== undefined ||
    input.innerHTML ||
    (input.output !== undefined && payloadLooksUnsafe(input.output))
  ) {
    return Object.freeze({
      ...commitMarkdownTechnicalFeatureResult({
        consumerHtml: input.consumerSvg ?? '<svg></svg>',
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
    innerHTML: input.innerHTML,
    output: input.output,
    request: input.plan.request,
    source: input.source,
  })
  return Object.freeze({
    ...committed,
    rewrite: false,
  })
}

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
        accepted: failed.classification.rewrite === true || !failed.sourceUnchanged,
        detail: 'malformed mermaid must not rewrite source',
        kind: 'auto-rewrite' as const,
      }),
    ]),
  })
}

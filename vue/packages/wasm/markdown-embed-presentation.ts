import type { MarkdownEmbedBudgetFailure } from './markdown-embed-budget'
import {
  formatMarkdownEmbedDirective,
  type MarkdownEmbedMode,
  type MarkdownEmbedValidNode,
} from './markdown-embed-directive'
import {
  commitMarkdownEmbedResult,
  readMarkdownEmbedProjection,
  type MarkdownEmbedRequest,
  type MarkdownEmbedProviderStatus,
  type MarkdownEmbedResult,
} from './markdown-embed-provider'

export const MARKDOWN_EMBED_PRESENTATION_VERSION =
  'markdown-embed-presentation@2026-08-28'

export const MARKDOWN_EMBED_PRESENTATION_MODES = Object.freeze([
  'source',
  'live',
  'split',
  'preview',
] as const)

export type MarkdownEmbedPresentationMode =
  (typeof MARKDOWN_EMBED_PRESENTATION_MODES)[number]

export type MarkdownEmbedPresentationState =
  | 'pending'
  | 'resolved'
  | 'error'
  | 'stale'
  | 'forbidden'
  | 'unsupported'

export type MarkdownEmbedLocalFailure =
  | MarkdownEmbedBudgetFailure
  | 'mode-mismatch'
  | 'invalid-directive'

const BUDGET_FAILURE_STATES: Readonly<
  Record<MarkdownEmbedBudgetFailure, MarkdownEmbedPresentationState>
> = Object.freeze({
  cycle: 'error',
  'depth-exceeded': 'error',
  'node-exceeded': 'error',
  'size-exceeded': 'error',
  'time-exceeded': 'error',
  'concurrency-exceeded': 'error',
  cancelled: 'stale',
  stale: 'stale',
})

const PROVIDER_STATUS_STATES: Readonly<
  Record<MarkdownEmbedProviderStatus, MarkdownEmbedPresentationState>
> = Object.freeze({
  idle: 'pending',
  pending: 'pending',
  resolved: 'resolved',
  rejected: 'error',
  stale: 'stale',
  forbidden: 'forbidden',
  missing: 'error',
  deleted: 'error',
  unsupported: 'unsupported',
  cancelled: 'stale',
  cycle: 'error',
  'depth-exceeded': 'error',
  'size-exceeded': 'error',
  'time-exceeded': 'error',
  'mode-mismatch': 'unsupported',
})

export interface MarkdownEmbedPresentationActions {
  readonly openSource: true
  readonly retry: boolean
}

export interface MarkdownEmbedPresentationAccessibility {
  readonly name: string
  readonly openSourceOperation: 'enter-source'
  readonly role: 'figure'
  readonly status: MarkdownEmbedPresentationState
  readonly statusDescription: string
  readonly tabStop: false
}

export interface MarkdownEmbedPresentationContent {
  readonly editable: false
  readonly excerpt: string | null
  readonly markdown: string | null
  readonly html: null
  readonly renderVia: 'markdown-runtime'
  readonly title: string | null
}

export interface MarkdownEmbedPresentationLayout {
  readonly columns: 1
  readonly modeAsVisualVariant: false
  readonly nestedScroll: 'none'
  readonly surface: 'controlled-markdown'
}

export interface MarkdownEmbedPresentation {
  readonly accessibility: MarkdownEmbedPresentationAccessibility
  readonly actions: MarkdownEmbedPresentationActions
  readonly content: MarkdownEmbedPresentationContent
  readonly directive: string
  readonly embedMode: MarkdownEmbedMode
  readonly layout: MarkdownEmbedPresentationLayout
  readonly mode: MarkdownEmbedPresentationMode
  readonly state: MarkdownEmbedPresentationState
  readonly target: string
  readonly version: typeof MARKDOWN_EMBED_PRESENTATION_VERSION
}

export type MarkdownEmbedPresentationInput = Readonly<
  | {
      readonly kind: 'valid'
      readonly node: MarkdownEmbedValidNode
      readonly result?: MarkdownEmbedResult | null
      readonly request?: MarkdownEmbedRequest
    }
  | {
      readonly kind: 'provider-status'
      readonly status: MarkdownEmbedProviderStatus
      readonly target: string
      readonly embedMode: MarkdownEmbedMode
      readonly directive: string
    }
  | {
      readonly kind: 'local-failure'
      readonly failure: MarkdownEmbedLocalFailure
      readonly target: string
      readonly embedMode: MarkdownEmbedMode
      readonly directive: string
    }
>

const stateOfInput = (
  input: MarkdownEmbedPresentationInput,
): MarkdownEmbedPresentationState => {
  if (input.kind === 'valid') {
    return input.result
      ? PROVIDER_STATUS_STATES[input.result.status]
      : 'pending'
  }
  if (input.kind === 'provider-status') {
    return PROVIDER_STATUS_STATES[input.status]
  }
  if (
    input.failure === 'mode-mismatch' ||
    input.failure === 'invalid-directive'
  ) {
    return 'unsupported'
  }
  return BUDGET_FAILURE_STATES[input.failure]
}

const statusDescriptionOf = (
  input: MarkdownEmbedPresentationInput,
  state: MarkdownEmbedPresentationState,
): string => {
  if (input.kind === 'local-failure') {
    return `embed ${state}: ${input.failure}`
  }
  const status = input.kind === 'valid' ? input.result?.status : input.status
  if (status === 'forbidden') {
    return 'embed forbidden: target not allowed'
  }
  if (status === 'rejected') {
    return 'embed error: target missing or deleted'
  }
  if (status === 'missing' || status === 'deleted') {
    return `embed error: target ${status}`
  }
  if (status === 'unsupported' || status === 'mode-mismatch') {
    return `embed unsupported: ${status}`
  }
  if (status === 'cancelled') {
    return 'embed stale: cancelled'
  }
  if (status === 'stale') {
    return 'embed stale: result older than request'
  }
  return `embed ${state}`
}

const resolvedFields = (input: MarkdownEmbedPresentationInput) =>
  input.kind === 'valid' && input.result?.status === 'resolved'
    ? {
        excerpt: input.result.excerpt ?? null,
        title: input.result.title ?? null,
      }
    : { excerpt: null, title: null }

export const resolveMarkdownEmbedPresentation = (
  input: MarkdownEmbedPresentationInput,
  mode: MarkdownEmbedPresentationMode,
): MarkdownEmbedPresentation => {
  const result = input.kind === 'valid' ? input.result : null
  const controlled = Boolean(result?.projection || result?.targetVersion)
  const checked =
    input.kind === 'valid' && input.request && result
      ? commitMarkdownEmbedResult(input.request, result)
      : result
  const matchesNode =
    input.kind !== 'valid' ||
    !result ||
    (result.target === input.node.target && result.mode === input.node.mode)
  const markdown =
    controlled &&
    input.kind === 'valid' &&
    input.request &&
    checked?.status === 'resolved' &&
    matchesNode
      ? readMarkdownEmbedProjection(checked)
      : null
  const state =
    !matchesNode || (controlled && markdown === null)
      ? checked?.status === 'rejected'
        ? 'error'
        : 'stale'
      : stateOfInput(input)

  const target = input.kind === 'valid' ? input.node.target : input.target
  const embedMode = input.kind === 'valid' ? input.node.mode : input.embedMode
  const directive =
    input.kind === 'valid'
      ? formatMarkdownEmbedDirective(target, embedMode)
      : input.directive
  const resolved =
    state === 'resolved'
      ? resolvedFields(input)
      : { excerpt: null, title: null }
  const statusDescription = statusDescriptionOf(input, state)

  return Object.freeze({
    accessibility: Object.freeze({
      name: `embedded ${embedMode} ${target}`,
      openSourceOperation: 'enter-source' as const,
      role: 'figure' as const,
      status: state,
      statusDescription,
      tabStop: false as const,
    }),
    actions: Object.freeze({
      openSource: true as const,
      retry: state === 'error' || state === 'stale' || state === 'forbidden',
    }),
    content: Object.freeze({
      editable: false as const,
      excerpt: controlled ? null : resolved.excerpt,
      markdown,
      html: null,
      renderVia: 'markdown-runtime' as const,
      title: resolved.title,
    }),
    directive,
    embedMode,
    layout: Object.freeze({
      columns: 1 as const,
      modeAsVisualVariant: false as const,
      nestedScroll: 'none' as const,
      surface: 'controlled-markdown' as const,
    }),
    mode,
    state,
    target,
    version: MARKDOWN_EMBED_PRESENTATION_VERSION,
  })
}

export interface LegacyMarkdownEmbedPresentation {
  readonly visible: boolean
  readonly title: string | null
  readonly mode: MarkdownEmbedMode
  readonly status: MarkdownEmbedProviderStatus
  readonly card: false
  readonly hasNestedScroll: false
  readonly tabStop: false
  readonly actions: readonly (
    | 'source-reveal'
    | 'open-source'
    | 'retry'
    | 'copy'
  )[]
  readonly excerpt: string
  readonly error?: true
}

export const sanitizeEmbedExcerpt = (excerpt?: string): string => {
  if (!excerpt) return ''
  return excerpt
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/javascript:[^\s"'>]+/gi, '')
    .trim()
}

export const presentMarkdownEmbed = (
  result: MarkdownEmbedResult,
): LegacyMarkdownEmbedPresentation => {
  const state = PROVIDER_STATUS_STATES[result.status]
  const excerpt = sanitizeEmbedExcerpt(result.excerpt)
  return Object.freeze({
    visible: true,
    title: result.title ?? result.target,
    mode: result.mode,
    status: result.status,
    card: false as const,
    hasNestedScroll: false as const,
    tabStop: false as const,
    actions:
      state === 'error' || state === 'stale' || state === 'forbidden'
        ? (['source-reveal', 'retry', 'open-source', 'copy'] as const)
        : (['source-reveal', 'open-source', 'copy'] as const),
    excerpt,
    error:
      state === 'error' || state === 'stale' || state === 'forbidden'
        ? (true as const)
        : undefined,
  })
}

export type MarkdownEmbedPresentationMutationKind =
  | 'iframe'
  | 'second-editor'
  | 'innerHTML'
  | 'mode-card'
  | 'source-expansion'

export interface MarkdownEmbedPresentationMutationResult {
  readonly kind: MarkdownEmbedPresentationMutationKind
  readonly equivalent: boolean
  readonly accepted: boolean
}

const mutationResult = (
  target: string,
  mode: MarkdownEmbedMode,
  excerpt = 'Resolved **excerpt** body.\n',
): MarkdownEmbedResult =>
  Object.freeze({
    requestId: `${target}:1:n1:1`,
    status: 'resolved',
    target,
    mode,
    version: 1,
    documentIdentity: Object.freeze({ epoch: 1, id: 'mutation-doc' }),
    revision: 1,
    nodeId: 'n1',
    title: `${target} title`,
    excerpt,
  })

const mutationNode = (
  target: string,
  mode: MarkdownEmbedMode,
): MarkdownEmbedValidNode =>
  Object.freeze({
    ok: true,
    kind: 'embed',
    target,
    mode,
    ranges: Object.freeze({
      full: Object.freeze({ start: 0, end: 42 }),
      marker: Object.freeze({ start: 0, end: 7 }),
      target: Object.freeze({ start: 15, end: 15 + target.length }),
      mode: Object.freeze({
        start: 16 + target.length + 7,
        end: 22 + target.length + 7,
      }),
    }),
  })

export const evaluateMarkdownEmbedPresentationMutations = (): Readonly<{
  mutations: readonly MarkdownEmbedPresentationMutationResult[]
}> => {
  const presentation = resolveMarkdownEmbedPresentation(
    {
      kind: 'valid',
      node: mutationNode('mutation-target', 'article'),
      result: mutationResult('mutation-target', 'article'),
    },
    'live',
  )

  const signatureOf = (mode: MarkdownEmbedMode) => {
    const each = resolveMarkdownEmbedPresentation(
      {
        kind: 'valid',
        node: mutationNode('mutation-target', mode),
        result: mutationResult('mutation-target', mode),
      },
      'live',
    )
    return JSON.stringify({
      actions: each.actions,
      content: each.content,
      layout: each.layout,
    })
  }
  const modeCard =
    signatureOf('article') !== signatureOf('heading') ||
    signatureOf('article') !== signatureOf('block') ||
    presentation.layout.modeAsVisualVariant !== false

  const providerExcerpt = (
    mutationResult('mutation-target', 'article').excerpt ?? ''
  ).trim()
  const sourceExpansion = presentation.directive.includes(providerExcerpt)

  return Object.freeze({
    mutations: Object.freeze([
      Object.freeze({
        kind: 'iframe' as const,
        equivalent: presentation.layout.surface !== 'controlled-markdown',
        accepted: false,
      }),
      Object.freeze({
        kind: 'second-editor' as const,
        equivalent: presentation.content.editable !== false,
        accepted: false,
      }),
      Object.freeze({
        kind: 'innerHTML' as const,
        equivalent: presentation.content.html !== null,
        accepted: false,
      }),
      Object.freeze({
        kind: 'mode-card' as const,
        equivalent: modeCard,
        accepted: false,
      }),
      Object.freeze({
        kind: 'source-expansion' as const,
        equivalent: sourceExpansion,
        accepted: false,
      }),
    ]),
  })
}

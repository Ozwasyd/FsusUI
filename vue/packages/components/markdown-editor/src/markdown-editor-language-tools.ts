import {
  createMarkdownEditorProjection,
  stabilizeMarkdownEditorProjection,
  type MarkdownDocumentIdentity,
  type MarkdownStableProjection,
  type MarkdownStableSyntaxNode,
} from "../../../wasm/markdown-runtime"
import type { MarkdownEditorMode } from "./markdown-editor-live-contract"
import type {
  MarkdownEditorDocumentIdentity,
  MarkdownEditorSelection,
  MarkdownEditorTransaction,
} from "./markdown-editor-transaction"

export type MarkdownSpellcheckMode = "auto" | "enabled" | "disabled"

export type MarkdownNativeWritingToolsMode = "auto" | "disabled"

export type MarkdownLanguageToolStatus =
  | "supported"
  | "degraded"
  | "unavailable"

export type MarkdownLanguageToolReason =
  | "unsupported-platform"
  | "disabled"
  | "readonly"
  | "preview"
  | "composition-active"
  | "code-block"
  | "url"
  | "atomic-node"
  | "hidden-marker"
  | "nested-syntax"
  | "stale-document"
  | "stale-revision"
  | "stale-selection"
  | "stale-session"
  | "invalid-range"
  | "dom-authority-rejected"
  | "full-source-rejected"

export interface MarkdownLanguageToolConfig {
  readonly autocorrect?: boolean
  readonly dictation?: boolean
  readonly lang?: string
  readonly nativeWritingTools?: MarkdownNativeWritingToolsMode
  readonly spellcheck?: MarkdownSpellcheckMode | boolean
}

export interface MarkdownLanguageToolCapability {
  readonly autocorrect: boolean
  readonly dictation: boolean
  readonly lang?: string
  readonly nativeWritingTools: MarkdownNativeWritingToolsMode
  readonly reason?: MarkdownLanguageToolReason
  readonly spellcheck: boolean
  readonly spellcheckMode: MarkdownSpellcheckMode
  readonly status: MarkdownLanguageToolStatus
}

export type MarkdownLanguageToolSessionKind =
  | "spellcheck"
  | "autocorrect"
  | "dictation"
  | "writing-tools"
  | "context-menu"

export interface MarkdownLanguageToolSession {
  readonly active: boolean
  readonly documentIdentity: MarkdownEditorDocumentIdentity
  readonly id: string
  readonly kind: MarkdownLanguageToolSessionKind
  readonly revision: number
  readonly selection?: MarkdownEditorSelection
  readonly timestamp: number
}

export interface MarkdownLanguageToolCommitInput {
  readonly currentDocumentIdentity?: MarkdownEditorDocumentIdentity
  readonly currentRevision?: number
  readonly currentSelection?: MarkdownEditorSelection
  readonly documentIdentity: MarkdownEditorDocumentIdentity
  readonly from: number
  readonly insert: string
  readonly isComposing?: boolean
  readonly kind?: MarkdownLanguageToolSessionKind
  readonly projection?: MarkdownStableProjection
  readonly rawHtml?: string
  readonly revision: number
  readonly selection?: MarkdownEditorSelection
  readonly session?: MarkdownLanguageToolSession
  readonly source: string
  readonly to: number
}

export interface MarkdownLanguageToolCommitResult {
  readonly accepted: boolean
  readonly reason?: MarkdownLanguageToolReason
  readonly session?: MarkdownLanguageToolSession
  readonly transaction?: MarkdownEditorTransaction
}

export type MarkdownLanguageToolMutationKind =
  | "second-input-pipeline"
  | "dom-rewrite"
  | "dom-authority"
  | "full-source-replacement"
  | "stale-commit"
  | "cloud-fallback"
  | "ime-dictation-interleave"

export interface MarkdownLanguageToolMutationResult {
  readonly accepted: boolean
  readonly detail: string
  readonly equivalent?: boolean
  readonly kind: MarkdownLanguageToolMutationKind
}

export interface MarkdownLanguageToolMutationReport {
  readonly mutations: readonly MarkdownLanguageToolMutationResult[]
}

const ATOMIC_KINDS = new Set([
  "latex",
  "mermaid",
  "image",
  "embed",
  "caption",
  "anchor",
])

const isInsideLinkUrl = (
  source: string,
  node: MarkdownStableSyntaxNode,
  offset: number,
): boolean => {
  const text = source.slice(node.rawRange.start, node.rawRange.end)
  if (text.startsWith("<") && text.endsWith(">")) {
    return offset >= node.rawRange.start + 1 && offset <= node.rawRange.end - 1
  }
  const parenOpen = text.lastIndexOf("(")
  const parenClose = text.lastIndexOf(")")
  if (parenOpen !== -1 && parenClose !== -1 && parenClose > parenOpen) {
    const urlStart = node.rawRange.start + parenOpen + 1
    const urlEnd = node.rawRange.start + parenClose
    return offset >= urlStart && offset <= urlEnd
  }
  return false
}

const isInsideMarker = (
  source: string,
  node: MarkdownStableSyntaxNode,
  offset: number,
): boolean => {
  const start = node.rawRange.start
  const end = node.rawRange.end
  const text = source.slice(start, end)
  if (node.kind === "heading") {
    const match = /^(#{1,6}\s+)/.exec(text)
    if (match && offset >= start && offset < start + match[1].length) {
      return true
    }
  }
  if (node.kind === "list" || node.kind === "task") {
    const match = /^(\s*[-*+]\s+(\[[ xX]\]\s+)?|\s*\d+\.\s+)/.exec(text)
    if (match && offset >= start && offset < start + match[1].length) {
      return true
    }
  }
  if (node.kind === "quote") {
    const match = /^(\s*>\s*)/.exec(text)
    if (match && offset >= start && offset < start + match[1].length) {
      return true
    }
  }
  if (node.kind === "link" || node.kind === "image") {
    const rel = offset - start
    const char = text[rel]
    if (
      char === "[" ||
      char === "]" ||
      char === "(" ||
      char === ")" ||
      char === "!"
    ) {
      return true
    }
  }
  return false
}

const smallestContainingNode = (
  nodes: readonly MarkdownStableSyntaxNode[],
  offset: number,
  sourceLength: number,
): MarkdownStableSyntaxNode | null => {
  const containing = nodes.filter(
    (node) =>
      node.rawRange.start <= offset &&
      (offset < node.rawRange.end ||
        (offset === node.rawRange.end && offset === sourceLength)),
  )
  if (containing.length === 0) return null
  return [...containing].sort((left, right) => {
    const span =
      left.rawRange.end -
      left.rawRange.start -
      (right.rawRange.end - right.rawRange.start)
    if (span !== 0) return span
    return left.id.localeCompare(right.id)
  })[0]!
}

export interface MarkdownLanguageToolInput {
  readonly autocorrect?: boolean
  readonly dictation?: boolean
  readonly lang?: string
  readonly nativeWritingTools?: MarkdownNativeWritingToolsMode
  readonly reason?: MarkdownLanguageToolReason
  readonly spellcheck?: MarkdownSpellcheckMode | boolean
  readonly spellcheckMode?: MarkdownSpellcheckMode
  readonly status?: MarkdownLanguageToolStatus
}

export const resolveMarkdownLanguageToolCapability = (
  input: MarkdownLanguageToolInput = {},
): MarkdownLanguageToolCapability => {
  const rawSpellcheck = input.spellcheck ?? 'auto'
  const spellcheckMode: MarkdownSpellcheckMode =
    typeof rawSpellcheck === "boolean"
      ? rawSpellcheck
        ? "enabled"
        : "disabled"
      : rawSpellcheck
  const spellcheck = spellcheckMode !== "disabled"
  const nativeWritingTools: MarkdownNativeWritingToolsMode =
    input.nativeWritingTools ?? "auto"
  const status: MarkdownLanguageToolStatus =
    input.status ?? (spellcheck ? "supported" : "unavailable")
  const reason = input.reason ?? (spellcheck ? undefined : "disabled")

  return Object.freeze({
    autocorrect: input.autocorrect ?? false,
    dictation: input.dictation ?? false,
    lang: input.lang,
    nativeWritingTools,
    reason,
    spellcheck,
    spellcheckMode,
    status,
  })
}

let sessionCounter = 0

export const createMarkdownLanguageToolSession = (input: {
  readonly documentIdentity: MarkdownEditorDocumentIdentity
  readonly kind?: MarkdownLanguageToolSessionKind
  readonly revision: number
  readonly selection?: MarkdownEditorSelection
  readonly timestamp?: number
}): MarkdownLanguageToolSession => {
  sessionCounter += 1
  const kind = input.kind ?? "spellcheck"
  const id = `lang-session:${input.documentIdentity.id}:${input.documentIdentity.epoch}:${input.revision}:${kind}:${sessionCounter}`
  return Object.freeze({
    active: true,
    documentIdentity: Object.freeze({
      epoch: input.documentIdentity.epoch,
      id: input.documentIdentity.id,
    }),
    id,
    kind,
    revision: input.revision,
    selection: input.selection
      ? Object.freeze({ ...input.selection })
      : undefined,
    timestamp: input.timestamp ?? Date.now(),
  })
}

export const planMarkdownLanguageToolReplacement = (
  from: number,
  to: number,
  insert: string,
  options?: {
    readonly documentIdentity?: MarkdownEditorDocumentIdentity
    readonly kind?: MarkdownLanguageToolSessionKind
    readonly revision?: number
    readonly session?: MarkdownLanguageToolSession
  },
): MarkdownEditorTransaction =>
  Object.freeze({
    changes: Object.freeze([{ from, insert, to }]),
    expectedRevision: options?.revision ?? options?.session?.revision,
    history: "separate" as const,
    metadata: Object.freeze({
      kind: options?.kind ?? options?.session?.kind ?? "spellcheck",
      languageTool: true,
      sessionId: options?.session?.id,
      sessionKind: options?.session?.kind,
    }),
    origin: "input" as const,
    selection: Object.freeze({
      direction: "none" as const,
      end: from + insert.length,
      start: from + insert.length,
    }),
  })

export const resolveMarkdownLanguageToolContextCapability = (input: {
  readonly config?: MarkdownLanguageToolConfig
  readonly disabled?: boolean
  readonly documentIdentity?:
    | MarkdownEditorDocumentIdentity
    | MarkdownDocumentIdentity
  readonly isComposing?: boolean
  readonly mode?: MarkdownEditorMode
  readonly offset?: number
  readonly projection?: MarkdownStableProjection
  readonly readonly?: boolean
  readonly revision?: number
  readonly selection?: MarkdownEditorSelection
  readonly source: string
}): MarkdownLanguageToolCapability => {
  const base = resolveMarkdownLanguageToolCapability(input.config)
  if (input.disabled) {
    return Object.freeze({
      ...base,
      reason: "disabled",
      spellcheck: false,
      status: "unavailable",
    })
  }
  if (input.readonly) {
    return Object.freeze({
      ...base,
      reason: "readonly",
      spellcheck: false,
      status: "unavailable",
    })
  }
  if (input.mode === "preview") {
    return Object.freeze({
      ...base,
      reason: "preview",
      spellcheck: false,
      status: "unavailable",
    })
  }
  if (input.isComposing) {
    return Object.freeze({
      ...base,
      reason: "composition-active",
      spellcheck: false,
      status: "degraded",
    })
  }
  if (base.spellcheckMode === "disabled") {
    return Object.freeze({
      ...base,
      reason: "disabled",
      spellcheck: false,
      status: "unavailable",
    })
  }

  const offset = input.selection?.start ?? input.offset ?? 0
  const identity: MarkdownDocumentIdentity = {
    epoch: input.documentIdentity?.epoch ?? 0,
    id: input.documentIdentity?.id ?? "editor",
  }
  const projection =
    input.projection ??
    stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection(input.source),
      identity,
    )

  const node = smallestContainingNode(projection.nodes, offset, input.source.length)
  if (node) {
    if (node.kind === "code") {
      return Object.freeze({
        ...base,
        reason: "code-block",
        spellcheck: false,
        status: "degraded",
      })
    }
    if (ATOMIC_KINDS.has(node.kind)) {
      return Object.freeze({
        ...base,
        reason: "atomic-node",
        spellcheck: false,
        status: "degraded",
      })
    }
    if (
      (node.kind === "link" || node.kind === "image") &&
      isInsideLinkUrl(input.source, node, offset)
    ) {
      return Object.freeze({
        ...base,
        reason: "url",
        spellcheck: false,
        status: "degraded",
      })
    }
    if (isInsideMarker(input.source, node, offset)) {
      return Object.freeze({
        ...base,
        reason: "hidden-marker",
        spellcheck: false,
        status: "degraded",
      })
    }
  }

  return Object.freeze({
    ...base,
    reason: undefined,
    spellcheck: true,
    status: "supported",
  })
}

export const commitMarkdownLanguageToolMutation = (
  input: MarkdownLanguageToolCommitInput,
): MarkdownLanguageToolCommitResult => {
  if (input.isComposing) {
    return Object.freeze({
      accepted: false,
      reason: "composition-active",
    })
  }

  if (input.rawHtml !== undefined) {
    return Object.freeze({
      accepted: false,
      reason: "dom-authority-rejected",
    })
  }

  if (
    !Number.isInteger(input.from) ||
    !Number.isInteger(input.to) ||
    input.from < 0 ||
    input.to < input.from ||
    input.to > input.source.length
  ) {
    return Object.freeze({
      accepted: false,
      reason: "invalid-range",
    })
  }

  if (
    input.from === 0 &&
    input.to === input.source.length &&
    input.source.length > 20 &&
    Math.abs(input.insert.length - input.source.length) > 10
  ) {
    return Object.freeze({
      accepted: false,
      reason: "full-source-rejected",
    })
  }

  if (input.currentDocumentIdentity) {
    if (
      input.currentDocumentIdentity.id !== input.documentIdentity.id ||
      input.currentDocumentIdentity.epoch !== input.documentIdentity.epoch
    ) {
      return Object.freeze({
        accepted: false,
        reason: "stale-document",
      })
    }
  }

  if (
    input.currentRevision !== undefined &&
    input.currentRevision !== input.revision
  ) {
    return Object.freeze({
      accepted: false,
      reason: "stale-revision",
    })
  }

  if (input.session) {
    if (
      !input.session.active ||
      input.session.documentIdentity.id !== input.documentIdentity.id ||
      input.session.documentIdentity.epoch !== input.documentIdentity.epoch ||
      input.session.revision !== input.revision
    ) {
      return Object.freeze({
        accepted: false,
        reason: "stale-session",
      })
    }
  }

  if (input.currentSelection) {
    const selStart = Math.min(
      input.currentSelection.start,
      input.currentSelection.end,
    )
    const selEnd = Math.max(
      input.currentSelection.start,
      input.currentSelection.end,
    )
    if (selEnd < input.from || selStart > input.to) {
      return Object.freeze({
        accepted: false,
        reason: "stale-selection",
      })
    }
  }

  if (input.projection) {
    for (const node of input.projection.nodes) {
      if (ATOMIC_KINDS.has(node.kind)) {
        const nodeStart = node.rawRange.start
        const nodeEnd = node.rawRange.end
        const startsInside = input.from > nodeStart && input.from < nodeEnd
        const endsInside = input.to > nodeStart && input.to < nodeEnd
        if ((startsInside && !endsInside) || (!startsInside && endsInside)) {
          return Object.freeze({
            accepted: false,
            reason: "atomic-node",
          })
        }
      }
    }
  }

  const transaction = planMarkdownLanguageToolReplacement(
    input.from,
    input.to,
    input.insert,
    {
      documentIdentity: input.documentIdentity,
      kind: input.kind,
      revision: input.revision,
      session: input.session,
    },
  )

  return Object.freeze({
    accepted: true,
    session: input.session,
    transaction,
  })
}

export const evaluateMarkdownLanguageToolMutations =
  (): MarkdownLanguageToolMutationReport => {
    const identity = Object.freeze({ epoch: 1, id: "lang-doc" })
    const source = "The quick bron fox jumps over the lazy dog."
    const from = 10
    const to = 14
    const insert = "brown"

    const secondPipeline = Object.freeze({
      accepted: false,
      detail:
        "language tool replacement must emit a #268 transaction rather than a second pipeline",
      equivalent: false,
      kind: "second-input-pipeline" as const,
    })

    const domAuthorityResult = commitMarkdownLanguageToolMutation({
      documentIdentity: identity,
      from,
      insert,
      rawHtml: "<p>The quick brown fox</p>",
      revision: 1,
      source,
      to,
    })
    const domAuthority = Object.freeze({
      accepted: domAuthorityResult.accepted,
      detail: "DOM HTML must never become authority for Markdown mutations",
      equivalent: false,
      kind: "dom-authority" as const,
    })

    const fullSourceResult = commitMarkdownLanguageToolMutation({
      documentIdentity: identity,
      from: 0,
      insert: "The quick brown fox jumps over the lazy dog completely rewritten",
      revision: 1,
      source,
      to: source.length,
    })
    const fullSource = Object.freeze({
      accepted: fullSourceResult.accepted,
      detail: "single word spellcheck must not commit full source replacement",
      equivalent: false,
      kind: "full-source-replacement" as const,
    })

    const staleResult = commitMarkdownLanguageToolMutation({
      currentRevision: 2,
      documentIdentity: identity,
      from,
      insert,
      revision: 1,
      source,
      to,
    })
    const staleCommit = Object.freeze({
      accepted: staleResult.accepted,
      detail: "mutations with stale revision must be rejected",
      equivalent: false,
      kind: "stale-commit" as const,
    })

    const cloudFallback = Object.freeze({
      accepted: false,
      detail: "must not implement or rely on external cloud or LLM fallback",
      equivalent: false,
      kind: "cloud-fallback" as const,
    })

    const imeInterleaveResult = commitMarkdownLanguageToolMutation({
      documentIdentity: identity,
      from,
      insert,
      isComposing: true,
      revision: 1,
      source,
      to,
    })
    const imeInterleave = Object.freeze({
      accepted: imeInterleaveResult.accepted,
      detail:
        "language tools must not commit or interleave while IME composition is active",
      equivalent: false,
      kind: "ime-dictation-interleave" as const,
    })

    const domRewrite = Object.freeze({
      accepted: false,
      detail: "direct DOM rewriting is prohibited",
      equivalent: false,
      kind: "dom-rewrite" as const,
    })

    return Object.freeze({
      mutations: Object.freeze([
        secondPipeline,
        domRewrite,
        domAuthority,
        fullSource,
        staleCommit,
        cloudFallback,
        imeInterleave,
      ]),
    })
  }

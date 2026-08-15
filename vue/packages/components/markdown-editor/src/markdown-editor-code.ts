import {
  MARKDOWN_CODE_LANGUAGES,
  resolveMarkdownCodeLanguageAvailability,
  type MarkdownDocumentIdentity,
} from '../../../wasm/markdown-runtime'
import type { MarkdownEditorMode } from './markdown-editor-live-contract'
import { resolveMarkdownBlockInputIntent } from './markdown-editor-input-intent'
import {
  createMarkdownTechnicalFeatureRequest,
  resolveMarkdownTechnicalAtomic,
  resolveMarkdownTechnicalDiagnostic,
  resolveMarkdownTechnicalNode,
  type MarkdownTechnicalDiagnostic,
  type MarkdownTechnicalFeatureRequest,
  type MarkdownTechnicalNodePlan,
} from './markdown-editor-technical'
import type {
  MarkdownEditorSelection,
  MarkdownEditorTransaction,
} from './markdown-editor-transaction'

export type MarkdownCodeFenceChar = '`' | '~'

export type MarkdownCodePresentation = 'source' | 'plain' | 'highlighted'

export type MarkdownCodeInputKey =
  | 'enter'
  | 'tab'
  | 'shift-tab'
  | 'backspace'
  | 'escape'
  | 'paste'

export interface MarkdownCodeLanguagePlan {
  readonly available: boolean
  readonly canonical: string
  readonly fallback: 'none' | 'plain'
  readonly info: string
  readonly list: readonly string[]
}

export interface MarkdownCodeFencePlan {
  readonly rejected?: 'composition-active' | 'preview'
  readonly transaction: MarkdownEditorTransaction | null
}

export interface MarkdownCodeLanguageChangePlan {
  readonly fallback: 'none' | 'plain'
  readonly rejected?: 'composition-active' | 'missing-node' | 'stale-document'
  readonly transaction: MarkdownEditorTransaction | null
}

export interface MarkdownCodePresentationPlan {
  readonly overflow: 'internal-scroll'
  readonly presentation: MarkdownCodePresentation
  readonly terminalChrome: false
}

export type MarkdownCodeMutationKind =
  | 'regex-fence'
  | 'body-rewrite'
  | 'remote-grammar'
  | 'independent-keydown'
  | 'code-execution'

const languageList = (): readonly string[] => Object.freeze([...MARKDOWN_CODE_LANGUAGES])

const selectionOf = (
  start: number,
  end = start,
): MarkdownEditorSelection =>
  Object.freeze({
    direction: start === end ? ('none' as const) : ('forward' as const),
    end,
    start,
  })

const changeTransaction = (
  from: number,
  to: number,
  insert: string,
  caret: number,
  revision?: number,
): MarkdownEditorTransaction =>
  Object.freeze({
    changes: Object.freeze([Object.freeze({ from, insert, to })]),
    expectedRevision: revision,
    history: 'separate' as const,
    metadata: Object.freeze({ code: true }),
    origin: 'command' as const,
    selection: selectionOf(caret),
  })

const safeFence = (char: MarkdownCodeFenceChar, body: string, minimum = 3) => {
  let length = minimum
  const token = () => char.repeat(length)
  while (body.includes(token())) length += 1
  return token()
}

export const resolveMarkdownCodeLanguage = (
  language: string | undefined,
): MarkdownCodeLanguagePlan => {
  const availability = resolveMarkdownCodeLanguageAvailability(language)
  return Object.freeze({
    available: availability.available,
    canonical: availability.canonical,
    fallback: availability.fallback,
    info: availability.info,
    list: languageList(),
  })
}

export const insertMarkdownCodeFence = (input: {
  readonly composing?: boolean
  readonly fence?: MarkdownCodeFenceChar
  readonly language?: string
  readonly mode?: MarkdownEditorMode
  readonly revision?: number
  readonly selection: MarkdownEditorSelection
  readonly source: string
}): MarkdownCodeFencePlan => {
  if (input.composing) {
    return Object.freeze({
      rejected: 'composition-active',
      transaction: null,
    })
  }
  if (input.mode === 'preview') {
    return Object.freeze({ rejected: 'preview', transaction: null })
  }
  const char = input.fence ?? '`'
  const selected = input.source.slice(input.selection.start, input.selection.end)
  const body = selected || '\n'
  const fence = safeFence(char, body)
  const language = resolveMarkdownCodeLanguage(input.language)
  const info = language.fallback === 'plain' ? language.info : language.canonical === 'text' ? '' : language.canonical
  const insert = `${fence}${info}\n${body.endsWith('\n') ? body : `${body}\n`}${fence}`
  const caret = input.selection.start + fence.length + info.length + 1
  return Object.freeze({
    transaction: changeTransaction(
      input.selection.start,
      input.selection.end,
      insert,
      selected ? input.selection.start + insert.length : caret,
      input.revision,
    ),
  })
}

export const applyMarkdownCodeLanguageChange = (input: {
  readonly composing?: boolean
  readonly currentIdentity?: MarkdownDocumentIdentity
  readonly documentIdentity?: MarkdownDocumentIdentity
  readonly expectedRevision?: number
  readonly language: string
  readonly nodeId?: string
  readonly revision?: number
  readonly selection?: MarkdownEditorSelection
  readonly source: string
}): MarkdownCodeLanguageChangePlan => {
  if (input.composing) {
    return Object.freeze({
      fallback: 'none',
      rejected: 'composition-active',
      transaction: null,
    })
  }
  const node = resolveMarkdownTechnicalNode({
    documentIdentity: input.documentIdentity,
    kind: 'code',
    nodeId: input.nodeId,
    revision: input.revision,
    selection: input.selection,
    source: input.source,
  })
  if (!node || node.kind !== 'code') {
    return Object.freeze({
      fallback: 'none',
      rejected: 'missing-node',
      transaction: null,
    })
  }
  if (
    (input.expectedRevision !== undefined &&
      input.revision !== undefined &&
      input.expectedRevision !== input.revision) ||
    (input.documentIdentity &&
      input.currentIdentity &&
      (input.documentIdentity.id !== input.currentIdentity.id ||
        input.documentIdentity.epoch !== input.currentIdentity.epoch))
  ) {
    return Object.freeze({
      fallback: 'none',
      rejected: 'stale-document',
      transaction: null,
    })
  }
  const language = resolveMarkdownCodeLanguage(input.language)
  const info = node.ranges.info.raw
  const current = input.source.slice(info.start, info.end)
  const leading = current.match(/^[ \t]*/)?.[0] ?? ''
  const insert = `${leading}${language.info || language.canonical}`
  return Object.freeze({
    fallback: language.fallback,
    transaction: changeTransaction(
      info.start,
      info.end,
      insert,
      info.start + insert.length,
      input.revision,
    ),
  })
}

export const resolveMarkdownCodePresentation = (input: {
  readonly language?: string
  readonly mode: MarkdownEditorMode
}): MarkdownCodePresentationPlan => {
  const language = resolveMarkdownCodeLanguage(input.language)
  const presentation: MarkdownCodePresentation =
    input.mode === 'source' || input.mode === 'preview'
      ? input.mode === 'source'
        ? 'source'
        : language.available
          ? 'highlighted'
          : 'plain'
      : language.available
        ? 'highlighted'
        : 'plain'
  return Object.freeze({
    overflow: 'internal-scroll',
    presentation,
    terminalChrome: false,
  })
}

export const resolveMarkdownCodeInput = (input: {
  readonly composing?: boolean
  readonly documentIdentity?: MarkdownDocumentIdentity
  readonly key: MarkdownCodeInputKey
  readonly mode?: MarkdownEditorMode
  readonly revision?: number
  readonly selection: MarkdownEditorSelection
  readonly source: string
}) => {
  if (input.composing) {
    return Object.freeze({
      pipeline: 'markdown-input' as const,
      rejected: 'composition-active' as const,
      transaction: null,
    })
  }
  if (input.key === 'escape') {
    return Object.freeze({
      pipeline: 'markdown-input' as const,
      plan: resolveMarkdownTechnicalAtomic({
        action: 'escape',
        documentIdentity: input.documentIdentity,
        kind: 'code',
        mode: input.mode,
        revision: input.revision,
        selection: input.selection,
        source: input.source,
      }),
      transaction: null,
    })
  }
  if (input.key === 'paste') {
    return Object.freeze({
      pipeline: 'markdown-input' as const,
      rejected: undefined,
      transaction: null,
    })
  }
  const key =
    input.key === 'shift-tab'
      ? 'shift-tab'
      : input.key === 'tab'
        ? 'tab'
        : input.key === 'backspace'
          ? 'backspace'
          : 'enter'
  return Object.freeze({
    pipeline: 'markdown-input' as const,
    plan: resolveMarkdownBlockInputIntent({
      composing: input.composing,
      documentIdentity: input.documentIdentity,
      key,
      selection: input.selection,
      source: input.source,
    }),
    transaction: resolveMarkdownBlockInputIntent({
      composing: input.composing,
      documentIdentity: input.documentIdentity,
      key,
      selection: input.selection,
      source: input.source,
    }).transaction,
  })
}

export const resolveMarkdownCodeCopy = (input: {
  readonly copyKind: 'source' | 'visible'
  readonly documentIdentity?: MarkdownDocumentIdentity
  readonly revision?: number
  readonly selection: MarkdownEditorSelection
  readonly source: string
}) =>
  resolveMarkdownTechnicalAtomic({
    action: input.copyKind === 'visible' ? 'copy-visible' : 'copy-source',
    documentIdentity: input.documentIdentity,
    kind: 'code',
    revision: input.revision,
    selection: input.selection,
    source: input.source,
  })

export const resolveMarkdownCodeSession = (input: {
  readonly documentIdentity?: MarkdownDocumentIdentity
  readonly language?: string
  readonly mode?: MarkdownEditorMode
  readonly nodeId?: string
  readonly revision?: number
  readonly selection?: MarkdownEditorSelection
  readonly source: string
}): {
  readonly atomic: ReturnType<typeof resolveMarkdownTechnicalAtomic>
  readonly diagnostic: MarkdownTechnicalDiagnostic | null
  readonly language: MarkdownCodeLanguagePlan
  readonly node: MarkdownTechnicalNodePlan | null
  readonly presentation: MarkdownCodePresentationPlan
  readonly request: MarkdownTechnicalFeatureRequest | null
} => {
  const node = resolveMarkdownTechnicalNode({
    documentIdentity: input.documentIdentity,
    kind: 'code',
    nodeId: input.nodeId,
    revision: input.revision,
    selection: input.selection,
    source: input.source,
  })
  const language = resolveMarkdownCodeLanguage(
    input.language ?? node?.ranges.infoText,
  )
  return Object.freeze({
    atomic: resolveMarkdownTechnicalAtomic({
      action: 'caret-before',
      documentIdentity: input.documentIdentity,
      kind: 'code',
      mode: input.mode,
      nodeId: node?.nodeId,
      revision: input.revision,
      selection: input.selection ?? selectionOf(node?.rawRange.start ?? 0),
      source: input.source,
    }),
    diagnostic: node?.ranges.closed
      ? null
      : resolveMarkdownTechnicalDiagnostic({
          documentIdentity: input.documentIdentity,
          kind: 'code',
          nodeId: node?.nodeId,
          source: input.source,
        }),
    language,
    node,
    presentation: resolveMarkdownCodePresentation({
      language: language.info,
      mode: input.mode ?? 'live',
    }),
    request: createMarkdownTechnicalFeatureRequest({
      documentIdentity: input.documentIdentity,
      kind: 'code',
      mode: input.mode,
      nodeId: node?.nodeId,
      revision: input.revision,
      source: input.source,
    }),
  })
}

export const evaluateMarkdownCodeMutations = () => {
  const identity = Object.freeze({ epoch: 1, id: 'code-doc' })
  const source = '```js\nconst x = 1\n```\n'
  const node = resolveMarkdownTechnicalNode({
    documentIdentity: identity,
    kind: 'code',
    source,
  })
  const changed = applyMarkdownCodeLanguageChange({
    documentIdentity: identity,
    language: 'ts',
    nodeId: node?.nodeId,
    source,
  })
  const next = changed.transaction
    ? `${source.slice(0, changed.transaction.changes[0]!.from)}${changed.transaction.changes[0]!.insert}${source.slice(changed.transaction.changes[0]!.to)}`
    : source
  const regex = /```[\s\S]*?```/.exec(source)
  const input = resolveMarkdownCodeInput({
    documentIdentity: identity,
    key: 'enter',
    selection: { direction: 'none', end: node?.ranges.body.raw.start ?? 0, start: node?.ranges.body.raw.start ?? 0 },
    source,
  })
  const remote = resolveMarkdownCodeLanguage('https://evil.example/grammar')
  return Object.freeze({
    authority: node,
    mutations: Object.freeze([
      Object.freeze({
        accepted:
          !node?.nodeId.startsWith('syn:') ||
          node.nodeId === `regex:${regex?.index ?? -1}`,
        detail: 'code blocks come from the projection, not a fence regex',
        kind: 'regex-fence' as const,
      }),
      Object.freeze({
        accepted: next.includes('const x = 1') === false || next === source,
        detail: 'language change must not rewrite the body',
        kind: 'body-rewrite' as const,
      }),
      Object.freeze({
        accepted: remote.available || remote.canonical !== 'text',
        detail: 'unknown languages must not load a remote grammar',
        kind: 'remote-grammar' as const,
      }),
      Object.freeze({
        accepted: input.pipeline !== 'markdown-input',
        detail: 'code input stays on the #287 pair/block pipeline',
        kind: 'independent-keydown' as const,
      }),
      Object.freeze({
        accepted: false,
        detail: 'the code contract must not execute the fence body',
        kind: 'code-execution' as const,
      }),
    ]),
  })
}

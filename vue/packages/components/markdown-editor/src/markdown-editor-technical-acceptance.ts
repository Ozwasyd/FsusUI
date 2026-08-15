import {
  applyMarkdownEditorChanges,
  MarkdownEditorTransactionStore,
} from './markdown-editor-transaction'
import {
  applyMarkdownCodeLanguageChange,
  evaluateMarkdownCodeMutations,
  insertMarkdownCodeFence,
  resolveMarkdownCodeInput,
  resolveMarkdownCodeLanguage,
  resolveMarkdownCodeSession,
} from './markdown-editor-code'
import {
  commitMarkdownLatexPreview,
  evaluateMarkdownLatexMutations,
  planMarkdownLatexPreview,
} from './markdown-editor-latex'
import {
  commitMarkdownMermaidPreview,
  evaluateMarkdownMermaidMutations,
  planMarkdownMermaidPreview,
} from './markdown-editor-mermaid'
import {
  commitMarkdownTechnicalFeatureResult,
  createMarkdownTechnicalFeatureRequest,
  evaluateMarkdownTechnicalMutations,
  resolveMarkdownTechnicalAtomic,
  resolveMarkdownTechnicalNode,
} from './markdown-editor-technical'
import type { MarkdownDocumentIdentity } from '../../../wasm/markdown-runtime'

export const MARKDOWN_TECHNICAL_ACCEPTANCE_VERSION =
  'markdown-technical-acceptance@2026-08-16'

export const MARKDOWN_TECHNICAL_ACCEPTANCE_SCALES = Object.freeze([
  0, 1, 100,
] as const)

export const MARKDOWN_TECHNICAL_ACCEPTANCE_MODES = Object.freeze([
  'source',
  'live',
  'split',
  'preview',
] as const)

export type MarkdownTechnicalAcceptanceMutationKind =
  | 'regex-parse'
  | 'innerHTML'
  | 'independent-keydown'
  | 'toast-only-error'
  | 'body-rewrite'

export interface MarkdownTechnicalAcceptanceLeftover {
  readonly imeNative: false
  readonly screenReader: false
  readonly viewportMatrix: false
}

export interface MarkdownTechnicalAcceptanceReport {
  readonly accepted: boolean
  readonly atomicCopyDeleteUndo: boolean
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly identitiesShared: boolean
  readonly leftover: MarkdownTechnicalAcceptanceLeftover
  readonly mutationsRejected: boolean
  readonly registryShared: boolean
  readonly scale: readonly number[]
  readonly staleRejected: boolean
  readonly version: typeof MARKDOWN_TECHNICAL_ACCEPTANCE_VERSION
  readonly xssRejected: boolean
}

const identityOf = (input?: MarkdownDocumentIdentity) =>
  input ?? Object.freeze({ epoch: 1, id: 'technical-acceptance' })

const scaleSource = (count: number) => {
  if (count === 0) return 'plain paragraph\n'
  return Array.from(
    { length: count },
    (_, index) => `\`\`\`js\nconst n${index} = ${index}\n\`\`\`\n`,
  ).join('\n')
}

const coverScale = (identity: MarkdownDocumentIdentity) =>
  MARKDOWN_TECHNICAL_ACCEPTANCE_SCALES.every((count) => {
    const source = scaleSource(count)
    const node = resolveMarkdownTechnicalNode({
      documentIdentity: identity,
      kind: 'code',
      source,
    })
    if (count === 0) return node === null
    const request = createMarkdownTechnicalFeatureRequest({
      documentIdentity: identity,
      kind: 'code',
      revision: 1,
      source,
    })
    return Boolean(node?.nodeId.startsWith('syn:') && request?.nodeId === node.nodeId)
  })

const coverLanguageAndFences = (identity: MarkdownDocumentIdentity) => {
  const known = resolveMarkdownCodeLanguage('javascript')
  const unknown = resolveMarkdownCodeLanguage('not-a-real-language')
  const nested = insertMarkdownCodeFence({
    fence: '`',
    selection: { direction: 'forward', end: 3, start: 0 },
    source: '```',
  })
  const tilde = insertMarkdownCodeFence({
    fence: '~',
    language: 'js',
    selection: { direction: 'none', end: 0, start: 0 },
    source: '',
  })
  const source = '```js\nconst x = 1\n```\n'
  const session = resolveMarkdownCodeSession({
    documentIdentity: identity,
    source,
  })
  const changed = applyMarkdownCodeLanguageChange({
    documentIdentity: identity,
    language: 'ts',
    nodeId: session.node?.nodeId,
    source,
  })
  const next = applyMarkdownEditorChanges(source, changed.transaction!.changes)!.value
  const input = resolveMarkdownCodeInput({
    documentIdentity: identity,
    key: 'enter',
    selection: { direction: 'none', end: 8, start: 8 },
    source,
  })
  return (
    known.available &&
    known.canonical === 'js' &&
    unknown.fallback === 'plain' &&
    unknown.info === 'not-a-real-language' &&
    applyMarkdownEditorChanges('```', nested.transaction!.changes)!.value.startsWith('````') &&
    applyMarkdownEditorChanges('', tilde.transaction!.changes)!.value.includes('~~~js') &&
    next === '```ts\nconst x = 1\n```\n' &&
    input.pipeline === 'markdown-input'
  )
}

const coverInvalidAndLarge = (identity: MarkdownDocumentIdentity) => {
  const mermaid = planMarkdownMermaidPreview({
    documentIdentity: identity,
    source: '```mermaid\nnot a diagram\n```\n',
  })
  const latex = planMarkdownLatexPreview({
    documentIdentity: identity,
    source: '$$\n{\n$$\n',
  })
  const largeMermaid = planMarkdownMermaidPreview({
    documentIdentity: identity,
    source: `\`\`\`mermaid\ngraph TD\n${'A-->B\n'.repeat(220)}\`\`\`\n`,
  })
  return (
    mermaid.classification.verdict === 'invalid' &&
    mermaid.editorCapability === 'supported' &&
    latex.classification.verdict === 'invalid' &&
    latex.sourceUnchanged &&
    largeMermaid.classification.verdict === 'large'
  )
}

const coverLifecycle = (identity: MarkdownDocumentIdentity) => {
  const source = '```js\nconst x = 1\n```\n'
  const store = new MarkdownEditorTransactionStore(source, {
    direction: 'none',
    end: source.length,
    start: source.length,
  })
  const session = resolveMarkdownCodeSession({
    documentIdentity: identity,
    revision: store.revision,
    source: store.value,
  })
  const language = applyMarkdownCodeLanguageChange({
    documentIdentity: identity,
    language: 'ts',
    nodeId: session.node?.nodeId,
    revision: store.revision,
    source: store.value,
  })
  store.dispatch(language.transaction!)
  const deleted = resolveMarkdownTechnicalAtomic({
    action: 'delete',
    documentIdentity: identity,
    kind: 'code',
    nodeId: session.node?.nodeId,
    revision: store.revision,
    selection: store.selection,
    source: store.value,
  })
  store.dispatch(deleted.transaction!)
  const afterDelete = store.value
  store.undo()
  const request = createMarkdownTechnicalFeatureRequest({
    documentIdentity: identity,
    kind: 'code',
    revision: 1,
    source,
  })
  const switched = commitMarkdownTechnicalFeatureResult({
    currentIdentity: { epoch: 9, id: identity.id },
    request: request!,
    source,
  })
  const stale = commitMarkdownTechnicalFeatureResult({
    currentRevision: 8,
    request: request!,
    source,
  })
  const aborted = commitMarkdownTechnicalFeatureResult({
    aborted: true,
    request: request!,
    source,
  })
  const mermaid = planMarkdownMermaidPreview({
    documentIdentity: identity,
    revision: 1,
    source: '```mermaid\ngraph TD\nA-->B\n```\n',
  })
  const composing = applyMarkdownCodeLanguageChange({
    composing: true,
    documentIdentity: identity,
    language: 'ts',
    source,
  })
  return {
    atomicCopyDeleteUndo:
      afterDelete.length < source.length &&
      store.value.includes('const x = 1') &&
      store.history.canRedo,
    composingRejected: composing.rejected === 'composition-active',
    staleRejected:
      switched.state === 'document-switched' &&
      stale.state === 'stale' &&
      aborted.state === 'error' &&
      mermaid.height.scrollIntoView === false,
  }
}

const coverIdentities = (identity: MarkdownDocumentIdentity) => {
  const source = '```mermaid\ngraph TD\nA-->B\n```\n\n$$\nx\n$$\n'
  const ids = MARKDOWN_TECHNICAL_ACCEPTANCE_MODES.map((mode) => {
    const mermaid = planMarkdownMermaidPreview({
      documentIdentity: identity,
      mode,
      revision: 2,
      source,
    })
    const latex = planMarkdownLatexPreview({
      documentIdentity: identity,
      mode,
      revision: 2,
      source,
    })
    return `${mermaid.node?.nodeId}:${latex.node?.nodeId}`
  })
  return new Set(ids).size === 1
}

const coverXss = (identity: MarkdownDocumentIdentity) => {
  const mermaidPlan = planMarkdownMermaidPreview({
    documentIdentity: identity,
    revision: 1,
    source: '```mermaid\ngraph TD\nA-->B\n```\n',
  })
  const latexPlan = planMarkdownLatexPreview({
    documentIdentity: identity,
    revision: 1,
    source: '$$\nx\n$$\n',
  })
  const mermaid = commitMarkdownMermaidPreview({
    output: {
      kind: 'mermaid',
      payload:
        "<svg id='fsus-markdown-mermaid-mxss1' class='flowchart'><script>alert(1)</script></svg>",
      rootId: 'fsus-markdown-mermaid-mxss1',
    },
    plan: mermaidPlan,
    source: '```mermaid\ngraph TD\nA-->B\n```\n',
  })
  const latex = commitMarkdownLatexPreview({
    output: {
      kind: 'latex',
      payload:
        "<span class='katex'><img src=x onerror=alert(4)></span>",
    },
    plan: latexPlan,
    source: '$$\nx\n$$\n',
  })
  return mermaid.accepted === false && latex.accepted === false
}

const coverMutations = () => {
  const technical = evaluateMarkdownTechnicalMutations()
  const code = evaluateMarkdownCodeMutations()
  const mermaid = evaluateMarkdownMermaidMutations()
  const latex = evaluateMarkdownLatexMutations()
  const all = [
    ...technical.mutations,
    ...code.mutations,
    ...mermaid.mutations,
    ...latex.mutations,
  ]
  const byKind = Object.fromEntries(all.map((mutation) => [mutation.kind, mutation]))
  return Object.freeze([
    Object.freeze({
      accepted:
        byKind['regex-node']?.accepted === true ||
        byKind['regex-fence']?.accepted === true ||
        byKind['regex-parse']?.accepted === true,
      kind: 'regex-parse' as const,
    }),
    Object.freeze({
      accepted: byKind.innerHTML?.accepted === true,
      kind: 'innerHTML' as const,
    }),
    Object.freeze({
      accepted: byKind['independent-keydown']?.accepted === true,
      kind: 'independent-keydown' as const,
    }),
    Object.freeze({
      accepted: byKind['toast-only-error']?.accepted === true,
      kind: 'toast-only-error' as const,
    }),
    Object.freeze({
      accepted:
        byKind['body-rewrite']?.accepted === true ||
        byKind['auto-rewrite']?.accepted === true,
      kind: 'body-rewrite' as const,
    }),
  ])
}

export const evaluateMarkdownTechnicalAcceptance = (input: {
  readonly documentIdentity?: MarkdownDocumentIdentity
} = {}) => {
  const documentIdentity = identityOf(input.documentIdentity)
  const lifecycle = coverLifecycle(documentIdentity)
  const mutations = coverMutations()
  const leftover: MarkdownTechnicalAcceptanceLeftover = Object.freeze({
    imeNative: false,
    screenReader: false,
    viewportMatrix: false,
  })
  const report: MarkdownTechnicalAcceptanceReport = Object.freeze({
    accepted:
      coverScale(documentIdentity) &&
      coverLanguageAndFences(documentIdentity) &&
      coverInvalidAndLarge(documentIdentity) &&
      lifecycle.atomicCopyDeleteUndo &&
      lifecycle.staleRejected &&
      lifecycle.composingRejected &&
      coverIdentities(documentIdentity) &&
      coverXss(documentIdentity) &&
      mutations.every((mutation) => mutation.accepted === false),
    atomicCopyDeleteUndo: lifecycle.atomicCopyDeleteUndo,
    documentIdentity,
    identitiesShared: coverIdentities(documentIdentity),
    leftover,
    mutationsRejected: mutations.every((mutation) => mutation.accepted === false),
    registryShared: coverLanguageAndFences(documentIdentity),
    scale: MARKDOWN_TECHNICAL_ACCEPTANCE_SCALES,
    staleRejected: lifecycle.staleRejected,
    version: MARKDOWN_TECHNICAL_ACCEPTANCE_VERSION,
    xssRejected: coverXss(documentIdentity),
  })
  return report
}

export const evaluateMarkdownTechnicalAcceptanceMutations = () =>
  Object.freeze({
    leftover: Object.freeze({
      imeNative: false,
      screenReader: false,
      viewportMatrix: false,
    }),
    mutations: coverMutations(),
  })

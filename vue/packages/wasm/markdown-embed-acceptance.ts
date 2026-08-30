import {
  collectMarkdownEmbedNodes,
  evaluateMarkdownEmbedMutations,
  formatMarkdownEmbedDirective,
  parseMarkdownEmbedLine,
  type MarkdownEmbedMode,
} from './markdown-embed-directive'
import {
  createMarkdownEmbedBudgetSession,
  evaluateMarkdownEmbedBudgetMutations,
  MARKDOWN_EMBED_BUDGET,
  type MarkdownEmbedBudgetFailure,
  type MarkdownEmbedWalkNode,
  type MarkdownEmbedWalkResult,
} from './markdown-embed-budget'
import { evaluateMarkdownEmbedPresentationMutations } from './markdown-embed-presentation'
import { evaluateMarkdownEmbedProviderMutations } from './markdown-embed-provider'

export const MARKDOWN_EMBED_ACCEPTANCE_VERSION =
  'markdown-embed-acceptance@2026-08-28'

export interface MarkdownEmbedSecurityCorpusEntry {
  readonly expectation: 'grammar-rejected' | 'inert-presentation'
  readonly kind: 'xss' | 'dom-clobbering' | 'target-injection' | 'control-char'
  readonly payload: string
}

export const MARKDOWN_EMBED_SECURITY_CORPUS: readonly MarkdownEmbedSecurityCorpusEntry[] =
  Object.freeze([
    Object.freeze({
      expectation: 'inert-presentation' as const,
      kind: 'xss' as const,
      payload: '<img src=x onerror=alert(1)><script>alert(2)</script>',
    }),
    Object.freeze({
      expectation: 'inert-presentation' as const,
      kind: 'xss' as const,
      payload: '<a href="javascript:alert(3)">link</a>',
    }),
    Object.freeze({
      expectation: 'inert-presentation' as const,
      kind: 'dom-clobbering' as const,
      payload: '<form><input name="target"><input name="mode"></form>',
    }),
    Object.freeze({
      expectation: 'grammar-rejected' as const,
      kind: 'target-injection' as const,
      payload: 'note‮mode="article"',
    }),
    Object.freeze({
      expectation: 'grammar-rejected' as const,
      kind: 'control-char' as const,
      payload: 'note\u0007',
    }),
  ])

const scaleSource = (count: number) =>
  Array.from(
    { length: count },
    (_, index) => `::embed[target="note-${index}" mode="article"]\n`,
  ).join('\n')

const walkNode = (targetId: string, bytes = 16): MarkdownEmbedWalkNode => ({
  targetId,
  targetVersion: 1,
  targetToken: targetId,
  mode: 'article',
  bytes,
})

const coverGrammar = () => {
  const valid = parseMarkdownEmbedLine(
    formatMarkdownEmbedDirective('note', 'article'),
  )
  const escaped = parseMarkdownEmbedLine('::embed[target="a\\"b" mode="block"]')
  const modes = (['article', 'heading', 'block'] as const).every((mode) => {
    const parsed = parseMarkdownEmbedLine(
      formatMarkdownEmbedDirective('doc', mode),
    )
    return parsed?.ok && parsed.mode === mode
  })
  const invalid = collectMarkdownEmbedNodes(
    [
      '::embed[target="x" mode="Article"]',
      '::embed[target="" mode="block"]',
      '::embed[mode="block" target="x"]',
      '::embed[target="x" mode="block"] trailing',
      '::embed[target="x" mode="block" extra="y"]',
    ].join('\n'),
  )
  return (
    Boolean(valid?.ok) &&
    Boolean(escaped?.ok) &&
    (escaped?.ok ? escaped.target === 'a"b' : false) &&
    modes &&
    invalid.every((node) => !node.ok)
  )
}

const walkFailureOf = (
  result: MarkdownEmbedWalkResult,
  failure: MarkdownEmbedBudgetFailure,
) => 'failure' in result && result.failure === failure

const coverBudgets = () => {
  const session = createMarkdownEmbedBudgetSession()
  const direct = session.walk({
    root: { ...walkNode('cycle-root'), children: [{ ...walkNode('cycle-root') }] },
    providerVersion: 1,
  })
  const indirect = session.walk({
    root: {
      ...walkNode('a', 8),
      children: [
        {
          ...walkNode('b', 8),
          children: [{ ...walkNode('c', 8), children: [walkNode('a', 8)] }],
        },
      ],
    },
    providerVersion: 1,
  })
  const deep = buildChain(MARKDOWN_EMBED_BUDGET.maxDepth + 2)
  const depthExceeded = session.walk({ root: deep, providerVersion: 1 })
  const sizeExceeded = session.walk({
    root: walkNode('big', MARKDOWN_EMBED_BUDGET.maxBytes + 1),
    providerVersion: 1,
  })
  let fakeClock = 0
  const fixedNow = session.walk({
    root: walkNode('slow', MARKDOWN_EMBED_BUDGET.maxBytes),
    providerVersion: 1,
    now: () => (fakeClock += MARKDOWN_EMBED_BUDGET.maxMs + 1),
  })
  return {
    directCycleRejected: walkFailureOf(direct, 'cycle'),
    indirectCycleRejected: walkFailureOf(indirect, 'cycle'),
    depthRejected: walkFailureOf(depthExceeded, 'depth-exceeded'),
    sizeRejected: walkFailureOf(sizeExceeded, 'size-exceeded'),
    timeRejected: walkFailureOf(fixedNow, 'time-exceeded'),
  }
}

const buildChain = (depth: number): MarkdownEmbedWalkNode => {
  let node = walkNode(`chain-${depth}`)
  for (let level = depth - 1; level >= 0; level -= 1) {
    node = { ...walkNode(`chain-${level}`), children: [node] }
  }
  return node
}

const coverScale = () => {
  const session = createMarkdownEmbedBudgetSession()
  const root = walkNode('root')
  const children = Array.from({ length: MARKDOWN_EMBED_BUDGET.maxNodes - 1 }, (_, index) =>
    walkNode(`node-${index}`),
  )
  const result = session.walk({
    root: { ...root, children },
    providerVersion: 1,
  })
  const released = session.createTask('scale-doc', 1)
  session.abortDocument('scale-doc', 1)
  const cacheBounded = session.cache.size <= MARKDOWN_EMBED_BUDGET.maxCacheEntries
  return {
    withinBudget: result.ok && result.nodes === MARKDOWN_EMBED_BUDGET.maxNodes,
    taskReleased: released.cancelled,
    cacheBounded,
    hostResponsive: result.ok || walkFailureOf(result, 'node-exceeded'),
  }
}

const coverSecurity = () => {
  const source = scaleSource(3)
  const nodes = collectMarkdownEmbedNodes(source)
  const directiveSafe = nodes.every(
    (node) => !node.ok || /^[\w./-]+$/u.test(node.target),
  )
  const controlRejected = parseMarkdownEmbedLine(
    '::embed[target="bad\u0007x" mode="article"]',
  )
  const bidiRejected = parseMarkdownEmbedLine(
    '::embed[target="bad\u202Ex" mode="article"]',
  )
  return {
    directiveSafe,
    controlRejected: Boolean(controlRejected && !controlRejected.ok),
    bidiRejected: Boolean(bidiRejected && !bidiRejected.ok),
    corpus: MARKDOWN_EMBED_SECURITY_CORPUS.length,
  }
}

const coverLifecycle = () => {
  const session = createMarkdownEmbedBudgetSession()
  const key = {
    targetId: 'note',
    targetVersion: 1,
    mode: 'article' as MarkdownEmbedMode,
    providerVersion: 1,
  }
  const identity = session.setCached(key)
  const same = session.getCached(key)
  const otherMode = session.getCached({ ...key, mode: 'heading' })
  const otherVersion = session.getCached({ ...key, targetVersion: 2 })
  const otherProvider = session.getCached({ ...key, providerVersion: 2 })
  return {
    identityStable: identity === same && same === 'note@1',
    keyDiscriminates: !otherMode && !otherVersion && !otherProvider,
  }
}

const coverMutations = () => {
  const grammar = evaluateMarkdownEmbedMutations(
    `${scaleSource(2)}::embed[target="x" mode="Block"]\n::embed[target="y" mode="block"] extra\n`,
  )
  const provider = evaluateMarkdownEmbedProviderMutations({
    requestId: 'r1',
    documentIdentity: { epoch: 1, id: 'doc' },
    revision: 1,
    nodeId: 'n1',
    target: 'note',
    mode: 'article',
    version: 1,
  })
  const budget = evaluateMarkdownEmbedBudgetMutations()
  const presentation = evaluateMarkdownEmbedPresentationMutations()
  const all = [
    ...grammar.mutations,
    ...provider.mutations,
    ...budget.mutations,
    ...presentation.mutations,
  ]
  const byKind = new Map<string, { readonly accepted: boolean; readonly equivalent: boolean }>(
    all.map((mutation) => [
      mutation.kind as string,
      { accepted: mutation.accepted, equivalent: mutation.equivalent },
    ]),
  )
  const killed = (kind: string) => {
    const mutation = byKind.get(kind)
    return Boolean(mutation && mutation.accepted === false && mutation.equivalent === false)
  }
  return Object.freeze({
    aliasKilled: killed('wikilink') && killed('consumer-regex'),
    modeInferenceKilled: killed('inferred-mode'),
    htmlProviderKilled: killed('html-result'),
    cycleOmissionKilled: killed('no-cycle-detection'),
    tokenOnlyCacheKilled: killed('token-only-cache'),
    secondEditorKilled: killed('second-editor'),
    iframeKilled: killed('iframe'),
    innerHtmlKilled: killed('innerHTML'),
    modeCardKilled: killed('mode-card'),
    sourceExpansionKilled: killed('source-expansion'),
    staleCommitKilled: killed('stale-commit') && killed('stale-tree-commit'),
    targetOnlyCacheKilled: killed('target-only-cache'),
  })
}

export interface MarkdownEmbedAcceptanceReport {
  readonly accepted: boolean
  readonly budgets: ReturnType<typeof coverBudgets>
  readonly grammarValid: boolean
  readonly lifecycle: ReturnType<typeof coverLifecycle>
  readonly mutations: ReturnType<typeof coverMutations>
  readonly scale: ReturnType<typeof coverScale>
  readonly security: ReturnType<typeof coverSecurity>
  readonly version: typeof MARKDOWN_EMBED_ACCEPTANCE_VERSION
}

export const evaluateMarkdownEmbedAcceptance = (): MarkdownEmbedAcceptanceReport => {
  const budgets = coverBudgets()
  const scale = coverScale()
  const security = coverSecurity()
  const lifecycle = coverLifecycle()
  const mutations = coverMutations()
  const budgetsOk =
    budgets.directCycleRejected &&
    budgets.indirectCycleRejected &&
    budgets.depthRejected &&
    budgets.sizeRejected &&
    budgets.timeRejected
  const scaleOk =
    scale.withinBudget && scale.taskReleased && scale.cacheBounded
  const securityOk =
    security.directiveSafe && security.controlRejected && security.bidiRejected
  const lifecycleOk = lifecycle.identityStable && lifecycle.keyDiscriminates
  const mutationsOk = Object.values(mutations).every((killed) => killed)
  return Object.freeze({
    accepted: budgetsOk && scaleOk && securityOk && lifecycleOk && mutationsOk,
    budgets: Object.freeze(budgets),
    grammarValid: coverGrammar(),
    lifecycle: Object.freeze(lifecycle),
    mutations: Object.freeze(mutations),
    scale: Object.freeze(scale),
    security: Object.freeze(security),
    version: MARKDOWN_EMBED_ACCEPTANCE_VERSION,
  })
}

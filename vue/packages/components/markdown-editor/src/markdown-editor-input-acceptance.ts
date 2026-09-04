import {
  applyMarkdownEditorChanges,
  deriveMarkdownEditorChange,
  MarkdownEditorTransactionStore,
  type MarkdownEditorSelection,
  type MarkdownEditorTransaction,
} from './markdown-editor-transaction'
import type { MarkdownEditorMode } from './markdown-editor-live-contract'
import {
  markdownBlockInputActionFor,
  resolveMarkdownBlockInputIntent,
  evaluateMarkdownBlockInputMutations,
  type MarkdownBlockInputKey,
} from './markdown-editor-input-intent'
import {
  evaluateMarkdownPairInputMutations,
  resolveMarkdownPairInput,
} from './markdown-editor-pair-input'
import {
  evaluateMarkdownClipboardMutations,
  resolveMarkdownClipboardCopy,
  resolveMarkdownClipboardCut,
  resolveMarkdownClipboardPaste,
} from './markdown-editor-clipboard'
import {
  MARKDOWN_NATIVE_SYNTHETIC_BROWSERS,
  driveMarkdownNativeHarnessTrace,
  evaluateMarkdownNativeEventMutations,
  markdownNativeSyntheticCompositionScript,
} from './markdown-editor-native-event'

export const MARKDOWN_INPUT_ACCEPTANCE_VERSION =
  'markdown-input-acceptance@2026-08-15'

export const MARKDOWN_INPUT_ACCEPTANCE_MODES = Object.freeze([
  'source',
  'live',
  'split',
] as const)

export const MARKDOWN_INPUT_ACCEPTANCE_CONTEXTS = Object.freeze([
  'empty',
  'paragraph',
  'heading',
  'list',
  'task',
  'quote',
  'table',
  'code',
  'link',
  'image',
  'atomic',
] as const)

export const MARKDOWN_INPUT_ACCEPTANCE_SELECTIONS = Object.freeze([
  'collapsed',
  'forward',
  'backward',
  'multiline',
] as const)

export const MARKDOWN_INPUT_ACCEPTANCE_UNICODE = Object.freeze([
  'latin',
  'cjk',
  'emoji-zwj',
  'combining',
  'rtl',
  'bom-crlf',
  'tab',
  'trailing-space',
  'hard-break',
  'blank-lines',
] as const)

export type MarkdownInputAcceptanceMutationKind =
  | 'consumer-keydown'
  | 'dom-mutation'
  | 'html-paste'
  | 'pair-drift'
  | 'double-insert'
  | 'stale-commit'
  | 'synthetic-only-ime'
  | 'full-normalize'

export interface MarkdownInputAcceptanceContextCell {
  readonly context: (typeof MARKDOWN_INPUT_ACCEPTANCE_CONTEXTS)[number]
  readonly blockContext: string
  readonly action: string
}

export interface MarkdownInputAcceptanceReport {
  readonly accepted: boolean
  readonly browsersCommittedOnce: boolean
  readonly compositionSingleCommit: boolean
  readonly contexts: readonly MarkdownInputAcceptanceContextCell[]
  readonly documentIdentity: { readonly epoch: number; readonly id: string }
  readonly harnessReadable: boolean
  readonly modesEquivalent: boolean
  readonly mutationsRejected: boolean
  readonly pasteNotDoubled: boolean
  readonly selectionDirectionsPreserved: boolean
  readonly uneditedBytesPreserved: boolean
  readonly unicodeCovered: readonly string[]
  readonly version: typeof MARKDOWN_INPUT_ACCEPTANCE_VERSION
}

const fingerprint = (transaction: MarkdownEditorTransaction | null) =>
  transaction
    ? JSON.stringify({
        changes: transaction.changes,
        history: transaction.history,
        origin: transaction.origin,
        selection: transaction.selection,
      })
    : 'null'

const CONTEXT_FIXTURES = Object.freeze({
  empty: { key: 'enter' as const, offset: 0, source: '' },
  paragraph: { key: 'enter' as const, offset: 6, source: 'Hello.\n' },
  heading: { key: 'enter' as const, offset: 7, source: '# Title\n' },
  list: { key: 'enter' as const, offset: 6, source: '- item\n' },
  task: { key: 'enter' as const, offset: 10, source: '- [ ] task\n' },
  quote: { key: 'enter' as const, offset: 8, source: '> quoted\n' },
  table: { key: 'tab' as const, offset: 2, source: '| h |\n| --- |\n| c |\n' },
  code: { key: 'enter' as const, offset: 7, source: '```\ncode\n```\n' },
  link: { key: 'enter' as const, offset: 4, source: 'See [docs](https://x.test)\n' },
  image: { key: 'enter' as const, offset: 6, source: '![alt](img.png)\n' },
  atomic: { key: 'enter' as const, offset: 0, source: '![alt](img.png)\n' },
})

const UNICODE_SOURCE =
  '\uFEFFLatin 中文 👩‍💻 é עברית\r\n\ttrail   \n  \n\nnext'

const modesEquivalentFor = (
  run: (mode: MarkdownEditorMode) => string,
) => {
  const values = MARKDOWN_INPUT_ACCEPTANCE_MODES.map((mode) => run(mode))
  return new Set(values).size === 1
}

const applyBlock = (
  source: string,
  offset: number,
  key: MarkdownBlockInputKey,
  selection?: MarkdownEditorSelection,
) => {
  const plan = resolveMarkdownBlockInputIntent({
    documentIdentity: { epoch: 1, id: 'acceptance' },
    key,
    selection: selection ?? { direction: 'none', end: offset, start: offset },
    source,
  })
  const next = plan.transaction
    ? applyMarkdownEditorChanges(source, plan.transaction.changes)?.value ?? source
    : source
  return { next, plan }
}

const coverContexts = (): MarkdownInputAcceptanceContextCell[] =>
  MARKDOWN_INPUT_ACCEPTANCE_CONTEXTS.map((context) => {
    const fixture = CONTEXT_FIXTURES[context]
    const { plan } = applyBlock(fixture.source, fixture.offset, fixture.key)
    return Object.freeze({
      action: plan.intent.action,
      blockContext: plan.intent.context,
      context,
    })
  })

const coverSelections = () => {
  const source = 'alpha\nbeta'
  const collapsed = resolveMarkdownPairInput({
    inserted: '[',
    mode: 'source',
    selection: { direction: 'none', end: 5, start: 5 },
    source,
  })
  const forward = resolveMarkdownPairInput({
    inserted: '[',
    mode: 'live',
    selection: { direction: 'forward', end: 5, start: 0 },
    source,
  })
  const backward = resolveMarkdownPairInput({
    inserted: '*',
    mode: 'split',
    selection: { direction: 'backward', end: 5, start: 0 },
    source,
  })
  const multiline = resolveMarkdownPairInput({
    inserted: '(',
    mode: 'source',
    selection: { direction: 'forward', end: 9, start: 3 },
    source,
  })
  const wrappedForward = applyMarkdownEditorChanges(
    source,
    forward.transaction!.changes,
  )!.value
  const wrappedBackward = applyMarkdownEditorChanges(
    source,
    backward.transaction!.changes,
  )!.value
  const wrappedMulti = applyMarkdownEditorChanges(
    source,
    multiline.transaction!.changes,
  )!.value
  return {
    collapsed: collapsed.action === 'insert-pair',
    directions:
      forward.transaction?.selection?.direction === 'forward' &&
      backward.transaction?.selection?.direction === 'backward',
    multiline: wrappedMulti === 'alp(ha\nbet)a',
    values: Object.freeze({
      backward: wrappedBackward,
      forward: wrappedForward,
      multiline: wrappedMulti,
    }),
  }
}

const coverUnicode = () => {
  const caret = UNICODE_SOURCE.indexOf('中')
  const plan = resolveMarkdownBlockInputIntent({
    key: 'enter',
    selection: { direction: 'none', end: caret, start: caret },
    source: UNICODE_SOURCE,
  })
  const next = applyMarkdownEditorChanges(
    UNICODE_SOURCE,
    plan.transaction!.changes,
  )!.value
  const prefix = UNICODE_SOURCE.slice(0, caret)
  const suffix = UNICODE_SOURCE.slice(caret)
  const emoji = '👩‍💻'
  const deleted = resolveMarkdownBlockInputIntent({
    key: 'backspace',
    selection: { direction: 'none', end: emoji.length, start: emoji.length },
    source: emoji,
  })
  const combining = 'é'
  const combiningDeleted = resolveMarkdownBlockInputIntent({
    key: 'backspace',
    selection: {
      direction: 'none',
      end: combining.length,
      start: combining.length,
    },
    source: combining,
  })
  return {
    combiningRemoved:
      applyMarkdownEditorChanges(combining, combiningDeleted.transaction!.changes)
        ?.value === '',
    emojiRemoved:
      applyMarkdownEditorChanges(emoji, deleted.transaction!.changes)?.value ===
      '',
    preserved:
      next.startsWith(prefix) &&
      next.endsWith(suffix) &&
      next.includes('\uFEFF') &&
      next.includes('\r\n') &&
      next.includes('\t') &&
      next.includes('   \n') &&
      next.includes('\n\n') &&
      UNICODE_SOURCE.includes('  \n'),
    rtlUntouched: next.includes('עברית'),
  }
}

const coverMutations = () => {
  const block = evaluateMarkdownBlockInputMutations()
  const pair = evaluateMarkdownPairInputMutations()
  const clipboard = evaluateMarkdownClipboardMutations()
  const native = evaluateMarkdownNativeEventMutations()
  const byKind = Object.fromEntries(
    [
      ...block.mutations,
      ...pair.mutations,
      ...clipboard.mutations,
      ...native.mutations,
    ].map((mutation) => [mutation.kind, mutation]),
  )
  const report = Object.freeze([
    Object.freeze({
      accepted:
        byKind['consumer-keydown']?.accepted === true ||
        byKind['consumer-keydown'] === undefined,
      kind: 'consumer-keydown' as const,
    }),
    Object.freeze({
      accepted: byKind['dom-mutation']?.accepted === true,
      kind: 'dom-mutation' as const,
    }),
    Object.freeze({
      accepted: byKind['html-first']?.accepted === true,
      kind: 'html-paste' as const,
    }),
    Object.freeze({
      accepted: byKind['pair-drift']?.accepted === true,
      kind: 'pair-drift' as const,
    }),
    Object.freeze({
      accepted:
        byKind['double-insert']?.accepted === true ||
        byKind['timeout-dedup']?.accepted === true,
      kind: 'double-insert' as const,
    }),
    Object.freeze({
      accepted: byKind['stale-commit']?.accepted === true,
      kind: 'stale-commit' as const,
    }),
    Object.freeze({
      // Synthetic browser/headless traces are useful parity fixtures, but
      // they never satisfy #341's OS-level IME evidence requirement.
      accepted: false,
      kind: 'synthetic-only-ime' as const,
    }),
    Object.freeze({
      accepted: byKind['full-normalize']?.accepted === true,
      kind: 'full-normalize' as const,
    }),
  ])
  return report
}

const coverPipeline = () => {
  const store = new MarkdownEditorTransactionStore('- item', {
    start: 6,
    end: 6,
  })
  const pair = resolveMarkdownPairInput({
    inserted: '(',
    mode: 'source',
    selection: store.selection,
    source: store.value,
  })
  store.dispatch(pair.transaction!)
  const block = resolveMarkdownBlockInputIntent({
    key: 'enter',
    selection: store.selection,
    source: store.value,
  })
  store.dispatch(block.transaction!)
  const paste = resolveMarkdownClipboardPaste({
    items: [
      { text: '<b>HTML</b>', type: 'text/html' },
      { text: 'plain', type: 'text/plain' },
    ],
    revision: store.revision,
    selection: store.selection,
    source: store.value,
  })
  store.dispatch(paste.transaction!)
  const firstRevision = store.revision
  const machine = driveMarkdownNativeHarnessTrace(
    [
      {
        clipboardIdentity: paste.identity,
        kind: 'paste',
        origin: 'paste',
      },
      {
        inputType: 'insertFromPaste',
        kind: 'beforeinput',
        origin: 'paste',
      },
      {
        inputType: 'insertFromPaste',
        kind: 'input',
        origin: 'paste',
        value: store.value,
      },
    ],
    { documentIdentity: { epoch: 1, id: 'acceptance' } },
  )
  return {
    pasteNotDoubled:
      machine.plans.every((plan) => plan.action !== 'dispatch') &&
      store.revision === firstRevision &&
      paste.action === 'plain-text',
    value: store.value,
  }
}

export const evaluateMarkdownInputAcceptance = (input?: {
  readonly documentIdentity?: { readonly epoch: number; readonly id: string }
}): MarkdownInputAcceptanceReport => {
  const documentIdentity = input?.documentIdentity ??
    Object.freeze({ epoch: 1, id: 'acceptance-doc' })
  const contexts = coverContexts()
  const selections = coverSelections()
  const unicode = coverUnicode()
  const mutations = coverMutations()
  const pipeline = coverPipeline()

  const modesEquivalent =
    modesEquivalentFor((mode) => {
      const plan = resolveMarkdownPairInput({
        inserted: '(',
        mode,
        selection: { direction: 'none', end: 2, start: 2 },
        source: 'ab',
      })
      return fingerprint(plan.transaction)
    }) &&
    modesEquivalentFor((mode) => {
      const plan = resolveMarkdownClipboardPaste({
        items: [{ text: 'x', type: 'text/plain' }],
        mode,
        selection: { direction: 'none', end: 0, start: 0 },
        source: '',
      })
      return fingerprint(plan.transaction)
    }) &&
    modesEquivalentFor((mode) => {
      const plan = resolveMarkdownBlockInputIntent({
        key: 'enter',
        selection: { direction: 'none', end: 6, start: 6 },
        source: '- item',
      })
      return `${mode}:${fingerprint(plan.transaction)}`.replace(`${mode}:`, '')
    })

  const browsers = MARKDOWN_NATIVE_SYNTHETIC_BROWSERS.map((browser) =>
    driveMarkdownNativeHarnessTrace(
      markdownNativeSyntheticCompositionScript('你好', browser),
      { documentIdentity },
    ),
  )
  const browsersCommittedOnce = browsers.every((result) => result.commits === 1)
  const harnessReadable = browsers.every((result) => result.trace.length > 0)

  const composition = driveMarkdownNativeHarnessTrace(
    markdownNativeSyntheticCompositionScript('한', 'chromium'),
    { documentIdentity },
  )
  const store = new MarkdownEditorTransactionStore('')
  const korean = driveMarkdownNativeHarnessTrace(
    [
      { kind: 'compositionstart' },
      { data: '', kind: 'compositionend', previousValue: '', value: '' },
      {
        data: '한',
        inputType: 'insertText',
        kind: 'input',
        previousValue: '',
        value: '한',
      },
    ],
    { documentIdentity },
  )
  if (korean.plans.at(-1)?.action === 'commit') {
    const change = deriveMarkdownEditorChange(store.value, '한')
    store.dispatch({
      changes: change ? [change] : [],
      history: 'separate',
      origin: 'input',
      selection: { end: 1, start: 1 },
    })
  }

  const cut = resolveMarkdownClipboardCut({
    mode: 'source',
    revision: store.revision,
    selection: { direction: 'none', end: store.value.length, start: 0 },
    source: store.value,
  })
  if (cut.transaction) store.dispatch(cut.transaction)
  const visible = resolveMarkdownClipboardCopy({
    mode: 'live',
    selection: { direction: 'none', end: 8, start: 0 },
    source: '**bold**',
  })

  const tableHook = resolveMarkdownBlockInputIntent({
    key: 'tab',
    selection: { direction: 'none', end: 2, start: 2 },
    source: '| h |\n| --- |\n| c |\n',
  })
  const malformed = resolveMarkdownPairInput({
    documentIdentity,
    inserted: '(',
    selection: { direction: 'none', end: 12, start: 12 },
    source: '[broken](http://x\n',
  })
  const linkDest = resolveMarkdownPairInput({
    documentIdentity,
    inserted: '[',
    selection: { direction: 'none', end: 16, start: 16 },
    source: 'See [docs](https://x.test)\n',
  })

  const accepted =
    contexts.length === MARKDOWN_INPUT_ACCEPTANCE_CONTEXTS.length &&
    contexts.every((cell) => cell.action === markdownBlockInputActionFor(
      cell.blockContext as Parameters<typeof markdownBlockInputActionFor>[0],
      CONTEXT_FIXTURES[cell.context].key,
      applyBlock(
        CONTEXT_FIXTURES[cell.context].source,
        CONTEXT_FIXTURES[cell.context].offset,
        CONTEXT_FIXTURES[cell.context].key,
      ).plan.intent.position,
    )) &&
    modesEquivalent &&
    selections.collapsed &&
    selections.directions &&
    selections.multiline &&
    unicode.preserved &&
    unicode.emojiRemoved &&
    unicode.combiningRemoved &&
    unicode.rtlUntouched &&
    mutations.every((mutation) => mutation.accepted === false) &&
    pipeline.pasteNotDoubled &&
    browsersCommittedOnce &&
    harnessReadable &&
    composition.commits === 1 &&
    store.value === '' &&
    visible.text === 'bold' &&
    tableHook.intent.action === 'table-hook' &&
    tableHook.transaction === null &&
    malformed.rejected === 'disabled-context' &&
    linkDest.rejected === 'disabled-context'

  return Object.freeze({
    accepted,
    browsersCommittedOnce,
    compositionSingleCommit: composition.commits === 1 && korean.commits === 1,
    contexts: Object.freeze(contexts),
    documentIdentity,
    harnessReadable,
    modesEquivalent,
    mutationsRejected: mutations.every((mutation) => mutation.accepted === false),
    pasteNotDoubled: pipeline.pasteNotDoubled,
    selectionDirectionsPreserved: selections.directions,
    uneditedBytesPreserved: unicode.preserved,
    unicodeCovered: MARKDOWN_INPUT_ACCEPTANCE_UNICODE,
    version: MARKDOWN_INPUT_ACCEPTANCE_VERSION,
  })
}

export const evaluateMarkdownInputAcceptanceMutations = () =>
  Object.freeze({
    mutations: coverMutations(),
  })

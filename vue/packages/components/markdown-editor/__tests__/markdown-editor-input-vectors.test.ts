import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  createMarkdownEditorProjection,
  stabilizeMarkdownEditorProjection,
} from '../../../wasm/markdown-runtime'
import { resolveMarkdownClipboardPaste } from '../src/markdown-editor-clipboard'
import { resolveMarkdownBlockInputIntent } from '../src/markdown-editor-input-intent'
import { createMarkdownEditorNativeEventMachine } from '../src/markdown-editor-native-event'
import { resolveMarkdownPairInput } from '../src/markdown-editor-pair-input'

import type { MarkdownEditorSelection } from '../src/markdown-editor-transaction'
import type { MarkdownNativeEventInput } from '../src/markdown-editor-native-event'

const VECTOR_PATH = resolve(
  process.cwd(),
  'spec/avalonia/markdown-editor-input-vectors.json',
)
const PRODUCE = process.env.FSUS_MARKDOWN_INPUT_VECTORS === '1'

interface BlockScenario {
  readonly composing?: boolean
  readonly id: string
  readonly key: 'backspace' | 'delete' | 'enter' | 'shift-enter' | 'shift-tab' | 'tab'
  readonly selection: MarkdownEditorSelection
  readonly source: string
}

interface PairScenario {
  readonly composing?: boolean
  readonly id: string
  readonly inserted?: string
  readonly key?: 'backspace'
  readonly mode?: 'live' | 'preview' | 'source' | 'split'
  readonly readonly?: boolean
  readonly selection: MarkdownEditorSelection
  readonly source: string
}

interface ClipboardScenario {
  readonly composing?: boolean
  readonly currentIdentity?: { readonly epoch: number; readonly id: string }
  readonly disabled?: boolean
  readonly documentIdentity?: { readonly epoch: number; readonly id: string }
  readonly expectedRevision?: number
  readonly files?: readonly { readonly name: string; readonly size: number; readonly type: string }[]
  readonly id: string
  readonly items?: readonly { readonly text?: string; readonly type: string }[]
  readonly maxPasteUnits?: number
  readonly mode?: 'live' | 'preview' | 'source' | 'split'
  readonly origin?: 'drop' | 'paste'
  readonly readonly?: boolean
  readonly revision?: number
  readonly selection: MarkdownEditorSelection
  readonly source: string
}

interface CompositionScenario {
  readonly events: readonly MarkdownNativeEventInput[]
  readonly id: string
  readonly identity?: { readonly epoch: number; readonly id: string }
  readonly revision?: number
}

const collapsed = (offset: number): MarkdownEditorSelection => ({
  direction: 'none',
  end: offset,
  start: offset,
})

const range = (
  start: number,
  end: number,
  direction: 'backward' | 'forward' = 'forward',
): MarkdownEditorSelection => ({ direction, end, start })

const CODE_SOURCE = '```js\nconst a = 1\n```'
const TABLE_SOURCE = '| a | b |\n| - | - |\n| 1 | 2 |'

const blockScenarios: readonly BlockScenario[] = [
  { id: 'paragraph-enter-middle', key: 'enter', selection: collapsed(5), source: 'hello world' },
  { id: 'paragraph-enter-end', key: 'enter', selection: collapsed(5), source: 'hello' },
  { id: 'paragraph-shift-enter-middle', key: 'shift-enter', selection: collapsed(5), source: 'hello world' },
  { id: 'paragraph-backspace-middle', key: 'backspace', selection: collapsed(2), source: 'hello' },
  { id: 'paragraph-delete-middle', key: 'delete', selection: collapsed(2), source: 'hello' },
  { id: 'paragraph-tab', key: 'tab', selection: collapsed(2), source: 'hello' },
  { id: 'paragraph-document-start-backspace', key: 'backspace', selection: collapsed(0), source: 'abc' },
  { id: 'paragraph-document-end-delete', key: 'delete', selection: collapsed(3), source: 'abc' },
  { id: 'paragraph-selection-enter', key: 'enter', selection: range(0, 5), source: 'hello world' },
  { id: 'heading-enter-end', key: 'enter', selection: collapsed(7), source: '# Title' },
  { id: 'heading-backspace-after-marker', key: 'backspace', selection: collapsed(2), source: '# Title' },
  { id: 'list-enter-content', key: 'enter', selection: collapsed(6), source: '- item' },
  { id: 'list-enter-empty', key: 'enter', selection: collapsed(2), source: '- ' },
  { id: 'list-tab-indent', key: 'tab', selection: collapsed(6), source: '- item' },
  { id: 'list-shift-tab-outdent', key: 'shift-tab', selection: collapsed(8), source: '  - item' },
  { id: 'list-backspace-strip-marker', key: 'backspace', selection: collapsed(2), source: '- item' },
  { id: 'task-enter-content', key: 'enter', selection: collapsed(10), source: '- [ ] todo' },
  { id: 'task-enter-empty', key: 'enter', selection: collapsed(6), source: '- [ ] ' },
  { id: 'quote-enter-content', key: 'enter', selection: collapsed(8), source: '> quoted' },
  { id: 'quote-enter-empty', key: 'enter', selection: collapsed(2), source: '> ' },
  { id: 'quote-backspace-strip-marker', key: 'backspace', selection: collapsed(2), source: '> quoted' },
  { id: 'code-enter', key: 'enter', selection: collapsed(15), source: CODE_SOURCE },
  { id: 'code-tab-insert-spaces', key: 'tab', selection: collapsed(15), source: CODE_SOURCE },
  { id: 'table-enter-cell', key: 'enter', selection: collapsed(12), source: TABLE_SOURCE },
  { id: 'atomic-enter-image', key: 'enter', selection: collapsed(11), source: 'text ![alt](u) more' },
  { id: 'list-enter-composing', composing: true, key: 'enter', selection: collapsed(6), source: '- item' },
  { id: 'multiline-tab-indent-selection', key: 'tab', selection: range(0, 5), source: 'a\nb\nc' },
  { id: 'multiline-shift-tab-outdent-selection', key: 'shift-tab', selection: range(0, 11), source: '  a\n  b\n  c' },
  { id: 'cjk-enter-middle', key: 'enter', selection: collapsed(2), source: '你好世界' },
  { id: 'emoji-zwj-backspace-end', key: 'backspace', selection: collapsed(8), source: '👨‍👩‍👧' },
  { id: 'combining-delete', key: 'delete', selection: collapsed(1), source: 'e\u0301x' },
  { id: 'rtl-enter-middle', key: 'enter', selection: collapsed(5), source: 'שלום עולם' },
  { id: 'bom-crlf-enter', key: 'enter', selection: collapsed(5), source: '\uFEFFa\r\nb' },
]

const pairScenarios: readonly PairScenario[] = [
  { id: 'pair-star-collapsed', inserted: '*', selection: collapsed(2), source: 'ab' },
  { id: 'pair-backtick-collapsed', inserted: '`', selection: collapsed(2), source: 'ab' },
  { id: 'pair-paren-collapsed', inserted: '(', selection: collapsed(2), source: 'ab' },
  { id: 'pair-bracket-collapsed', inserted: '[', selection: collapsed(2), source: 'ab' },
  { id: 'pair-brace-collapsed', inserted: '{', selection: collapsed(2), source: 'ab' },
  { id: 'pair-double-quote-collapsed', inserted: '"', selection: collapsed(2), source: 'ab' },
  { id: 'pair-skip-close-star', inserted: '*', selection: collapsed(1), source: 'a*b' },
  { id: 'pair-skip-close-paren', inserted: ')', selection: collapsed(3), source: 'a(b)' },
  { id: 'pair-fence-trigger', inserted: '`', selection: collapsed(2), source: '``' },
  { id: 'pair-apostrophe-after-word', inserted: "'", selection: collapsed(2), source: 'ab' },
  { id: 'pair-link-destination-disabled', inserted: '(', selection: collapsed(5), source: '[a](url)' },
  { id: 'pair-backspace-inside-star', key: 'backspace', selection: collapsed(2), source: 'a**b' },
  { id: 'pair-wrap-selection-star', inserted: '*', selection: range(0, 5), source: 'hello' },
  { id: 'pair-composing', composing: true, inserted: '*', selection: collapsed(2), source: 'ab' },
  { id: 'pair-readonly', inserted: '*', readonly: true, selection: collapsed(2), source: 'ab' },
  { id: 'pair-preview-mode', inserted: '*', mode: 'preview', selection: collapsed(2), source: 'ab' },
  { id: 'pair-cjk-adjacent', inserted: '(', selection: collapsed(2), source: '你好' },
  { id: 'pair-emoji-adjacent', inserted: '*', selection: collapsed(2), source: '👍' },
  { id: 'pair-inside-code-span', inserted: '*', selection: collapsed(4), source: '`code`' },
  { id: 'pair-word-boundary-strong', inserted: '*', selection: collapsed(3), source: 'abc' },
]

const clipboardScenarios: readonly ClipboardScenario[] = [
  {
    id: 'clipboard-markdown-mime-wins',
    items: [
      { text: '**md**', type: 'text/markdown' },
      { text: 'plain', type: 'text/plain' },
    ],
    selection: collapsed(2),
    source: 'ab',
  },
  {
    id: 'clipboard-html-with-plain',
    items: [
      { text: '<b>x</b>', type: 'text/html' },
      { text: 'x', type: 'text/plain' },
    ],
    selection: collapsed(2),
    source: 'ab',
  },
  { id: 'clipboard-plain-only', items: [{ text: 'plain', type: 'text/plain' }], selection: collapsed(2), source: 'ab' },
  {
    id: 'clipboard-file-attachment-intent',
    files: [{ name: 'a.png', size: 10, type: 'image/png' }],
    selection: collapsed(2),
    source: 'ab',
  },
  { id: 'clipboard-composing', composing: true, items: [{ text: 'x', type: 'text/plain' }], selection: collapsed(2), source: 'ab' },
  {
    id: 'clipboard-stale-revision',
    expectedRevision: 0,
    items: [{ text: 'x', type: 'text/plain' }],
    revision: 3,
    selection: collapsed(2),
    source: 'ab',
  },
  { id: 'clipboard-readonly', items: [{ text: 'x', type: 'text/plain' }], readonly: true, selection: collapsed(2), source: 'ab' },
  { id: 'clipboard-disabled', disabled: true, items: [{ text: 'x', type: 'text/plain' }], selection: collapsed(2), source: 'ab' },
  { id: 'clipboard-drop-origin', items: [{ text: 'x', type: 'text/plain' }], origin: 'drop', selection: collapsed(2), source: 'ab' },
  {
    id: 'clipboard-cjk-emoji-rtl-bom',
    items: [{ text: '你好👨‍👩‍👧\u05E9\u05DC\u05D5\u05DD\uFEFF\r\n', type: 'text/markdown' }],
    selection: collapsed(2),
    source: 'ab',
  },
  { id: 'clipboard-max-units-exceeded', items: [{ text: 'abcdef', type: 'text/plain' }], maxPasteUnits: 3, selection: collapsed(2), source: 'ab' },
  { id: 'clipboard-empty-noop', selection: collapsed(2), source: 'ab' },
  {
    id: 'clipboard-document-switch-rejects-old-identity',
    currentIdentity: { epoch: 2, id: 'doc-b' },
    documentIdentity: { epoch: 1, id: 'doc-a' },
    items: [{ text: 'x', type: 'text/plain' }],
    selection: collapsed(2),
    source: 'ab',
  },
]

const compositionScenarios: readonly CompositionScenario[] = [
  {
    id: 'composition-cjk-commit',
    identity: { epoch: 1, id: 'doc' },
    events: [
      { data: 'n', kind: 'compositionstart', selection: collapsed(0), value: '' },
      { data: 'ni', kind: 'compositionupdate', selection: collapsed(0), value: '' },
      { data: 'nih', kind: 'compositionupdate', selection: collapsed(0), value: '' },
      { data: '你好', kind: 'compositionend', selection: collapsed(0), value: '' },
      { data: '你好', inputType: 'insertCompositionText', isComposing: false, kind: 'input', revision: 0, selection: collapsed(0), value: '你好' },
    ],
  },
  {
    id: 'composition-cancel',
    identity: { epoch: 1, id: 'doc' },
    events: [
      { data: 'n', kind: 'compositionstart', selection: collapsed(0), value: '' },
      { data: 'ni', kind: 'compositionupdate', selection: collapsed(0), value: '' },
      { data: '', kind: 'compositionend', selection: collapsed(0), value: '' },
      { data: 'x', inputType: 'insertText', kind: 'beforeinput', selection: collapsed(0), value: '' },
      { data: 'x', inputType: 'insertText', kind: 'input', revision: 0, selection: collapsed(1), value: 'x' },
    ],
  },
  {
    id: 'composition-stale-commit-after-document-switch',
    identity: { epoch: 1, id: 'doc-a' },
    events: [
      { data: 'n', kind: 'compositionstart', selection: collapsed(0), value: '' },
      { currentIdentity: { epoch: 2, id: 'doc-b' }, kind: 'document-switch', selection: collapsed(0), value: 'other' },
      { data: '你', documentIdentity: { epoch: 1, id: 'doc-a' }, kind: 'compositionend', selection: collapsed(0), value: '' },
    ],
  },
  {
    id: 'composition-emoji-zwj-commit',
    identity: { epoch: 1, id: 'doc' },
    events: [
      { data: '👨', kind: 'compositionstart', selection: collapsed(0), value: '' },
      { data: '👨‍👩‍👧', kind: 'compositionend', selection: collapsed(0), value: '' },
      { data: '👨‍👩‍👧', inputType: 'insertCompositionText', kind: 'input', revision: 0, selection: collapsed(0), value: '👨‍👩‍👧' },
    ],
  },
  {
    id: 'composition-combining-commit',
    identity: { epoch: 1, id: 'doc' },
    events: [
      { data: 'e', kind: 'compositionstart', selection: collapsed(0), value: '' },
      { data: 'e\u0301', kind: 'compositionend', selection: collapsed(0), value: '' },
      { data: 'e\u0301', inputType: 'insertCompositionText', kind: 'input', revision: 0, selection: collapsed(0), value: 'e\u0301' },
    ],
  },
  {
    id: 'composition-rtl-commit',
    identity: { epoch: 1, id: 'doc' },
    events: [
      { data: 'ש', kind: 'compositionstart', selection: collapsed(0), value: '' },
      { data: 'שלום', kind: 'compositionend', selection: collapsed(0), value: '' },
      { data: 'שלום', inputType: 'insertCompositionText', kind: 'input', revision: 0, selection: collapsed(0), value: 'שלום' },
    ],
  },
  {
    id: 'composition-crlf-commit',
    identity: { epoch: 1, id: 'doc' },
    events: [
      { data: 'a', kind: 'compositionstart', selection: collapsed(0), value: '' },
      { data: 'a\r\nb', kind: 'compositionend', selection: collapsed(0), value: '' },
      { data: 'a\r\nb', inputType: 'insertCompositionText', kind: 'input', revision: 0, selection: collapsed(0), value: 'a\r\nb' },
    ],
  },
  {
    id: 'composition-paste-rejected-while-composing',
    identity: { epoch: 1, id: 'doc' },
    events: [
      { data: 'n', kind: 'compositionstart', selection: collapsed(0), value: '' },
      { clipboardIdentity: 'native:clip1', data: 'x', kind: 'paste', origin: 'paste', revision: 0, selection: collapsed(0), value: '' },
      { data: '你', kind: 'compositionend', selection: collapsed(0), value: '' },
      { data: '你', inputType: 'insertCompositionText', kind: 'input', revision: 0, selection: collapsed(0), value: '你' },
    ],
  },
  {
    id: 'composition-undo-after-commit',
    identity: { epoch: 1, id: 'doc' },
    events: [
      { data: 'n', kind: 'compositionstart', selection: collapsed(0), value: '' },
      { data: '你好', kind: 'compositionend', selection: collapsed(0), value: '' },
      { data: '你好', inputType: 'insertCompositionText', kind: 'input', revision: 0, selection: collapsed(0), value: '你好' },
    ],
  },
  {
    id: 'composition-same-source-different-document',
    identity: { epoch: 7, id: 'doc-b' },
    revision: 2,
    events: [
      { data: 'n', kind: 'compositionstart', selection: collapsed(0), value: '' },
      { data: '你', kind: 'compositionend', selection: collapsed(0), value: '' },
      { data: '你', inputType: 'insertCompositionText', kind: 'input', revision: 2, selection: collapsed(0), value: '你' },
    ],
  },
]

const blockProjectionFor = (source: string) =>
  stabilizeMarkdownEditorProjection(createMarkdownEditorProjection(source), {
    epoch: 0,
    id: 'editor',
  })

const blockProjectionNodes = (source: string) =>
  blockProjectionFor(source).nodes.map((node) => ({
    end: node.rawRange.end,
    id: node.id,
    kind: node.kind,
    start: node.rawRange.start,
  }))

const runBlock = (scenario: BlockScenario) =>
  resolveMarkdownBlockInputIntent({
    composing: scenario.composing,
    key: scenario.key,
    projection: blockProjectionFor(scenario.source),
    selection: scenario.selection,
    source: scenario.source,
  })

const runPair = (scenario: PairScenario) =>
  resolveMarkdownPairInput({
    composing: scenario.composing,
    inserted: scenario.inserted,
    key: scenario.key,
    mode: scenario.mode,
    readonly: scenario.readonly,
    selection: scenario.selection,
    source: scenario.source,
  })

const runClipboard = (scenario: ClipboardScenario) =>
  resolveMarkdownClipboardPaste({
    composing: scenario.composing,
    currentIdentity: scenario.currentIdentity,
    disabled: scenario.disabled,
    documentIdentity: scenario.documentIdentity,
    expectedRevision: scenario.expectedRevision,
    files: scenario.files,
    items: scenario.items,
    maxPasteUnits: scenario.maxPasteUnits,
    mode: scenario.mode,
    origin: scenario.origin,
    readonly: scenario.readonly,
    revision: scenario.revision,
    selection: scenario.selection,
    source: scenario.source,
  })

const runComposition = (scenario: CompositionScenario) => {
  const machine = createMarkdownEditorNativeEventMachine({
    documentIdentity: scenario.identity,
    revision: scenario.revision,
  })
  const plans = scenario.events.map((event) => {
    const plan = machine.apply(event)
    return {
      action: plan.action,
      composition: plan.composition,
      freezeSmartInput: plan.freezeSmartInput,
      history: plan.history,
      identity: plan.identity,
      mergeDirection: plan.mergeDirection,
      origin: plan.origin,
      phase: plan.phase,
      preventDefault: plan.preventDefault,
      ...(plan.rejected ? { rejected: plan.rejected } : {}),
      restoreDisplay: plan.restoreDisplay,
      ...(plan.snapshot
        ? {
            snapshot: {
              data: plan.snapshot.data,
              inputType: plan.snapshot.inputType,
              selection: plan.snapshot.selection,
              value: plan.snapshot.value,
            },
          }
        : {}),
    }
  })
  return {
    plans,
    final: {
      composing: machine.composing,
      freezeSmartInput: machine.freezeSmartInput,
      phase: machine.phase,
      trace: machine.trace.map((entry) => ({
        action: entry.action,
        ...(entry.browser ? { browser: entry.browser } : {}),
        identity: entry.identity,
        ...(entry.inputType ? { inputType: entry.inputType } : {}),
        kind: entry.kind,
        phase: entry.phase,
        ...(entry.rejected ? { rejected: entry.rejected } : {}),
        ...(entry.revision === undefined ? {} : { revision: entry.revision }),
      })),
    },
  }
}

const serialize = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value ?? null))

const produce = () => ({
  schema: 'fsusui.markdown-editor-input-vectors.v1',
  contract: 'markdown-editor-input@2026-08-15',
  blockInput: blockScenarios.map((scenario) => ({
    ...scenario,
    projection: { nodes: blockProjectionNodes(scenario.source) },
    expected: serialize(runBlock(scenario)),
  })),
  pairInput: pairScenarios.map((scenario) => ({
    ...scenario,
    expected: serialize(runPair(scenario)),
  })),
  clipboard: clipboardScenarios.map((scenario) => ({
    ...scenario,
    expected: serialize(runClipboard(scenario)),
  })),
  composition: compositionScenarios.map((scenario) => ({
    id: scenario.id,
    identity: scenario.identity ?? null,
    revision: scenario.revision ?? 0,
    events: scenario.events,
    expected: serialize(runComposition(scenario)),
  })),
})

describe('MarkdownEditor shared Web/Avalonia input vectors', () => {
  if (PRODUCE) {
    it('regenerates the frozen input vector file', () => {
      writeFileSync(VECTOR_PATH, `${JSON.stringify(produce(), null, 2)}\n`)
      expect(existsSync(VECTOR_PATH)).toBe(true)
    })
    return
  }

  const vectors = JSON.parse(readFileSync(VECTOR_PATH, 'utf8')) as ReturnType<typeof produce>

  it('freezes block input intents for every context, key, and unicode class', () => {
    for (const vector of vectors.blockInput) {
      const scenario = blockScenarios.find((entry) => entry.id === vector.id)
      expect(scenario, `missing local scenario for ${vector.id}`).toBeDefined()
      expect(runBlock(scenario!), vector.id).toEqual(vector.expected)
    }
    expect(vectors.blockInput).toHaveLength(blockScenarios.length)
  })

  it('freezes pair input plans including composition and mode rejections', () => {
    for (const vector of vectors.pairInput) {
      const scenario = pairScenarios.find((entry) => entry.id === vector.id)
      expect(scenario, `missing local scenario for ${vector.id}`).toBeDefined()
      expect(runPair(scenario!), vector.id).toEqual(vector.expected)
    }
    expect(vectors.pairInput).toHaveLength(pairScenarios.length)
  })

  it('freezes clipboard paste priority, rejections, and attachment intents', () => {
    for (const vector of vectors.clipboard) {
      const scenario = clipboardScenarios.find((entry) => entry.id === vector.id)
      expect(scenario, `missing local scenario for ${vector.id}`).toBeDefined()
      expect(runClipboard(scenario!), vector.id).toEqual(vector.expected)
    }
    expect(vectors.clipboard).toHaveLength(clipboardScenarios.length)
  })

  it('freezes native composition plans and traces for commit, cancel, and stale paths', () => {
    for (const vector of vectors.composition) {
      const scenario = compositionScenarios.find((entry) => entry.id === vector.id)
      expect(scenario, `missing local scenario for ${vector.id}`).toBeDefined()
      expect(runComposition(scenario!), vector.id).toEqual(vector.expected)
    }
    expect(vectors.composition).toHaveLength(compositionScenarios.length)
  })
})

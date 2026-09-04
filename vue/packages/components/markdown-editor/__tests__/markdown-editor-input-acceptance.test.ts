import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  MARKDOWN_INPUT_ACCEPTANCE_CONTEXTS,
  MARKDOWN_INPUT_ACCEPTANCE_MODES,
  MARKDOWN_INPUT_ACCEPTANCE_SELECTIONS,
  MARKDOWN_INPUT_ACCEPTANCE_UNICODE,
  MARKDOWN_INPUT_ACCEPTANCE_VERSION,
  evaluateMarkdownInputAcceptance,
  evaluateMarkdownInputAcceptanceMutations,
} from '../src/markdown-editor-input-acceptance'
import {
  applyMarkdownEditorChanges,
  MarkdownEditorTransactionStore,
} from '../src/markdown-editor-transaction'
import { resolveMarkdownBlockInputIntent } from '../src/markdown-editor-input-intent'
import { resolveMarkdownPairInput } from '../src/markdown-editor-pair-input'
import { resolveMarkdownClipboardPaste } from '../src/markdown-editor-clipboard'
import {
  driveMarkdownNativeHarnessTrace,
  markdownNativeSyntheticCompositionScript,
} from '../src/markdown-editor-native-event'

describe('markdown input acceptance', () => {
  it('accepts the landed block, pair, clipboard, and native contracts on one candidate', () => {
    const report = evaluateMarkdownInputAcceptance({
      documentIdentity: { epoch: 2, id: 'gate-doc' },
    })
    expect(report.version).toBe(MARKDOWN_INPUT_ACCEPTANCE_VERSION)
    expect(report.documentIdentity).toEqual({ epoch: 2, id: 'gate-doc' })
    expect(report.contexts.map((cell) => cell.context)).toEqual([
      ...MARKDOWN_INPUT_ACCEPTANCE_CONTEXTS,
    ])
    expect(report.modesEquivalent).toBe(true)
    expect(report.selectionDirectionsPreserved).toBe(true)
    expect(report.uneditedBytesPreserved).toBe(true)
    expect(report.unicodeCovered).toEqual([...MARKDOWN_INPUT_ACCEPTANCE_UNICODE])
    expect(report.browsersCommittedOnce).toBe(true)
    expect(report.compositionSingleCommit).toBe(true)
    expect(report.pasteNotDoubled).toBe(true)
    expect(report.harnessReadable).toBe(true)
    expect(report.mutationsRejected).toBe(true)
    expect(report.accepted).toBe(true)
  })

  it('keeps source/live/split on the same raw transaction and preserves selection direction', () => {
    const source = 'alpha\nbeta'
    const results = MARKDOWN_INPUT_ACCEPTANCE_MODES.map((mode) => {
      const pair = resolveMarkdownPairInput({
        inserted: '[',
        mode,
        selection: { direction: 'backward', end: 5, start: 0 },
        source,
      })
      const block = resolveMarkdownBlockInputIntent({
        key: 'enter',
        selection: { direction: 'forward', end: 6, start: 6 },
        source: '- item',
      })
      const paste = resolveMarkdownClipboardPaste({
        items: [{ text: 'x', type: 'text/plain' }],
        mode,
        selection: { direction: 'none', end: 0, start: 0 },
        source: '',
      })
      return {
        block: block.transaction?.changes[0]?.insert,
        pair: applyMarkdownEditorChanges(source, pair.transaction!.changes)?.value,
        pairDirection: pair.transaction?.selection?.direction,
        paste: paste.insert,
      }
    })
    expect(new Set(results.map((entry) => JSON.stringify(entry))).size).toBe(1)
    expect(results[0]?.pair).toBe('[alpha]\nbeta')
    expect(results[0]?.pairDirection).toBe('backward')
    expect(MARKDOWN_INPUT_ACCEPTANCE_SELECTIONS).toContain('backward')
  })

  it('does not rewrite BOM/CRLF/RTL/ZWJ unedited bytes and does not double paste', () => {
    const raw = '\uFEFFhello\r\nעברית 👩‍💻'
    const caret = raw.indexOf('ע')
    const plan = resolveMarkdownBlockInputIntent({
      key: 'enter',
      selection: { direction: 'none', end: caret, start: caret },
      source: raw,
    })
    const next = applyMarkdownEditorChanges(raw, plan.transaction!.changes)!.value
    expect(next.startsWith('\uFEFF')).toBe(true)
    expect(next.includes('\r\n')).toBe(true)
    expect(next.endsWith(raw.slice(caret))).toBe(true)

    const store = new MarkdownEditorTransactionStore('ab', { start: 2, end: 2 })
    const paste = resolveMarkdownClipboardPaste({
      items: [
        { text: '<i>HTML</i>', type: 'text/html' },
        { text: '中', type: 'text/plain' },
      ],
      revision: store.revision,
      selection: store.selection,
      source: store.value,
    })
    store.dispatch(paste.transaction!)
    expect(store.value).toBe('ab中')
    const follow = driveMarkdownNativeHarnessTrace([
      { clipboardIdentity: paste.identity, kind: 'paste', origin: 'paste' },
      { inputType: 'insertFromPaste', kind: 'input', origin: 'paste', value: store.value },
    ])
    expect(follow.plans.some((item) => item.action === 'dispatch')).toBe(false)
    expect(store.value).toBe('ab中')
  })

  it('kills input, rich-paste, platform-pair, stale-commit, synthetic-only IME, and normalization mutations', () => {
    const report = evaluateMarkdownInputAcceptanceMutations()
    const byKind = Object.fromEntries(
      report.mutations.map((mutation) => [mutation.kind, mutation]),
    )
    expect(byKind['consumer-keydown']?.accepted).toBe(false)
    expect(byKind['dom-mutation']?.accepted).toBe(false)
    expect(byKind['html-paste']?.accepted).toBe(false)
    expect(byKind['pair-drift']?.accepted).toBe(false)
    expect(byKind['double-insert']?.accepted).toBe(false)
    expect(byKind['stale-commit']?.accepted).toBe(false)
    expect(byKind['synthetic-only-ime']?.accepted).toBe(false)
    expect(byKind['full-normalize']?.accepted).toBe(false)
  })

  it('exposes the #319 harness surface and keeps Contract V2 input registry aligned', () => {
    const chromium = driveMarkdownNativeHarnessTrace(
      markdownNativeSyntheticCompositionScript('日本語', 'chromium'),
      { documentIdentity: { epoch: 1, id: 'harness' } },
    )
    expect(chromium.commits).toBe(1)
    expect(chromium.trace.some((entry) => entry.kind === 'compositionstart')).toBe(
      true,
    )

    const registry = JSON.parse(
      readFileSync(
        resolve(
          process.cwd(),
          'spec/components/contracts/v2/markdown-editor-input.json',
        ),
        'utf8',
      ),
    ) as {
      version: string
      modes: string[]
      contexts: string[]
      selections: string[]
      unicode: string[]
      surfaces: Array<{ export: string }>
      forbidden: string[]
    }
    expect(registry.version).toBe(MARKDOWN_INPUT_ACCEPTANCE_VERSION)
    expect(registry.modes).toEqual([...MARKDOWN_INPUT_ACCEPTANCE_MODES])
    expect(registry.contexts).toEqual([...MARKDOWN_INPUT_ACCEPTANCE_CONTEXTS])
    expect(registry.selections).toEqual([...MARKDOWN_INPUT_ACCEPTANCE_SELECTIONS])
    expect(registry.unicode).toEqual([...MARKDOWN_INPUT_ACCEPTANCE_UNICODE])
    expect(registry.surfaces.map((surface) => surface.export)).toEqual([
      'resolveMarkdownBlockInputIntent',
      'resolveMarkdownPairInput',
      'resolveMarkdownClipboardPaste',
      'driveMarkdownNativeHarnessTrace',
      'evaluateMarkdownInputAcceptance',
    ])
    expect(registry.forbidden).toEqual(
      expect.arrayContaining([
        'consumer-keydown',
        'dom-mutation',
        'html-paste',
        'pair-drift',
        'double-insert',
        'full-normalize',
        'second-input-pipeline',
      ]),
    )
  })
})

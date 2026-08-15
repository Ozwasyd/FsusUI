import { describe, expect, it } from 'vitest'

import {
  MARKDOWN_CLIPBOARD_MAX_PASTE_UNITS,
  MARKDOWN_CLIPBOARD_PASTE_PRIORITY,
  evaluateMarkdownClipboardMutations,
  htmlToSafePlainText,
  resolveMarkdownClipboardCopy,
  resolveMarkdownClipboardCut,
  resolveMarkdownClipboardPaste,
  visibleTextFromMarkdownSource,
} from '../src/markdown-editor-clipboard'
import {
  applyMarkdownEditorChanges,
  MarkdownEditorTransactionStore,
} from '../src/markdown-editor-transaction'

const paste = (
  extras: Partial<Parameters<typeof resolveMarkdownClipboardPaste>[0]> & {
    items?: Parameters<typeof resolveMarkdownClipboardPaste>[0]['items']
    source?: string
    start?: number
    end?: number
  } = {},
) => {
  const source = extras.source ?? ''
  const start = extras.start ?? source.length
  const end = extras.end ?? start
  return resolveMarkdownClipboardPaste({
    documentIdentity: { id: 'doc', epoch: 1 },
    revision: 0,
    selection: { start, end, direction: 'none' },
    source,
    ...extras,
  })
}

describe('markdown clipboard priority', () => {
  it('uses the frozen MIME order markdown, plain, html-plain, then files', () => {
    expect(MARKDOWN_CLIPBOARD_PASTE_PRIORITY).toEqual([
      'files',
      'text/markdown',
      'text/plain',
      'text/html',
    ])

    const markdown = paste({
      items: [
        { type: 'text/html', text: '<b>html</b>' },
        { type: 'text/plain', text: 'plain' },
        { type: 'text/markdown', text: '**md**' },
      ],
    })
    expect(markdown.action).toBe('markdown-source')
    expect(markdown.insert).toBe('**md**')
    expect(markdown.transaction?.origin).toBe('paste')

    const plain = paste({
      items: [
        { type: 'text/html', text: '<i>html</i>' },
        { type: 'text/plain', text: '  keep  \n' },
      ],
    })
    expect(plain.action).toBe('plain-text')
    expect(plain.insert).toBe('  keep  \n')

    const html = paste({
      items: [{ type: 'text/html', text: '<b>bold</b><script>x()</script>' }],
    })
    expect(html.action).toBe('html-plain')
    expect(html.insert).toBe('bold')
    expect(html.insert).not.toContain('<')
    expect(html.insert).not.toContain('x()')

    const files = paste({
      files: [{ name: 'a.png', size: 4, type: 'image/png' }],
      items: [
        { type: 'text/html', text: '<img src="data:image/png;base64,abcd">' },
        { type: 'text/plain', text: 'data:image/png;base64,abcd' },
      ],
    })
    expect(files.action).toBe('attachment-intent')
    expect(files.transaction).toBeNull()
    expect(files.insert).toBe('')
    expect(files.attachmentIntent?.kind).toBe('attachment')
    expect(files.attachmentIntent?.files).toEqual([
      { name: 'a.png', size: 4, type: 'image/png' },
    ])
  })

  it('treats text/x-markdown as explicit Markdown source and never writes HTML', () => {
    const plan = paste({
      items: [{ type: 'text/x-markdown', text: '# Title\n\npara' }],
    })
    expect(plan.action).toBe('markdown-source')
    expect(plan.insert).toBe('# Title\n\npara')
    expect(htmlToSafePlainText('<img src=x onerror=alert(1)><br>ok')).toBe('\nok')
  })

  it('rejects composition, readonly, disabled, preview, stale, cancel, and oversize paste', () => {
    expect(paste({ composing: true, items: [{ type: 'text/plain', text: 'x' }] }).rejected).toBe(
      'composition-active',
    )
    expect(paste({ readonly: true, items: [{ type: 'text/plain', text: 'x' }] }).rejected).toBe(
      'readonly',
    )
    expect(paste({ disabled: true, items: [{ type: 'text/plain', text: 'x' }] }).rejected).toBe(
      'disabled',
    )
    expect(
      paste({ mode: 'preview', items: [{ type: 'text/plain', text: 'x' }] }).rejected,
    ).toBe('preview')
    expect(
      paste({
        expectedRevision: 1,
        items: [{ type: 'text/plain', text: 'x' }],
        revision: 2,
      }).rejected,
    ).toBe('stale-document')
    expect(
      paste({
        currentIdentity: { id: 'doc', epoch: 2 },
        items: [{ type: 'text/plain', text: 'x' }],
      }).rejected,
    ).toBe('stale-document')
    const controller = new AbortController()
    controller.abort()
    expect(
      paste({ items: [{ type: 'text/plain', text: 'x' }], signal: controller.signal }).rejected,
    ).toBe('cancelled')
    expect(
      paste({
        items: [{ type: 'text/plain', text: 'n'.repeat(MARKDOWN_CLIPBOARD_MAX_PASTE_UNITS + 1) }],
      }).rejected,
    ).toBe('budget-exceeded')
  })

  it('preserves LF/CRLF, CJK, emoji, RTL and code-context bytes around the insert', () => {
    const source = '前\r\n```\ncode\n```\nעברית 😀'
    const caret = source.indexOf('code') + 4
    const plan = paste({
      items: [{ type: 'text/plain', text: '字\r\n' }],
      source,
      start: caret,
    })
    const next = applyMarkdownEditorChanges(source, plan.transaction!.changes)!.value
    expect(next.slice(0, caret)).toBe(source.slice(0, caret))
    expect(next.slice(caret + 3)).toBe(source.slice(caret))
    expect(next.includes('code字\r\n')).toBe(true)
  })

  it('uses the same paste transaction for source/live/split and undoes through the store', () => {
    const source = 'ab'
    const items = [{ type: 'text/plain', text: '中' }] as const
    const results = (['source', 'live', 'split'] as const).map((mode) => {
      const plan = paste({ items, mode, source, start: 2 })
      return applyMarkdownEditorChanges(source, plan.transaction!.changes)!.value
    })
    expect(new Set(results).size).toBe(1)
    expect(results[0]).toBe('ab中')

    const store = new MarkdownEditorTransactionStore(source, { start: 2, end: 2 })
    store.dispatch(
      paste({
        items,
        revision: store.revision,
        source: store.value,
        start: 2,
      }).transaction!,
    )
    expect(store.value).toBe('ab中')
    store.undo()
    expect(store.value).toBe('ab')
    store.redo()
    expect(store.value).toBe('ab中')
  })

  it('distinguishes exact-source copy from live visible-text copy', () => {
    const source = 'See [docs](https://x.test) and **bold**'
    const selection = { start: 0, end: source.length }
    const sourceCopy = resolveMarkdownClipboardCopy({
      mode: 'source',
      selection,
      source,
    })
    const liveCopy = resolveMarkdownClipboardCopy({
      mode: 'live',
      selection,
      source,
    })
    const explicitSource = resolveMarkdownClipboardCopy({
      copyKind: 'source',
      mode: 'live',
      selection,
      source,
    })
    expect(sourceCopy.kind).toBe('source')
    expect(sourceCopy.text).toBe(source)
    expect(sourceCopy.payload['text/markdown']).toBe(source)
    expect(liveCopy.kind).toBe('visible')
    expect(liveCopy.text).toBe('See docs and bold')
    expect(liveCopy.payload['text/markdown']).toBeUndefined()
    expect(explicitSource.text).toBe(source)
    expect(visibleTextFromMarkdownSource('`code`')).toBe('code')
    expect(JSON.stringify(liveCopy.payload)).not.toContain('syn:')
    expect(Object.keys(liveCopy.payload)).toEqual(['text/plain'])
  })

  it('cuts through a #268 transaction that can undo and redo', () => {
    const source = 'alpha **bold**'
    const store = new MarkdownEditorTransactionStore(source, {
      start: 6,
      end: source.length,
    })
    const plan = resolveMarkdownClipboardCut({
      mode: 'source',
      revision: store.revision,
      selection: store.selection,
      source: store.value,
    })
    expect(plan.copy.text).toBe('**bold**')
    expect(plan.transaction?.origin).toBe('command')
    store.dispatch(plan.transaction!)
    expect(store.value).toBe('alpha ')
    store.undo()
    expect(store.value).toBe(source)
    store.redo()
    expect(store.value).toBe('alpha ')
    expect(
      resolveMarkdownClipboardCut({
        composing: true,
        selection: { start: 0, end: 1 },
        source,
      }).rejected,
    ).toBe('composition-active')
  })

  it('kills HTML-first, double insert, data URL, internal leak, and consumer pipeline mutations', () => {
    const report = evaluateMarkdownClipboardMutations()
    const byKind = Object.fromEntries(
      report.mutations.map((mutation) => [mutation.kind, mutation]),
    )
    expect(report.authority.action).toBe('plain-text')
    expect(report.authority.insert).toBe('plain')
    expect(byKind['html-first']?.accepted).toBe(false)
    expect(byKind['double-insert']?.accepted).toBe(false)
    expect(byKind['data-url']?.accepted).toBe(false)
    expect(byKind['internal-state-leak']?.accepted).toBe(false)
    expect(byKind['consumer-pipeline']?.accepted).toBe(false)
  })
})

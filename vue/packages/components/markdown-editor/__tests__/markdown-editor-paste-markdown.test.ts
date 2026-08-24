import { describe, expect, it } from 'vitest'

import { resolveMarkdownClipboardPaste } from '../src/markdown-editor-clipboard'
import {
  cancelMarkdownPasteAsMarkdown,
  confirmMarkdownPasteAsMarkdown,
  openMarkdownPasteAsMarkdown,
  type MarkdownPasteAsMarkdownAnchor,
} from '../src/markdown-editor-paste-markdown'
import { MarkdownEditorTransactionStore } from '../src/markdown-editor-transaction'

import type { MarkdownHtmlImportSnapshot } from '../../../wasm/markdown-html-import'
import type { MarkdownEditorSelection } from '../src/markdown-editor-transaction'

const selection = (
  start = 4,
  end = start,
  direction: NonNullable<MarkdownEditorSelection['direction']> = 'none',
): MarkdownEditorSelection => ({ direction, end, start })

const anchor = (
  source = 'keep',
  revision = 0,
  currentSelection: MarkdownEditorSelection = selection(source.length),
  documentIdentity = { id: 'doc', epoch: 1 },
): MarkdownPasteAsMarkdownAnchor => ({
  documentIdentity,
  revision,
  source,
  selection: currentSelection,
})

const open = (
  current = anchor(),
  snapshot: MarkdownHtmlImportSnapshot = {
    explicit: true,
    html: '<p>Hello</p>',
    plain: 'Hello',
  },
) =>
  openMarkdownPasteAsMarkdown({
    anchor: current,
    explicit: true,
    snapshot,
  })

describe('explicit Paste as Markdown test contract', () => {
  it('keeps ordinary Ctrl+V on plain-text priority and requires an explicit entry', () => {
    const ordinary = resolveMarkdownClipboardPaste({
      documentIdentity: { id: 'doc', epoch: 1 },
      items: [
        { type: 'text/html', text: '<strong>Rich</strong>' },
        { type: 'text/plain', text: 'Plain' },
      ],
      origin: 'paste',
      revision: 0,
      selection: selection(4),
      source: 'keep',
    })
    expect(ordinary).toMatchObject({
      action: 'plain-text',
      insert: 'Plain',
      mime: 'text/plain',
    })
    expect(ordinary.transaction).toMatchObject({
      history: 'separate',
      origin: 'paste',
    })

    expect(
      openMarkdownPasteAsMarkdown({
        anchor: anchor(),
        explicit: false,
        snapshot: {
          explicit: false,
          html: '<strong>Rich</strong>',
          plain: 'Plain',
        },
      }),
    ).toEqual({ ok: false, rejected: 'not-explicit' })

    const explicit = open(anchor(), {
      explicit: true,
      html: '<strong>Rich</strong>',
      plain: 'Plain',
    })
    expect(explicit.ok).toBe(true)
    if (!explicit.ok) return
    expect(explicit.session.preview.markdown).toContain('**Rich**')
    expect(explicit.session.preview.plainText).toBe('Plain')
  })

  it('captures every clipboard snapshot field once for one conversion', () => {
    const reads = {
      explicit: 0,
      html: 0,
      markdown: 0,
      plain: 0,
      sourceApplication: 0,
    }
    const snapshot: MarkdownHtmlImportSnapshot = {
      get explicit() {
        reads.explicit += 1
        return true
      },
      get html() {
        reads.html += 1
        return '<p>Captured once</p>'
      },
      get markdown() {
        reads.markdown += 1
        return undefined
      },
      get plain() {
        reads.plain += 1
        return 'Captured once'
      },
      get sourceApplication() {
        reads.sourceApplication += 1
        return 'test-owner'
      },
    }

    expect(open(anchor(), snapshot).ok).toBe(true)
    expect(reads).toEqual({
      explicit: 1,
      html: 1,
      markdown: 1,
      plain: 1,
      sourceApplication: 1,
    })
  })

  it('does not mutate source, history, focus, or selection before confirm or on cancel', () => {
    const current = anchor(
      'prefix target suffix',
      0,
      selection(7, 13, 'backward'),
    )
    const store = new MarkdownEditorTransactionStore(
      current.source,
      current.selection,
    )
    const before = {
      history: store.history,
      selection: store.selection,
      source: store.value,
    }
    const opened = open(current, {
      explicit: true,
      html: '<p>Replacement</p>',
      plain: 'Replacement',
    })
    expect(opened.ok).toBe(true)
    if (!opened.ok) return

    expect(store.value).toBe(before.source)
    expect(store.selection).toEqual(before.selection)
    expect(store.history).toEqual(before.history)
    expect(opened.session.confirmed).toBe(false)
    expect(opened.session.preview.diff).toEqual({
      before: current.source,
      after: 'prefix Replacement suffix',
    })

    expect(cancelMarkdownPasteAsMarkdown(opened.session)).toMatchObject({
      focusReturn: 'editor',
      rejected: 'cancelled',
      selection: current.selection,
      source: current.source,
    })
    expect(store.value).toBe(before.source)
    expect(store.selection).toEqual(before.selection)
    expect(store.history).toEqual(before.history)
  })

  it('confirms Markdown or plain text as one separate transaction and one undo', () => {
    const current = anchor(
      'before TARGET after',
      0,
      selection(7, 13, 'backward'),
    )
    const opened = open(current, {
      explicit: true,
      html: '<strong>Markdown</strong>',
      plain: 'Plain text',
    })
    expect(opened.ok).toBe(true)
    if (!opened.ok) return

    const confirmed = confirmMarkdownPasteAsMarkdown(
      opened.session,
      'markdown-import',
      current,
    )
    expect('accepted' in confirmed).toBe(true)
    if (!('accepted' in confirmed)) return
    expect(confirmed.transaction).toMatchObject({
      changes: [
        {
          from: current.selection.start,
          insert: '**Markdown**',
          to: current.selection.end,
        },
      ],
      expectedRevision: 0,
      history: 'separate',
      metadata: {
        choice: 'markdown-import',
        command: 'paste-as-markdown',
      },
      origin: 'command',
    })
    expect(confirmed.focusReturn).toBe('editor')

    const store = new MarkdownEditorTransactionStore(
      current.source,
      current.selection,
    )
    expect(store.dispatch(confirmed.transaction)).toMatchObject({
      accepted: true,
      history: { undoDepth: 1 },
      value: 'before **Markdown** after',
    })
    expect(store.undo()).toMatchObject({
      accepted: true,
      history: { undoDepth: 0 },
      selection: current.selection,
      value: current.source,
    })

    const plainOpened = open(current, {
      explicit: true,
      html: '<strong>Markdown</strong>',
      plain: 'Plain text',
    })
    expect(plainOpened.ok).toBe(true)
    if (!plainOpened.ok) return
    const plain = confirmMarkdownPasteAsMarkdown(
      plainOpened.session,
      'plain-text',
      current,
    )
    expect('accepted' in plain).toBe(true)
    if ('accepted' in plain) {
      expect(plain.transaction.changes[0]?.insert).toBe('Plain text')
      expect(plain.attachmentBatch).toBeNull()
    }
  })

  it('rejects changed document, epoch, revision, source, range, and selection direction', () => {
    const current = anchor(
      'prefix target suffix',
      2,
      selection(7, 13, 'backward'),
    )
    const staleCandidates: MarkdownPasteAsMarkdownAnchor[] = [
      { ...current, documentIdentity: { id: 'other', epoch: 1 } },
      { ...current, documentIdentity: { id: 'doc', epoch: 2 } },
      { ...current, revision: 3 },
      { ...current, source: 'prefix changed suffix' },
      { ...current, selection: selection(8, 13, 'backward') },
      { ...current, selection: selection(7, 13, 'forward') },
    ]

    for (const stale of staleCandidates) {
      const opened = open(current)
      expect(opened.ok).toBe(true)
      if (!opened.ok) continue
      expect(
        confirmMarkdownPasteAsMarkdown(
          opened.session,
          'markdown-import',
          stale,
        ),
      ).toMatchObject({
        rejected: 'stale',
        source: stale.source,
      })
    }
  })

  it.each([
    ['composition-active', { composition: true }],
    ['readonly', { readonly: true }],
    ['disabled', { disabled: true }],
    ['preview-only', { previewOnly: true }],
  ] as const)('fails the %s gate before conversion', (reason, gate) => {
    let htmlReads = 0
    const result = openMarkdownPasteAsMarkdown({
      anchor: anchor(),
      explicit: true,
      snapshot: {
        explicit: true,
        get html() {
          htmlReads += 1
          return '<p>must not convert</p>'
        },
      },
      ...gate,
    })
    expect(result).toEqual({ ok: false, rejected: reason })
    expect(htmlReads).toBe(0)
  })

  it('exposes Markdown, source diff, and removed/flattened/unsupported warnings', () => {
    const opened = open(anchor(), {
      explicit: true,
      html: [
        '<div>',
        '<u>flattened</u>',
        '<custom-element>unsupported</custom-element>',
        '<script>removed()</script>',
        '</div>',
      ].join(''),
      plain: 'flattened unsupported',
    })
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(opened.session.preview.markdown).toContain('flattened')
    expect(opened.session.preview.diff).toEqual({
      before: 'keep',
      after: expect.stringContaining('flattened'),
    })
    expect(
      new Set(opened.session.preview.warnings.map((item) => item.kind)),
    ).toEqual(new Set(['removed', 'flattened', 'unsupported']))
    for (const warning of opened.session.preview.warnings) {
      expect(warning.kind).toMatch(/^(removed|flattened|unsupported)$/)
      expect(warning.code.length).toBeGreaterThan(0)
    }
  })

  it('routes attachment descriptors into the #374 intent without data URLs', () => {
    const current = anchor('keep', 0)
    const opened = open(current, {
      explicit: true,
      html: [
        '<img src="data:image/png;base64,AAAA" alt="local shot">',
        '<img src="https://cdn.example/remote.png" alt="remote shot">',
      ].join(''),
      plain: 'local shot remote shot',
    })
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(opened.session.preview.attachments).toHaveLength(2)
    expect(opened.session.preview.attachments[0]).toEqual({
      alt: 'local shot',
      kind: 'image',
    })
    expect(opened.session.attachmentBatch).toMatchObject({
      anchor: {
        documentIdentity: current.documentIdentity,
        range: {
          end: current.selection.end,
          start: current.selection.start,
        },
        revision: current.revision,
      },
      documentIdentity: current.documentIdentity,
      revision: current.revision,
      sourceKind: 'paste',
    })
    expect(opened.session.attachmentBatch?.items).toHaveLength(2)
    expect(
      opened.session.attachmentBatch?.items.every(
        (item) => item.kind === 'image',
      ),
    ).toBe(true)
    expect(opened.session.preview.markdown).not.toContain('data:image')
    expect(JSON.stringify(opened.session.preview.attachments)).not.toContain(
      'data:image',
    )
    expect(JSON.stringify(opened.session.attachmentBatch)).not.toContain('data:')
  })

  it('preserves untouched BOM, CRLF, tabs, trailing spaces, and hard breaks', () => {
    const source = '\uFEFFhead\r\n\tbefore  \r\nTARGET\r\nafter \t  '
    const start = source.indexOf('TARGET')
    const current = anchor(
      source,
      0,
      selection(start, start + 'TARGET'.length, 'forward'),
    )
    const opened = open(current, {
      explicit: true,
      html: '<p>inserted</p>',
      plain: 'inserted',
    })
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    const confirmed = confirmMarkdownPasteAsMarkdown(
      opened.session,
      'markdown-import',
      current,
    )
    expect('accepted' in confirmed).toBe(true)
    if (!('accepted' in confirmed)) return

    const store = new MarkdownEditorTransactionStore(source, current.selection)
    const result = store.dispatch(confirmed.transaction)
    expect(result.accepted).toBe(true)
    expect(result.value.slice(0, start)).toBe(source.slice(0, start))
    expect(result.value.slice(start + 'inserted'.length)).toBe(
      source.slice(start + 'TARGET'.length),
    )
    expect(result.value.startsWith('\uFEFF')).toBe(true)
    expect(result.value.match(/\r\n/g)).toHaveLength(3)
    expect(result.value).toContain('\tbefore  \r\n')
    expect(result.value.endsWith('after \t  ')).toBe(true)
  })

  it('kills the four required mutations through independent behavior', () => {
    const current = anchor()
    const ordinary = resolveMarkdownClipboardPaste({
      documentIdentity: current.documentIdentity,
      items: [
        { type: 'text/html', text: '<strong>auto HTML mutant</strong>' },
        { type: 'text/plain', text: 'plain authority' },
      ],
      origin: 'paste',
      revision: current.revision,
      selection: current.selection,
      source: current.source,
    })
    expect(ordinary.insert).toBe('plain authority')
    expect(ordinary.insert).not.toContain('**auto HTML mutant**')

    const opened = open(current, {
      explicit: true,
      html: '<strong>explicit conversion</strong>',
      plain: 'plain authority',
    })
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(opened.session.anchor.source).toBe(current.source)
    expect(opened.session.confirmed).toBe(false)
    expect(
      confirmMarkdownPasteAsMarkdown(opened.session, 'markdown-import', {
        ...current,
        revision: current.revision + 1,
      }),
    ).toMatchObject({ rejected: 'stale', source: current.source })

    const malformed = open(current, {
      explicit: true,
      html: '<totally-broken',
      plain: 'safe plain fallback',
    })
    expect(malformed.ok).toBe(true)
    if (malformed.ok) {
      expect(malformed.session.preview.markdown).not.toMatch(
        /<[a-z][^>]*>/i,
      )
      expect(malformed.session.anchor.source).toBe(current.source)
      expect(malformed.session.confirmed).toBe(false)
    }
  })
})

import { describe, expect, it } from 'vitest'

import {
  confirmPasteAsMarkdown,
  previewPasteAsMarkdown,
} from '../src/markdown-editor-paste-markdown'
import { bindMarkdownWebLanguageTools } from '../src/markdown-editor-language-web'
import { retainMarkdownEditorInstance } from '../src/markdown-editor-chrome-stability'
import { resolveMarkdownSearchUi } from '../src/markdown-editor-search-ui'
import {
  currentMarkdownAnchors,
  planMarkdownAnchorInsert,
} from '../src/markdown-editor-anchor-commands'
import { presentMarkdownEmbed } from '../../../wasm/markdown-embed-presentation'

describe('markdown remaining leaf contracts', () => {
  it('previews and confirms paste as markdown in one transaction', () => {
    const preview = previewPasteAsMarkdown('<p>Hello</p><script>x()</script>')
    expect(preview.markdown).toContain('Hello')
    expect(preview.loss).toContain('script')
    const tx = confirmPasteAsMarkdown('<p>Hi</p>', 0)
    expect(tx.origin).toBe('command')
    expect(tx.changes).toHaveLength(1)
  })

  it('binds web spellcheck to the language-tool adapter', () => {
    const textarea = { spellcheck: false }
    const capability = bindMarkdownWebLanguageTools(textarea)
    expect(capability.spellcheck).toBe(true)
    expect(textarea.spellcheck).toBe(true)
  })

  it('keeps the same editor instance across chrome/mode changes', () => {
    const previous = { id: 'editor-1' }
    const next = retainMarkdownEditorInstance(previous, 'minimal', 'live')
    expect(next.id).toBe('editor-1')
    expect(next.chrome).toBe('minimal')
  })

  it('keeps search UI compact and inserts anchors through transactions', () => {
    expect(resolveMarkdownSearchUi(true, 'Alpha', 2)).toMatchObject({
      compact: true,
      card: false,
      hitCount: 2,
    })
    const insert = planMarkdownAnchorInsert('Hello', 5, 'intro')
    const next = `Hello${insert.changes[0]!.insert}`
    expect(
      currentMarkdownAnchors(next).some((node) => node.id === 'intro'),
    ).toBe(true)
  })

  it('presents resolved embed results without card chrome', () => {
    const presented = presentMarkdownEmbed({
      requestId: 'r1',
      status: 'resolved',
      target: 'note',
      mode: 'article',
      version: 1,
      documentIdentity: { id: 'doc', epoch: 1 },
      revision: 1,
      nodeId: 'syn:embed:0',
      title: 'Note',
    })
    expect(presented.visible).toBe(true)
    expect(presented.card).toBe(false)
  })
})

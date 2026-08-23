import { describe, expect, it } from 'vitest'

import { renderMarkdownCaptionFigure } from '../../../wasm/markdown-caption-renderer'
import {
  planMarkdownImageAltChange,
  planMarkdownLinkUnwrap,
  validateMarkdownPropertyUrl,
} from '../src/markdown-editor-link-image'
import { resolveMarkdownEditorStatus } from '../src/markdown-editor-status'

describe('markdown status, link, image, and caption renderer', () => {
  it('hides status in none density and reports metrics otherwise', () => {
    const hidden = resolveMarkdownEditorStatus('hello', 'none')
    expect(hidden.visible).toBe(false)
    const detailed = resolveMarkdownEditorStatus('hello world', 'detailed', undefined, {
      start: 0,
      end: 5,
    })
    expect(detailed.visible).toBe(true)
    expect(detailed.metrics.selectionLength).toBe(5)
  })

  it('unwraps links and edits image alt through transactions', () => {
    const unwrap = planMarkdownLinkUnwrap('[docs](https://x.test)', 0, 22)
    expect(unwrap.changes[0]?.insert).toBe('docs')
    const image = planMarkdownImageAltChange('![old](img.png)', 0, 15, 'new')
    expect(image.changes[0]?.insert).toBe('![new](img.png)')
    const url = validateMarkdownPropertyUrl('https://x.test', {
      documentEpoch: 1,
      revision: 1,
      nodeId: 'syn:link:0',
      value: 'https://x.test',
      version: 1,
    })
    expect(url.state).toBe('valid-external')
  })

  it('renders escaped figcaption text from unique caption nodes', () => {
    const figures = renderMarkdownCaptionFigure('![alt](a.png)\n::caption[hello & world]\n')
    expect(figures[0]?.tag).toBe('figure')
    expect(figures[0]?.caption).toBe('hello &amp; world')
  })
})

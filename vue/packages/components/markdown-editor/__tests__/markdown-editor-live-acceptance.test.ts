import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { resolveMarkdownLiveSurface } from '../src/markdown-editor-live-surface'

const editorVue = readFileSync(
  resolve(__dirname, '../src/markdown-editor.vue'),
  'utf8',
)

describe('markdown editor leftover live acceptance', () => {
  it('keeps the live host as one editable source textarea and hides decorations', () => {
    expect(editorVue).toMatch(/Markdown editor live editing surface/)
    expect(editorVue).toMatch(/aria-hidden="true"/)
    expect(editorVue).toMatch(/data-markdown-live-decorations/)
    expect(editorVue).not.toMatch(/<section[^>]*aria-live/)
  })

  it('keeps source bytes and falls back when live projection fails', () => {
    const identity = Object.freeze({ epoch: 1, id: 'live-doc' })
    const plan = resolveMarkdownLiveSurface({
      documentIdentity: identity,
      mode: 'live',
      projectionError: true,
      revision: 3,
      source: '# latest revision',
    })

    expect(plan.keepSource).toBe(true)
    expect(plan.source).toBe('# latest revision')
    expect(plan.fallbackMode).toBe('source')
    expect(plan.inputVisible).toBe(true)
    expect(plan.inputOwner).toBe('source-textarea')
    expect(plan.capability.capability).toBe('projection-failed')
  })
})

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { resolveMarkdownEditorToolbarLimit } from '../src/markdown-editor'

const editorRoot = resolve(__dirname, '..')

describe('markdown editor leftover command surfaces', () => {
  it('limits the shared toolbar by leftover density without a second command list', () => {
    expect(resolveMarkdownEditorToolbarLimit('minimal', 10)).toBe(2)
    expect(resolveMarkdownEditorToolbarLimit('standard', 10)).toBe(6)
    expect(resolveMarkdownEditorToolbarLimit('full', 10)).toBe(10)
    expect(resolveMarkdownEditorToolbarLimit('minimal', 1)).toBe(1)
  })

  it('keeps toolbarDensity and opt-in surfaces on the shipped editor props', () => {
    const api = readFileSync(resolve(editorRoot, 'src', 'markdown-editor.ts'), 'utf8')
    const surface = readFileSync(resolve(editorRoot, 'src', 'markdown-editor.vue'), 'utf8')

    expect(api).toMatch(/toolbarDensity/)
    expect(api).toMatch(/commandPalette/)
    expect(api).toMatch(/selectionToolbar/)
    expect(api).toMatch(/slashMenu/)
    expect(surface).toMatch(/resolveMarkdownEditorToolbarLimit/)
    expect(surface).toMatch(/surfaceOptions/)
    expect(surface).not.toMatch(/props\.commands\.slice\(0, 6\)/)
  })
})

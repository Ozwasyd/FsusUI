import { describe, expect, it } from 'vitest'

import {
  evaluateMarkdownEditorChromeMutations,
  resolveMarkdownEditorChromeRegions,
} from '../src/markdown-editor-chrome'

describe('markdown editor chrome regions', () => {
  it('keeps a single region map for framed, embedded, and minimal chrome', () => {
    expect(resolveMarkdownEditorChromeRegions('framed').rootBorder).toBe(true)
    expect(resolveMarkdownEditorChromeRegions('embedded').rootBorder).toBe(false)
    expect(resolveMarkdownEditorChromeRegions('minimal')).toMatchObject({
      toolbar: false,
      modeSwitcher: false,
      rootBorder: false,
    })
    const report = evaluateMarkdownEditorChromeMutations('minimal')
    expect(report.mutations.every((mutation) => mutation.accepted === false)).toBe(true)
  })
})

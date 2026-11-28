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
    const report = evaluateMarkdownEditorChromeMutations('minimal', {
      borderless: true,
      privateSelector: true,
      templates: 2,
      writeMode: true,
    })
    expect(report.authority.toolbar).toBe(false)
    expect(report.authority.status).toBe(false)
    expect(report.mutations.every((mutation) => mutation.accepted === false)).toBe(true)
    expect(
      report.mutations.map((mutation) => mutation.kind),
    ).toEqual([
      'second-root',
      'hidden-spacer',
      'duplicate-dom',
      'multi-template',
      'borderless',
      'private-selector',
      'write-mode',
    ])
    expect(
      report.mutations.find((mutation) => mutation.kind === 'multi-template')
        ?.equivalent,
    ).toBe(true)
  })
})

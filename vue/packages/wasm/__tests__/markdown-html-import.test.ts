import { describe, expect, it } from 'vitest'

import {
  evaluateMarkdownHtmlImportMutations,
  sanitizeMarkdownHtmlImport,
} from '../markdown-html-import'

describe('markdown HTML import isolation', () => {
  it('strips script, event handlers, and javascript URLs without executing them', () => {
    const result = sanitizeMarkdownHtmlImport(
      '<p>Hi</p><script>alert(1)</script><a href="javascript:alert(1)" onclick="x()">x</a>',
    )
    expect(result.html).toContain('<p>Hi</p>')
    expect(result.html).not.toMatch(/script/i)
    expect(result.html).not.toMatch(/javascript:/i)
    expect(result.html).not.toMatch(/onclick/i)
    expect(result.rejected.length).toBeGreaterThan(0)
    const report = evaluateMarkdownHtmlImportMutations(
      '<script>alert(1)</script><a href="javascript:alert(1)">x</a>',
    )
    expect(report.mutations.every((mutation) => mutation.accepted === false)).toBe(true)
    expect(report.mutations.every((mutation) => mutation.equivalent === false)).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'

import {
  MARKDOWN_HTML_IMPORT_BUDGET,
  MARKDOWN_HTML_IMPORT_IMPORTER_VERSION,
  MARKDOWN_HTML_IMPORT_SCHEMA_VERSION,
  evaluateMarkdownHtmlImportMutations,
  importMarkdownClipboardSnapshot,
  sanitizeMarkdownHtmlImport,
} from '../markdown-html-import'
import {
  getMarkdownXssSourceAttackFragment,
  getMarkdownXssSourceUrl,
} from '../../../tests/support/markdown-xss-corpus'

describe('isolated markdown HTML clipboard import', () => {
  it('parses an explicit clipboard snapshot into a tree and reports blocked active content', () => {
    const scriptAttack = getMarkdownXssSourceAttackFragment(
      'mxss-raw-script-basic',
    )
    const javascriptUrl = getMarkdownXssSourceUrl(
      'mxss-url-javascript-link',
    )
    const iframeAttack = getMarkdownXssSourceAttackFragment(
      'mxss-container-iframe-srcdoc',
    )
    const outcome = importMarkdownClipboardSnapshot({
      html: `<p>Hi</p>${scriptAttack}<a href="${javascriptUrl}" onclick="x()">x</a>${iframeAttack}`,
      plain: 'Hi',
      sourceApplication: 'Word',
      explicit: true,
    })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.tree.schemaVersion).toBe(MARKDOWN_HTML_IMPORT_SCHEMA_VERSION)
    expect(outcome.tree.importerVersion).toBe(MARKDOWN_HTML_IMPORT_IMPORTER_VERSION)
    const serialized = sanitizeMarkdownHtmlImport(
      `<p>Hi</p>${scriptAttack}<a href="${javascriptUrl}" onclick="x()">x</a>`,
    )
    expect(serialized.html).toContain('<p>Hi</p>')
    expect(serialized.html).not.toMatch(/script/i)
    expect(serialized.html).not.toMatch(/javascript:/i)
    expect(serialized.html).not.toMatch(/onclick/i)
    expect(serialized.rejected.length).toBeGreaterThan(0)
    expect(outcome.findings.some((item) => item.code === 'tag:script')).toBe(true)
    expect(outcome.findings.some((item) => item.code === 'tag:iframe')).toBe(true)
    expect(outcome.tree.nodes.some((node) => node.type === 'element' && node.tag === 'p')).toBe(true)
  })

  it('refuses implicit paste, budgets, cancellation, and does not produce live DOM', () => {
    expect(importMarkdownClipboardSnapshot({ html: '<p>Hi</p>', explicit: false }).ok).toBe(false)
    expect(importMarkdownClipboardSnapshot({ html: '<p>Hi</p>', explicit: false })).toMatchObject({
      code: 'not-explicit',
    })
    const huge = importMarkdownClipboardSnapshot({
      html: 'x'.repeat(MARKDOWN_HTML_IMPORT_BUDGET.maxBytes + 1),
      explicit: true,
    })
    expect(huge.ok).toBe(false)
    if (huge.ok === false) expect(huge.code).toBe('budget-bytes')

    let nested = 'text'
    for (let depth = 0; depth < 30; depth += 1) nested = `<div>${nested}</div>`
    const deep = importMarkdownClipboardSnapshot({ html: nested, explicit: true })
    expect(deep.ok).toBe(false)
    if (deep.ok === false) expect(deep.code).toBe('budget-depth')

    const task = { cancelled: true }
    expect(importMarkdownClipboardSnapshot({ html: '<p>Hi</p>', explicit: true }, { task })).toMatchObject({
      code: 'cancelled',
    })

    const timed = importMarkdownClipboardSnapshot(
      { html: '<p>Hi</p>', explicit: true },
      { now: (() => {
        let n = 0
        return () => {
          n += 1
          return n === 1 ? 0 : MARKDOWN_HTML_IMPORT_BUDGET.maxMs + 10
        }
      })() },
    )
    expect(timed.ok).toBe(false)
    if (timed.ok === false) expect(timed.code).toBe('budget-time')

    const safe = importMarkdownClipboardSnapshot({
      html: '<p>Hi</p><img src="https://example.com/x.png" alt="">',
      explicit: true,
    })
    expect(safe.ok).toBe(true)
    expect(JSON.stringify(safe)).not.toMatch(/HTMLElement|innerHTML|fetch\(/)
  })

  it('strips style URLs, SVG, forms, and control characters from the import tree', () => {
    const svgScriptAttack = getMarkdownXssSourceAttackFragment(
      'mxss-namespace-svg-script',
    )
    const outcome = importMarkdownClipboardSnapshot({
      html: `<p style="background:url(https://evil)">A\u0000B</p>${svgScriptAttack}<form action="https://x"><input></form>`,
      explicit: true,
    })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.findings.some((item) => item.code === 'css-url' || item.code === 'control-character')).toBe(
      true,
    )
    expect(outcome.findings.some((item) => item.code === 'tag:svg')).toBe(true)
    expect(outcome.findings.some((item) => item.code === 'tag:form')).toBe(true)
    const json = JSON.stringify(outcome.tree)
    expect(json).not.toMatch(/<script/i)
    expect(json).not.toContain('\u0000')
  })

  it('kills live DOM insertion, network load, script execution, auto-rich-paste, and external services', () => {
    const scriptAttack = getMarkdownXssSourceAttackFragment(
      'mxss-raw-script-basic',
    )
    const javascriptUrl = getMarkdownXssSourceUrl(
      'mxss-url-javascript-link',
    )
    const report = evaluateMarkdownHtmlImportMutations(
      `${scriptAttack}<a href="${javascriptUrl}">x</a>`,
    )
    expect(report.mutations.map((mutation) => mutation.kind)).toEqual([
      'live-dom-insertion',
      'network-load',
      'script-execution',
      'auto-rich-paste',
      'external-service',
    ])
    for (const mutation of report.mutations) {
      expect(mutation.accepted).toBe(false)
      expect(mutation.equivalent).toBe(false)
    }
  })
})

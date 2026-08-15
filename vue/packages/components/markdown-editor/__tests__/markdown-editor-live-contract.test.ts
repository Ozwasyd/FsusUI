import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  evaluateMarkdownLiveCapabilityMutations,
  markdownEditorModes,
  markdownLiveCapabilities,
  markdownLiveCapabilityKey,
  readMarkdownLiveCapability,
  resolveMarkdownLiveCapability,
} from '../src/markdown-editor-live-contract'

const productionFiles = [
  'vue/packages/components/markdown-editor/src/markdown-editor-live-contract.ts',
  'vue/packages/components/markdown-editor/src/markdown-editor.ts',
  'vue/packages/components/markdown-editor/src/markdown-editor.vue',
  'vue/packages/theme-chalk/src/markdown-editor.scss',
  'docs/components/markdown-editor.md',
  'docs/api/markdown-editor-input.md',
  'docs/api/contract-v2.md',
  'vue/packages/demo-app/src/AuditFixtures.vue',
  'scripts/contract-v2.mjs',
]

describe('markdown live public contract', () => {
  it('freezes four modes and six capability tokens with no write alias', () => {
    expect([...markdownEditorModes]).toEqual(['source', 'live', 'split', 'preview'])
    expect([...markdownLiveCapabilities]).toEqual([
      'supported',
      'unsupported-platform',
      'runtime-unavailable',
      'projection-failed',
      'feature-degraded',
      'fatal',
    ])
    expect(markdownEditorModes).not.toContain('write')
    expect(markdownLiveCapabilities).not.toContain('readonly')
    expect(markdownLiveCapabilities).not.toContain('disabled')
  })

  it('binds capability results to document identity and rejects reuse across epochs', () => {
    const first = resolveMarkdownLiveCapability('feature-degraded', {
      affectedRange: { end: 4, start: 0 },
      documentIdentity: { epoch: 1, id: 'same-source' },
      nodeId: 'syn:same-source:1:heading:0',
      reason: 'mermaid runtime unavailable',
      revision: 3,
    })
    expect(first.documentIdentity.epoch).toBe(1)
    expect(markdownLiveCapabilityKey(first.documentIdentity, first.revision)).toBe(
      'same-source:1:3',
    )
    expect(
      readMarkdownLiveCapability(first, {
        documentIdentity: { epoch: 1, id: 'same-source' },
        revision: 3,
      }),
    ).toBe(first)

    expect(() =>
      readMarkdownLiveCapability(first, {
        documentIdentity: { epoch: 2, id: 'same-source' },
        revision: 3,
      }),
    ).toThrow(/stale/i)

    expect(() =>
      readMarkdownLiveCapability(first, {
        documentIdentity: { epoch: 1, id: 'other-doc' },
      }),
    ).toThrow(/stale/i)

    expect(() =>
      resolveMarkdownLiveCapability('supported', {
        documentIdentity: { epoch: 1, id: '' },
        revision: 1,
      }),
    ).toThrow(/missing identity/i)

    const stale = resolveMarkdownLiveCapability('supported', {
      documentIdentity: { epoch: 1, id: 'same-source' },
      revision: 3,
      stale: true,
    })
    expect(() =>
      readMarkdownLiveCapability(stale, {
        documentIdentity: { epoch: 1, id: 'same-source' },
        revision: 3,
      }),
    ).toThrow(/stale/i)
  })

  it('kills alias, numeric codes, unknown fallback, and consumer mapping', () => {
    const report = evaluateMarkdownLiveCapabilityMutations()
    const byKind = Object.fromEntries(
      report.mutations.map((mutation) => [mutation.kind, mutation]),
    )
    expect(report.authority.capability).toBe('supported')
    expect(byKind.alias?.accepted).toBe(false)
    expect(byKind['numeric-code']?.accepted).toBe(false)
    expect(byKind['unknown-fallback']?.accepted).toBe(false)
    expect(byKind['consumer-mapping']?.accepted).toBe(false)
  })

  it('keeps write out of production docs, demo, CSS, and the Contract V2 generator', () => {
    const writeMode = /(?:mode|defaultMode|default-mode|MarkdownEditorMode)[^;\n]{0,80}['"]write['"]|['"]write['"]\s*\|/
    const writeCopy = /编写|mode-write|is-write|--el-markdown-editor-write/
    const wrongCapabilities =
      /\['source',\s*'live',\s*'split',\s*'preview',\s*'readonly',\s*'disabled'\]/
    for (const relative of productionFiles) {
      const text = readFileSync(resolve(process.cwd(), relative), 'utf8')
      expect(text, relative).not.toMatch(writeMode)
      expect(text, relative).not.toMatch(writeCopy)
      expect(text, relative).not.toMatch(wrongCapabilities)
    }
  })
})

import { describe, expect, it } from 'vitest'

import {
  evaluateMarkdownEmbedAcceptance,
  MARKDOWN_EMBED_ACCEPTANCE_VERSION,
  MARKDOWN_EMBED_SECURITY_CORPUS,
  collectMarkdownEmbedNodes,
  parseMarkdownEmbedLine,
} from '../markdown-runtime'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const GRAMMAR_FIXTURE = resolve(
  __dirname,
  '../../../../tests/fixtures/markdown-embed/grammar.md',
)

describe('markdown embed acceptance (#391 aggregate)', () => {
  it('passes the composed grammar, budget, security, lifecycle and mutation report', () => {
    const report = evaluateMarkdownEmbedAcceptance()
    expect(report.version).toBe(MARKDOWN_EMBED_ACCEPTANCE_VERSION)
    expect(report.grammarValid).toBe(true)
    expect(report.budgets).toMatchObject({
      directCycleRejected: true,
      indirectCycleRejected: true,
      depthRejected: true,
      sizeRejected: true,
      timeRejected: true,
    })
    expect(report.scale.withinBudget).toBe(true)
    expect(report.scale.taskReleased).toBe(true)
    expect(report.scale.cacheBounded).toBe(true)
    expect(report.lifecycle.identityStable).toBe(true)
    expect(report.lifecycle.keyDiscriminates).toBe(true)
    expect(report.accepted).toBe(true)
  })

  it('rejects or neutralizes every unsafe corpus payload', () => {
    expect(MARKDOWN_EMBED_SECURITY_CORPUS.length).toBe(5)
    for (const entry of MARKDOWN_EMBED_SECURITY_CORPUS) {
      const asTarget = parseMarkdownEmbedLine(
        `::embed[target="${entry.payload.replace(/"/g, '\\"')}" mode="article"]`,
      )
      if (entry.expectation === 'grammar-rejected') {
        expect(
          asTarget === null || !asTarget.ok,
          `${entry.kind} payload must be rejected by the grammar`,
        ).toBe(true)
      } else {
        expect(
          asTarget !== null && asTarget.ok,
          `${entry.kind} payload target stays inert text, never a URL or HTML`,
        ).toBe(true)
      }
    }
  })

  it('parses the shared grammar fixture with three modes and no drift', () => {
    const source = readFileSync(GRAMMAR_FIXTURE, 'utf8')
    const nodes = collectMarkdownEmbedNodes(source)
    const valid = nodes.filter((node) => node.ok)
    expect(valid.map((node) => (node.ok ? node.mode : null))).toEqual([
      'article',
      'heading',
      'block',
    ])
    expect(nodes.every((node) => node.ok)).toBe(true)
  })
})

// @vitest-environment jsdom

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  commitMarkdownFeatureOutput,
  type FeatureRenderOutput,
} from '../markdown-feature-output-gateway'
import {
  renderMarkdownChunksWithRuntime,
  renderMarkdownHtmlWithRuntime,
  renderMarkdownResultWithRuntime,
} from '../markdown-runtime'
import {
  auditMarkdownXssHtml,
  canonicalMarkdownXssDomProjection,
  inspectMarkdownXssPreservation,
} from '../../../tests/support/markdown-xss-dom'
import { formatMarkdownXssCaseFailure } from '../../../tests/support/markdown-xss-corpus'

type CorpusCase = {
  category: string
  featureOutput?: FeatureRenderOutput
  id: string
  invariants: {
    allowedNamespaces: string[]
    forbidSelectors: string[]
  }
  preserve: {
    selectors: string[]
    text: string[]
  }
  source?: string
}

type Corpus = {
  cases: CorpusCase[]
  seed: number
}

type CorpusHelpers = typeof import('../../../../scripts/markdown-xss-corpus.mjs')

let corpus: Corpus
let helpers: CorpusHelpers

const unwrap = <T>(
  result: { ok: true; value: T } | { error: { message: string }; ok: false },
) => {
  if (result.ok === false) throw new Error(result.error.message)
  return result.value
}

const featureHtml = (output: FeatureRenderOutput) => {
  const target =
    output.kind === 'code-highlight'
      ? Object.assign(document.createElement('pre'), { className: 'shiki' })
      : document.createElement('div')
  const host = document.createElement('div')
  host.append(target)
  const committed = commitMarkdownFeatureOutput(target, output, {
    mode: output.kind === 'code-highlight' ? 'replace-element' : undefined,
    nonce: 'markdown-xss-test',
  })
  return output.kind === 'code-highlight'
    ? committed.outerHTML
    : host.innerHTML
}

const assertSafe = (entry: CorpusCase, surface: string, html: string) => {
  const violations = auditMarkdownXssHtml(document, html, entry.invariants)
  const preservation = inspectMarkdownXssPreservation(
    document,
    html,
    entry.preserve,
  )
  expect(
    { ...preservation, violations },
    formatMarkdownXssCaseFailure(entry, surface, corpus.seed),
  ).toEqual({
    missingSelectors: [],
    missingText: [],
    violations: [],
  })
}

beforeAll(async () => {
  helpers = await import('../../../../scripts/markdown-xss-corpus.mjs')
  await helpers.validateMarkdownXssCorpus()
  corpus = JSON.parse(
    await readFile(
      resolve(
        import.meta.dirname,
        '../../../../spec/security/markdown-xss-corpus.json',
      ),
      'utf8',
    ),
  ) as Corpus
})

describe('authoritative Markdown XSS differential corpus', () => {
  it('keeps core sync, Wasm, chunks, SSR and feature gateway on one DOM invariant', async () => {
    for (const entry of corpus.cases) {
      if (entry.featureOutput) {
        assertSafe(entry, 'feature-gateway', featureHtml(entry.featureOutput))
        continue
      }
      const request = {
        allowLatex: true,
        allowMermaid: true,
        source: entry.source!,
      }
      const [htmlOnly, full, chunks] = await Promise.all([
        renderMarkdownHtmlWithRuntime(request).then(unwrap),
        renderMarkdownResultWithRuntime(request).then(unwrap),
        renderMarkdownChunksWithRuntime(request).then(unwrap),
      ])
      const surfaces = {
        'core-sync': full.html,
        wasm: htmlOnly.html,
        chunked: chunks.chunks.map((chunk) => chunk.html).join(''),
        'initial-render': full.html,
      }
      for (const [surface, html] of Object.entries(surfaces)) {
        assertSafe(entry, surface, html)
      }
      const projections = Object.fromEntries(
        Object.entries(surfaces).map(([surface, html]) => [
          surface,
          canonicalMarkdownXssDomProjection(document, html),
        ]),
      )
      for (const [surface, projection] of Object.entries(projections)) {
        expect(
          projection,
          formatMarkdownXssCaseFailure(
            entry,
            `canonical:${surface}`,
            corpus.seed,
          ),
        ).toEqual(projections['core-sync'])
      }
    }
  })

  it('runs the fixed-seed deterministic mutation lane without weakening DOM checks', async () => {
    const sourceCases = corpus.cases.filter(
      (entry): entry is CorpusCase & { source: string } =>
        typeof entry.source === 'string',
    )
    const iterations = Number(
      process.env.FSUS_MARKDOWN_XSS_FUZZ_ITERATIONS ?? 2_000,
    )
    const seed = Number(process.env.FSUS_MARKDOWN_XSS_SEED ?? corpus.seed)
    expect(iterations).toBeGreaterThanOrEqual(2_000)
    const random = helpers.createXorshift32(seed)
    for (let index = 0; index < iterations; index += 1) {
      const entry = sourceCases[index % sourceCases.length]!
      const input = helpers.mutateMarkdownXssInput(entry.source, random)
      const fails = async (candidate: string) => {
        const html = unwrap(await renderMarkdownHtmlWithRuntime(candidate)).html
        return auditMarkdownXssHtml(document, html).length > 0
      }
      if (!(await fails(input))) continue
      const minimal = await helpers.minimizeReproductionAsync(input, fails)
      throw new Error(
        helpers.formatMarkdownXssFailure({
          caseId: entry.id,
          input: minimal,
          seed,
          surface: 'core-sync',
        }),
      )
    }
  })
})

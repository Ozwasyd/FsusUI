// @vitest-environment node

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import { expect, it } from 'vitest'
import { renderMarkdownHtmlWithRuntime } from '../markdown-runtime'
import {
  auditMarkdownXssHtml,
  inspectMarkdownXssPreservation,
} from '../../../tests/support/markdown-xss-dom'
import { formatMarkdownXssCaseFailure } from '../../../tests/support/markdown-xss-corpus'

type SourceCase = {
  id: string
  invariants: {
    allowedNamespaces: string[]
    forbidSelectors: string[]
  }
  preserve: { selectors: string[]; text: string[] }
  source: string
}

const unwrap = <T>(
  result: { ok: true; value: T } | { error: { message: string }; ok: false },
) => {
  if (result.ok === false) throw new Error(result.error.message)
  return result.value
}

it('renders every source case without a global DOM before structural parsing', async () => {
  expect(globalThis.document).toBeUndefined()
  const corpus = JSON.parse(
    await readFile(
      resolve(
        import.meta.dirname,
        '../../../../spec/security/markdown-xss-corpus.json',
      ),
      'utf8',
    ),
  ) as { cases: Array<SourceCase | { featureOutput: unknown }> }
  const outputs = []
  for (const entry of corpus.cases) {
    if (!('source' in entry)) continue
    const result = unwrap(
      await renderMarkdownHtmlWithRuntime({
        allowLatex: true,
        allowMermaid: true,
        source: entry.source,
      }),
    )
    outputs.push({ entry, html: result.html })
  }
  expect(globalThis.document).toBeUndefined()

  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  for (const { entry, html } of outputs) {
    expect(
      {
        ...inspectMarkdownXssPreservation(
          dom.window.document,
          html,
          entry.preserve,
        ),
        violations: auditMarkdownXssHtml(
          dom.window.document,
          html,
          entry.invariants,
        ),
      },
      formatMarkdownXssCaseFailure(entry, 'ssr-no-dom'),
    ).toEqual({
      missingSelectors: [],
      missingText: [],
      violations: [],
    })
  }
  dom.window.close()
})

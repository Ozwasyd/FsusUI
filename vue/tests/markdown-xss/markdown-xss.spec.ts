import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { formatMarkdownXssCaseFailure } from '../support/markdown-xss-corpus'

type CorpusCase = {
  featureOutput?: { kind: string; payload: string; rootId?: string }
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

const corpus = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'spec/security/markdown-xss-corpus.json'),
    'utf8',
  ),
) as { cases: CorpusCase[] }

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(globalThis, {
      __FSUS_XSS__: 0,
      __FSUS_XSS_DIALOGS__: 0,
      __FSUS_XSS_CSP__: 0,
    })
    document.addEventListener('securitypolicyviolation', () => {
      globalThis.__FSUS_XSS_CSP__ += 1
    })
  })
  await page.goto('/vue/tests/markdown-xss/')
  await expect(page.locator('#app')).toContainText('fixture ready')
})

test('parses the authoritative corpus through real DOM without execution', async ({
  page,
}) => {
  const dialogs: string[] = []
  const externalRequests: string[] = []
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message())
    await dialog.dismiss()
  })
  page.on('request', (request) => {
    const url = request.url()
    if (!url.startsWith('http://127.0.0.1:')) externalRequests.push(url)
  })

  const reports = await page.evaluate(async (browserCases) => {
    const caseReports = []
    for (const browserCase of browserCases) {
      let results
      try {
        results = await window.__markdownXss.renderCorpusCase(browserCase)
      } catch (error) {
        caseReports.push({
          canonicalMismatches: [],
          error: error instanceof Error ? error.message : String(error),
          id: browserCase.id,
          surfaces: [],
        })
        continue
      }
      const projections: Record<string, unknown> = {}
      const surfaces = []
      for (const [surface, browserHtml] of Object.entries(results)) {
          const violations = window.__markdownXss.auditHtml(
            browserHtml,
            browserCase.invariants,
          )
          const template = document.createElement('template')
          template.innerHTML = browserHtml
          const text = template.content.textContent ?? ''
          const missingText = browserCase.preserve.text.filter(
            (value) => !text.includes(value),
          )
          const missingSelectors = browserCase.preserve.selectors.filter(
            (selector) => !template.content.querySelector(selector),
          )
        surfaces.push({
          missingSelectors,
          missingText,
          surface,
          violations,
        })
        projections[surface] =
          window.__markdownXss.canonicalProjection(browserHtml)
      }
      const canonical = JSON.stringify(projections['core-sync'])
      caseReports.push({
        canonicalMismatches: browserCase.source
          ? Object.entries(projections)
              .filter(([, projection]) => JSON.stringify(projection) !== canonical)
              .map(([surface]) => surface)
          : [],
        id: browserCase.id,
        surfaces,
      })
    }
    return caseReports
  }, corpus.cases)

  for (const report of reports) {
    const entry = corpus.cases.find((candidate) => candidate.id === report.id)!
    if ('error' in report && report.error) {
      throw new Error(
        `${formatMarkdownXssCaseFailure(entry, 'browser-runtime')} error=${report.error}`,
      )
    }
    for (const audit of report.surfaces) {
      expect(
        {
          missingSelectors: audit.missingSelectors,
          missingText: audit.missingText,
          violations: audit.violations,
        },
        formatMarkdownXssCaseFailure(entry, audit.surface),
      ).toEqual({
        missingSelectors: [],
        missingText: [],
        violations: [],
      })
    }
    expect(
      report.canonicalMismatches,
      formatMarkdownXssCaseFailure(entry, 'canonical:cross-surface'),
    ).toEqual([])
  }

  expect(dialogs, 'no dialog may execute').toEqual([])
  expect(externalRequests, 'no external request may leave the fixture').toEqual([])
  expect(
    await page.evaluate(() => ({
      csp: globalThis.__FSUS_XSS_CSP__,
      marker: globalThis.__FSUS_XSS__,
    })),
  ).toEqual({ csp: 0, marker: 0 })
  expect(page.url()).toMatch(/\/vue\/tests\/markdown-xss\/$/u)

  const results = await page.evaluate(() =>
    Object.values(window.__markdownXss.controls).map((control) => ({
      expected: control.expectedViolation,
      id: control.id,
      violations: window.__markdownXss.auditHtml(control.html),
    })),
  )
  expect(results).toHaveLength(6)
  for (const result of results) {
    expect(
      result.violations,
      [
        `case=${result.id}`,
        'surface=kill-control',
        'seed=2662026',
        `minimal=${JSON.stringify(
          await page.evaluate(
            (id) => window.__markdownXss.controls[id]!.html,
            result.id,
          ),
        )}`,
      ].join(' '),
    ).toContain(result.expected)
  }
})

declare global {
  // Test-only execution markers installed before application code.
  var __FSUS_XSS__: number
  var __FSUS_XSS_CSP__: number
  var __FSUS_XSS_DIALOGS__: number
}

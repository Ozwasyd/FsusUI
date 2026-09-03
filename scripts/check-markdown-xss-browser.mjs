import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { chromium, firefox, webkit } from 'playwright'

const root = resolve(import.meta.dirname, '..')
const fixtureRoot = resolve(root, '.tmp/markdown-xss-browser-fixture')
const corpus = JSON.parse(
  await readFile(
    resolve(root, 'spec/security/markdown-xss-corpus.json'),
    'utf8',
  ),
)
const port = Number(process.env.FSUS_MARKDOWN_XSS_PORT ?? 5191)
// Hosts without a launchable engine (e.g. webkit on newer glibc/ICU) can run
// the remaining engines by listing them; unset keeps the default full matrix.
const browserTypes = { chromium, firefox, webkit }
const requestedBrowsers = (
  process.env.FSUS_MARKDOWN_XSS_BROWSERS ?? 'chromium,firefox,webkit'
)
  .split(',')
  .map((name) => name.trim())
  .filter((name) => name.length > 0)
for (const name of requestedBrowsers) {
  if (!(name in browserTypes)) {
    throw new Error(`[markdown-xss] unknown browser engine: ${name}`)
  }
}
const skippedBrowsers = Object.keys(browserTypes).filter(
  (name) => !requestedBrowsers.includes(name),
)
const baseUrl = `http://127.0.0.1:${port}`
const contentTypes = new Map([
  ['.css', 'text/css'],
  ['.html', 'text/html'],
  ['.js', 'text/javascript'],
  ['.mjs', 'text/javascript'],
  ['.wasm', 'application/wasm'],
])

const diagnostic = (entry, surface) =>
  [
    `case=${entry.id}`,
    `surface=${surface}`,
    `seed=${corpus.seed}`,
    `minimal=${JSON.stringify(entry.source ?? entry.featureOutput ?? '')}`,
  ].join(' ')

const server = createServer(async (request, response) => {
  if (request.url === '/favicon.ico') {
    response.writeHead(204).end()
    return
  }
  const relativePath =
    request.url === '/' || request.url === '/vue/tests/markdown-xss/'
      ? 'vue/tests/markdown-xss/index.html'
      : decodeURIComponent(new URL(request.url, baseUrl).pathname.slice(1))
  const file = resolve(fixtureRoot, relativePath)
  if (!file.startsWith(`${fixtureRoot}/`)) {
    response.writeHead(403).end()
    return
  }
  try {
    const content = await readFile(file)
    const extension = file.slice(file.lastIndexOf('.'))
    response.writeHead(200, {
      'Content-Type': contentTypes.get(extension) ?? 'application/octet-stream',
    })
    response.end(content)
  } catch {
    response.writeHead(404).end()
  }
})
await new Promise((resolvePromise, reject) => {
  server.once('error', reject)
  server.listen(port, '127.0.0.1', resolvePromise)
})

const evaluateBrowserCases = async (browserCases) => {
  const caseReports = await Promise.all(
    browserCases.map(async (browserCase) => {
      let results
      try {
        results = await window.__markdownXss.renderCorpusCase(browserCase)
      } catch (error) {
        return {
          canonicalMismatches: [],
          error: error instanceof Error ? error.message : String(error),
          id: browserCase.id,
          surfaces: [],
        }
      }
      const projections = {}
      const surfaces = []
      for (const [surface, browserHtml] of Object.entries(results)) {
        const violations = window.__markdownXss.auditHtml(
          browserHtml,
          browserCase.invariants,
        )
        const template = document.createElement('template')
        template.innerHTML = browserHtml
        const text = template.content.textContent ?? ''
        surfaces.push({
          missingSelectors: browserCase.preserve.selectors.filter(
            (selector) => !template.content.querySelector(selector),
          ),
          missingText: browserCase.preserve.text.filter(
            (value) => !text.includes(value),
          ),
          surface,
          violations,
        })
        projections[surface] =
          window.__markdownXss.canonicalProjection(browserHtml)
      }
      const canonical = JSON.stringify(projections['core-sync'])
      return {
        canonicalMismatches: browserCase.source
          ? Object.entries(projections)
              .filter(
                ([, projection]) => JSON.stringify(projection) !== canonical,
              )
              .map(([surface]) => surface)
          : [],
        id: browserCase.id,
        surfaces,
      }
    }),
  )
  const controls = Object.values(window.__markdownXss.controls).map(
    (control) => ({
      expected: control.expectedViolation,
      html: control.html,
      id: control.id,
      violations: window.__markdownXss.auditHtml(control.html),
    }),
  )
  return {
    caseReports,
    controls,
    execution: globalThis.__FSUS_XSS__,
    csp: globalThis.__FSUS_XSS_CSP__,
  }
}

const runBrowser = async (name, browserType) => {
  const startedAt = performance.now()
  const browser = await browserType.launch()
  const pageCount = 1
  const dialogs = []
  const externalRequests = []
  const pages = await Promise.all(
    Array.from({ length: pageCount }, async () => {
      const page = await browser.newPage()
      page.on('pageerror', (error) => {
        console.error(`[markdown-xss] ${name} pageerror: ${error.message}`)
      })
      page.on('console', (message) => {
        if (message.type() === 'error') {
          console.error(`[markdown-xss] ${name} console: ${message.text()}`)
        }
      })
      page.on('dialog', async (dialog) => {
        dialogs.push(dialog.message())
        await dialog.dismiss()
      })
      page.on('request', (request) => {
        const url = request.url()
        if (!url.startsWith(baseUrl)) externalRequests.push(url)
      })
      await page.addInitScript(() => {
        Object.assign(globalThis, {
          __FSUS_XSS__: 0,
          __FSUS_XSS_CSP__: 0,
        })
        document.addEventListener('securitypolicyviolation', () => {
          globalThis.__FSUS_XSS_CSP__ += 1
        })
      })
      await page.goto(`${baseUrl}/vue/tests/markdown-xss/`)
      await page.waitForFunction(() => window.__markdownXss !== undefined)
      return page
    }),
  )
  try {
    const reportShards = await Promise.all(
      pages.map((page, shard) =>
        page.evaluate(
          evaluateBrowserCases,
          corpus.cases.filter((_, index) => index % pageCount === shard),
        ),
      ),
    )
    const reports = {
      caseReports: reportShards.flatMap((report) => report.caseReports),
      controls: reportShards[0].controls,
      csp: reportShards.reduce((total, report) => total + report.csp, 0),
      execution: reportShards.reduce(
        (total, report) => total + report.execution,
        0,
      ),
    }
    for (const report of reports.caseReports) {
      const entry = corpus.cases.find((candidate) => candidate.id === report.id)
      if (report.error) {
        throw new Error(
          `${diagnostic(entry, `${name}:browser-runtime`)} error=${report.error}`,
        )
      }
      for (const audit of report.surfaces) {
        if (
          audit.missingSelectors.length ||
          audit.missingText.length ||
          audit.violations.length
        ) {
          throw new Error(
            `${diagnostic(entry, `${name}:${audit.surface}`)} audit=${JSON.stringify(
              audit,
            )}`,
          )
        }
      }
      if (report.canonicalMismatches.length) {
        throw new Error(
          `${diagnostic(
            entry,
            `${name}:canonical`,
          )} mismatches=${report.canonicalMismatches.join(',')}`,
        )
      }
    }
    for (const control of reports.controls) {
      if (!control.violations.includes(control.expected)) {
        throw new Error(
          `case=${control.id} surface=${name}:kill-control seed=${corpus.seed} minimal=${JSON.stringify(
            control.html,
          )}`,
        )
      }
    }
    if (
      dialogs.length ||
      externalRequests.length ||
      reports.execution !== 0 ||
      reports.csp !== 0 ||
      pages.some((page) => page.url() !== `${baseUrl}/vue/tests/markdown-xss/`)
    ) {
      throw new Error(
        `case=browser-observer surface=${name} seed=${corpus.seed} minimal=${JSON.stringify(
          {
            dialogs,
            externalRequests,
            execution: reports.execution,
            csp: reports.csp,
          },
        )}`,
      )
    }
    console.log(
      `[markdown-xss] browser OK engine=${name} cases=${reports.caseReports.length} controls=${reports.controls.length} duration=${(
        (performance.now() - startedAt) /
        1000
      ).toFixed(2)}s`,
    )
    await Promise.all(
      pages.map((page) => page.evaluate(() => window.__markdownXss.dispose())),
    )
  } finally {
    await Promise.all(pages.map((page) => page.close()))
    const pagesClosedAt = performance.now()
    await browser.close()
    console.log(
      `[markdown-xss] browser cleanup engine=${name} pages=${(
        (pagesClosedAt - startedAt) /
        1000
      ).toFixed(2)}s closed=${(
        (performance.now() - pagesClosedAt) /
        1000
      ).toFixed(2)}s`,
    )
  }
}

for (const name of skippedBrowsers) {
  console.log(
    `[markdown-xss] browser skipped engine=${name} reason=FSUS_MARKDOWN_XSS_BROWSERS`,
  )
}

try {
  await Promise.all(
    requestedBrowsers.map((name) => runBrowser(name, browserTypes[name])),
  )
} finally {
  await new Promise((resolvePromise, reject) => {
    server.close((error) => {
      if (error) reject(error)
      else resolvePromise()
    })
  })
}

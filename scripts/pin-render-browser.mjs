import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export const expectedBrowserVersion = '147.0.7727.15'
export const expectedBrowserRevision = '1217'

export function selectRenderBrowser(executable, run = execFileSync) {
  assert.ok(path.isAbsolute(executable), 'Browser executable must be absolute')
  assert.ok(!/[\r\n]/u.test(executable), 'Invalid browser executable path')
  assert.ok(
    executable.split(/[\\/]/u).includes(`chromium-${expectedBrowserRevision}`),
    'Expected the pinned Playwright Chromium revision, not system Chrome',
  )
  const reported = run(executable, ['--version'], {
    encoding: 'utf8',
    timeout: 10_000,
    maxBuffer: 16_384,
  }).trim()
  const version =
    /^(?:Chromium|Google Chrome(?: for Testing)?) (\d+\.\d+\.\d+\.\d+)$/u.exec(
      reported,
    )?.[1]
  assert.equal(
    version,
    expectedBrowserVersion,
    `Unexpected browser: ${reported}`,
  )
  return { executable, version, revision: expectedBrowserRevision, reported }
}

export function verifyRenderBrowsers(directories, read = readFileSync) {
  assert.ok(directories.length > 0, 'Measurement directories are required')
  for (const directory of directories) {
    const file = path.join(directory, 'web', 'summary.json')
    const summary = JSON.parse(read(file, 'utf8'))
    assert.equal(
      summary.environment?.browser,
      `Chromium ${expectedBrowserVersion}`,
      file,
    )
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  if (process.argv[2] === '--verify') {
    verifyRenderBrowsers(process.argv.slice(3))
  } else {
    assert.ok(
      process.env.GITHUB_ENV,
      'GITHUB_ENV is required to pin all four arms',
    )
    const { chromium } = await import('@playwright/test')
    const selected = selectRenderBrowser(chromium.executablePath())
    const receipt = process.argv[2] ?? '../performance-browser-selection.json'
    mkdirSync(path.dirname(receipt), { recursive: true })
    writeFileSync(receipt, `${JSON.stringify(selected, null, 2)}\n`)
    appendFileSync(
      process.env.GITHUB_ENV,
      `FSUSUI_PERF_BROWSER_EXECUTABLE=${selected.executable}\n`,
    )
    console.log(
      `Pinned all render-performance arms to ${selected.reported} (${selected.revision})`,
    )
  }
}

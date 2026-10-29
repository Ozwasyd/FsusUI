import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const workflows = [
  '.github/workflows/quality.yml',
  '.github/workflows/_quality.yml',
  '.github/workflows/_quality-playwright.yml',
]

function unsupportedBrowserJobs(source) {
  const jobs = [
    ...source.matchAll(
      /^ {2}([\w-]+):\n([\s\S]*?)(?=^ {2}[\w-]+:\n|(?![\s\S]))/gmu,
    ),
  ]
  return jobs.flatMap(([, name, body]) => {
    if (!body.includes('playwright install --with-deps')) return []
    return /^ {4}runs-on: ubuntu-24\.04$/mu.test(body) ? [] : [name]
  })
}

test('all hosted Playwright installations use the supported Ubuntu runner', () => {
  for (const file of workflows) {
    const source = readFileSync(file, 'utf8')
    assert.match(source, /playwright install --with-deps/u)
    assert.deepEqual(unsupportedBrowserJobs(source), [], file)
  }
})

test('a browser installation on ubuntu-latest is rejected', () => {
  const workflow =
    '\njobs:\n  browser:\n    runs-on: ubuntu-latest\n    steps:\n      - run: pnpm exec playwright install --with-deps chromium\n'
  assert.deepEqual(unsupportedBrowserJobs(workflow), ['browser'])
  assert.deepEqual(
    unsupportedBrowserJobs(workflow.replace('ubuntu-latest', 'ubuntu-24.04')),
    [],
  )
  const current = readFileSync('.github/workflows/_quality.yml', 'utf8')
  const regressed = current.replace(
    'runs-on: ubuntu-24.04',
    'runs-on: ubuntu-latest',
  )
  assert.ok(
    unsupportedBrowserJobs(regressed).includes('real-render-performance'),
  )
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const workflows = [
  '.github/workflows/quality.yml',
  '.github/workflows/_quality.yml',
  '.github/workflows/_quality-playwright.yml',
]

const nativeUbuntu22Jobs = new Map([
  ['.github/workflows/quality.yml', 'pr-avalonia-aot-candidate'],
  ['.github/workflows/_quality.yml', 'dotnet-package'],
])

function unsupportedBrowserJobs(source, file) {
  const jobs = [
    ...source.matchAll(
      /^ {2}([\w-]+):\n([\s\S]*?)(?=^ {2}[\w-]+:\n|(?![\s\S]))/gmu,
    ),
  ]
  return jobs.flatMap(([, name, body]) => {
    if (!body.includes('playwright install --with-deps')) return []
    const runners = [...body.matchAll(/^ {4}runs-on: (.+)$/gmu)]
    if (runners.length !== 1) return [name]
    const runner = runners[0][1]
    if (runner === 'ubuntu-24.04') return []
    if (runner === 'ubuntu-22.04' && nativeUbuntu22Jobs.get(file) === name) return []
    return [name]
  })
}

test('all hosted Playwright installations use the supported Ubuntu runner', () => {
  for (const file of workflows) {
    const source = readFileSync(file, 'utf8')
    assert.match(source, /playwright install --with-deps/u)
    assert.deepEqual(unsupportedBrowserJobs(source, file), [], file)
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
})


test('Ubuntu 22 exceptions are restricted to exact AOT workflow and job', () => {
  const workflow = (job, runner) => `jobs:
  ${job}:
    runs-on: ${runner}
    steps:
      - run: pnpm exec playwright install --with-deps chromium
`
  for (const [file, job] of nativeUbuntu22Jobs) {
    assert.deepEqual(unsupportedBrowserJobs(workflow(job, 'ubuntu-22.04'), file), [])
    assert.deepEqual(unsupportedBrowserJobs(workflow(job, 'ubuntu-22.04'), 'other.yml'), [job])
    assert.deepEqual(unsupportedBrowserJobs(workflow('other', 'ubuntu-22.04'), file), ['other'])
    assert.deepEqual(unsupportedBrowserJobs(workflow(job, 'ubuntu-latest'), file), [job])
  }
})

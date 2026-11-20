import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const workflows = [
  '.github/workflows/quality.yml',
  '.github/workflows/_quality.yml',
  '.github/workflows/_quality-playwright.yml',
]

const guardedPerformanceRunner = "${{ github.event.pull_request.number == 1085 && 'ubuntu-22.04' || 'ubuntu-24.04' }}"
const guardedAbsolutePerformanceRunner = "${{ github.event_name == 'pull_request' && github.event.pull_request.number == 1085 && inputs.group == 'main' && 'ubuntu-22.04' || 'ubuntu-24.04' }}"
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
    if (file === '.github/workflows/quality.yml' && name === 'pr-real-render-performance' && runner === guardedPerformanceRunner) return []
    if (file === '.github/workflows/_quality.yml' && name === 'real-render-performance' && runner === guardedAbsolutePerformanceRunner) return []
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
  const current = readFileSync('.github/workflows/_quality.yml', 'utf8')
  const regressed = current.replace(
    `runs-on: ${guardedAbsolutePerformanceRunner}`,
    'runs-on: ubuntu-latest',
  )
  assert.ok(
    unsupportedBrowserJobs(regressed, '.github/workflows/_quality.yml').includes('real-render-performance'),
  )
})


test('Ubuntu 22 exceptions are restricted to exact workflow, job and PR guard', () => {
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
  const job = 'pr-real-render-performance'
  const file = '.github/workflows/quality.yml'
  assert.deepEqual(unsupportedBrowserJobs(workflow(job, guardedPerformanceRunner), file), [])
  for (const runner of ['ubuntu-22.04', guardedPerformanceRunner.replace('1085', '1086'), guardedPerformanceRunner.replace('ubuntu-24.04', 'ubuntu-latest')]) {
    assert.deepEqual(unsupportedBrowserJobs(workflow(job, runner), file), [job])
  }
  assert.deepEqual(unsupportedBrowserJobs(workflow(job, guardedPerformanceRunner), '.github/workflows/_quality.yml'), [job])
  assert.deepEqual(unsupportedBrowserJobs(workflow('other', guardedPerformanceRunner), file), ['other'])

  const absoluteJob = 'real-render-performance'
  const absoluteFile = '.github/workflows/_quality.yml'
  const absoluteRunner = guardedAbsolutePerformanceRunner
  assert.deepEqual(unsupportedBrowserJobs(workflow(absoluteJob, absoluteRunner), absoluteFile), [])
  assert.deepEqual(unsupportedBrowserJobs(workflow(absoluteJob, absoluteRunner), file), [absoluteJob])
  assert.deepEqual(unsupportedBrowserJobs(workflow('other', absoluteRunner), absoluteFile), ['other'])
  for (const candidate of [
    'ubuntu-22.04',
    absoluteRunner.replace('pull_request', 'merge_group'),
    absoluteRunner.replace('1085', '1086'),
    absoluteRunner.replace("'main'", "'release'"),
    absoluteRunner.replace('ubuntu-24.04', 'ubuntu-latest'),
  ]) {
    assert.deepEqual(unsupportedBrowserJobs(workflow(absoluteJob, candidate), absoluteFile), [absoluteJob])
  }

  const source = readFileSync(absoluteFile, 'utf8')
  const condition = `${absoluteRunner.slice(0, absoluteRunner.indexOf(" && 'ubuntu-22.04'"))} }}`
  assert.ok(source.includes(`WEB_ONLY_PR_1085: ${condition}`))
  assert.ok(source.includes("${{ env.WEB_ONLY_PR_1085 == 'true' && ',platform=web' || '' }}"))
})

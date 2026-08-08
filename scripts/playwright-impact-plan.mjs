#!/usr/bin/env node

import { execFile } from 'node:child_process'
import { appendFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import {
  createPlaywrightImpactPlan,
  formatImpactPlanForGithubOutput,
  loadPlaywrightSuiteRegistry,
  verifyPlaywrightImpactPlan,
} from './playwright-impact.mjs'

const execFileAsync = promisify(execFile)
const root = path.resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)

const valueOf = (name, fallback = '') => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : fallback
}

const hasFlag = (name) => args.includes(name)

const baseRef = valueOf('--base', process.env.GITHUB_BASE_REF || '')
const headRef = valueOf('--head', 'HEAD')
const group = valueOf('--group', 'pr')
const githubOutput = valueOf('--github-output', process.env.GITHUB_OUTPUT || '')
const receiptArg = valueOf('--receipt', '.tmp/playwright-impact/receipt.json')
const receipt = path.resolve(root, receiptArg)
const json = hasFlag('--json')

const registry = loadPlaywrightSuiteRegistry(root)
registry._hash = createPlaywrightImpactPlan({
  changedFiles: [],
  registry,
  baseRef: null,
  headRef: null,
  group: 'pr',
}).registryHash || 'none'

let changedFiles = []
let fallbackReason = null

if (!baseRef) {
  fallbackReason = 'Git base is unavailable; selecting full suite matrix.'
} else {
  try {
    const { stdout: diff } = await execFileAsync(
      'git',
      ['diff', '--name-only', '--diff-filter=ACMRDTUXB', baseRef],
      { cwd: root },
    )
    const { stdout: untracked } = await execFileAsync(
      'git',
      ['ls-files', '--others', '--exclude-standard'],
      { cwd: root },
    )
    // Also get merge-base diff when base is not ancestor
    const { stdout: mergeBase } = await execFileAsync(
      'git',
      ['merge-base', baseRef, headRef],
      { cwd: root },
    ).catch(() => ({ stdout: '' }))

    const allFiles = `${diff}\n${untracked}`.split(/\r?\n/u).filter(Boolean)
    // Add rename detection on merge-base if different from base
    if (mergeBase.trim() && mergeBase.trim() !== baseRef) {
      try {
        const { stdout: mergeDiff } = await execFileAsync(
          'git',
          ['diff', '--name-only', '--diff-filter=ACMRDTUXB', mergeBase.trim()],
          { cwd: root },
        )
        changedFiles = [
          ...new Set([
            ...allFiles,
            ...mergeDiff.split(/\r?\n/u).filter(Boolean),
          ]),
        ]
      } catch {
        changedFiles = allFiles
      }
    } else {
      changedFiles = allFiles
    }
  } catch (error) {
    fallbackReason = `Git base ${baseRef} is unavailable; selecting full suite matrix. (${error.code ?? 'git-diff-failed'})`
  }
}

const plan = createPlaywrightImpactPlan({
  changedFiles,
  registry,
  baseRef,
  headRef,
  fallbackReason,
  group,
})
verifyPlaywrightImpactPlan(plan)

await mkdir(path.dirname(receipt), { recursive: true })
await writeFile(receipt, `${JSON.stringify(plan, null, 2)}\n`)

if (githubOutput) {
  await appendFile(
    githubOutput,
    [
      `pw-plan-digest=${plan.planDigest}`,
      `pw-plan-receipt=${receipt}`,
      formatImpactPlanForGithubOutput(plan),
      '',
    ].join('\n'),
  )
}

if (json) {
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`)
} else {
  for (const decision of plan.decisions) {
    const label = decision.decision === 'run' ? 'RUN ' : 'SKIP'
    process.stdout.write(
      `${label} ${decision.suiteId.padEnd(35)} ${decision.reasonCode.padEnd(30)} ${decision.cells.length} cells  ${decision.reason}\n`,
    )
  }
  process.stdout.write(`\ndigest=${plan.planDigest}\n`)
  process.stdout.write(`receipt=${receipt}\n`)
}

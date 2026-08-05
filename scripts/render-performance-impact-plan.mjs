import { execFile } from 'node:child_process'
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import {
  createImpactPlan,
  isPlaywrightRegistryOnlyPackageMutation,
  loadOwnershipRegistry,
} from './render-performance-impact.mjs'

const execFileAsync = promisify(execFile)
const root = path.resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const valueOf = (name, fallback = '') => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : fallback
}
const baseRef = valueOf('--base', process.env.GITHUB_BASE_REF || '')
const outputArgument = valueOf(
  '--output',
  '.tmp/performance/pr-impact-plan.json',
)
const output = path.resolve(root, outputArgument)
const registry = await loadOwnershipRegistry(root)

const registryOnlyPackageOverride = async (ref) => {
  try {
    const [{ stdout: baselineSource }, currentSource] = await Promise.all([
      execFileAsync('git', ['show', `${ref}:package.json`], { cwd: root }),
      readFile(path.join(root, 'package.json'), 'utf8'),
    ])
    const baseline = JSON.parse(baselineSource)
    const current = JSON.parse(currentSource)
    return isPlaywrightRegistryOnlyPackageMutation(baseline, current)
      ? {
          'package.json': {
            id: 'playwright-registry-package-scripts',
            scope: 'skip',
          },
        }
      : {}
  } catch {
    return {}
  }
}

let changedFiles = []
let fallbackReason = null
if (!baseRef) {
  fallbackReason = 'Git base is unavailable; selecting both full quick sets.'
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
    changedFiles = `${diff}\n${untracked}`.split(/\r?\n/u).filter(Boolean)
  } catch (error) {
    fallbackReason = `Git base ${baseRef} is unavailable; selecting both full quick sets. (${error.code ?? 'git-diff-failed'})`
  }
}

const ownershipOverrides =
  baseRef && changedFiles.includes('package.json')
    ? await registryOnlyPackageOverride(baseRef)
    : {}
const plan = createImpactPlan({
  changedFiles,
  registry,
  baseRef,
  fallbackReason,
  ownershipOverrides,
})
const reason =
  plan.fallbackReason ||
  plan.matchedOwnership.map((entry) => entry.rule).join(',') ||
  'no-performance-impact'
if (!args.includes('--dry-run') || args.includes('--output')) {
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(plan, null, 2)}\n`)
}
if (process.env.GITHUB_OUTPUT) {
  await appendFile(
    process.env.GITHUB_OUTPUT,
    [
      `run=${plan.run}`,
      `scope=${plan.scope}`,
      `digest=${plan.planDigest}`,
      `plan=${output}`,
      `reason=${reason}`,
      '',
    ].join('\n'),
  )
}
console.info(JSON.stringify(plan, null, 2))

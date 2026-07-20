#!/usr/bin/env node
import { spawn as spawnChild, spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import {
  VISUAL_CAPACITY_PLAN_ENV,
  formatVisualCapacitySummary,
  resolveVisualCapacityPlan,
  serializeVisualCapacityPlan,
} from './visual-capacity.mjs'
import { cleanupSuccessfulVisualEvidence } from './visual-evidence-policy.mjs'

export const PREVIEW_PROJECTS = [
  'desktop-light',
  'mobile-light',
  'desktop-dark',
  'mobile-dark',
]

const SUITES = new Set(['full', 'preview', 'dev'])

const readOption = (args, name) => {
  const equalsPrefix = `--${name}=`
  const equalsValue = args.find((arg) => arg.startsWith(equalsPrefix))
  if (equalsValue) return equalsValue.slice(equalsPrefix.length)

  const index = args.indexOf(`--${name}`)
  return index >= 0 ? args[index + 1] : undefined
}

export function parseVisualArgs(args) {
  const normalizedArgs = args.filter((arg) => arg !== '--')
  const suite = readOption(normalizedArgs, 'suite') ?? 'full'
  const projectRequested = normalizedArgs.some(
    (arg) => arg === '--project' || arg.startsWith('--project='),
  )
  const projectOption = readOption(normalizedArgs, 'project')
  const positionalProject = normalizedArgs.find((arg) => !arg.startsWith('-'))
  const project = projectOption ?? positionalProject
  const shard = readOption(normalizedArgs, 'shard')
  const list =
    normalizedArgs.includes('--list') || normalizedArgs.includes('--dry-run')
  const evidence = normalizedArgs.includes('--evidence')

  if (!SUITES.has(suite)) {
    throw new Error(`Unknown visual suite: ${suite}`)
  }
  if (projectRequested && !project) {
    throw new Error('--project requires a project name')
  }
  if (project && suite !== 'preview') {
    throw new Error('--project is only valid with --suite=preview')
  }
  if (project && !PREVIEW_PROJECTS.includes(project)) {
    throw new Error(
      `Unknown preview project: ${project}. Expected one of ${PREVIEW_PROJECTS.join(', ')}`,
    )
  }
  if (shard && (suite !== 'preview' || project)) {
    throw new Error(
      '--shard is only valid for the preview suite without a single-project selection',
    )
  }
  if (shard && !/^\d+\/\d+$/u.test(shard)) {
    throw new Error(`Invalid shard: ${shard}. Expected N/M`)
  }
  if (shard) {
    const [index, total] = shard.split('/').map(Number)
    if (index < 1 || total < 1 || index > total) {
      throw new Error(`Invalid shard: ${shard}. Expected 1 <= N <= M`)
    }
  }

  return { evidence, list, project, shard, suite }
}

export function createVisualPlan(
  { project, shard, suite },
  capacityPlan = resolveVisualCapacityPlan(),
) {
  const selectedProjects = project ? [project] : [...PREVIEW_PROJECTS]
  const previewArgs = [
    'exec',
    'playwright',
    'test',
    '--config=vue/playwright.config.ts',
    ...selectedProjects.map((name) => `--project=${name}`),
  ]
  if (shard) previewArgs.push(`--shard=${shard}`)

  const preview = {
    argv: ['pnpm', ...previewArgs],
    projectResultNamespaces: selectedProjects.map(
      (name) => `vue/test-results/visual-preview/${name}`,
    ),
    reportDirectory: 'playwright-report/visual-preview',
    selectedProjects,
    suite: 'preview',
    workers: capacityPlan.previewWorkers,
  }
  const dev = {
    argv: [
      'pnpm',
      'exec',
      'playwright',
      'test',
      '--config=vue/playwright.dev.config.ts',
    ],
    projectResultNamespaces: ['vue/test-results/demo-app-dev/default'],
    reportDirectory: 'playwright-report/demo-app-dev',
    selectedProjects: [],
    suite: 'dev',
    workers: capacityPlan.devWorkers,
  }

  if (suite === 'preview') return [preview]
  if (suite === 'dev') return [dev]
  return [preview, dev]
}

export function validateVisualPlan(
  plan,
  capacityPlan = resolveVisualCapacityPlan(),
) {
  const previewEntries = plan.filter((entry) => entry.suite === 'preview')
  const devEntries = plan.filter((entry) => entry.suite === 'dev')
  if (previewEntries.length > 1) {
    throw new Error('Visual plan must contain at most one preview invocation')
  }
  if (devEntries.length > 1) {
    throw new Error('Visual plan must contain at most one dev invocation')
  }

  const namespaces = plan.flatMap((entry) => entry.projectResultNamespaces)
  if (new Set(namespaces).size !== namespaces.length) {
    throw new Error('Visual result namespaces must be unique')
  }

  for (const entry of previewEntries) {
    if (
      new Set(entry.selectedProjects).size !== entry.selectedProjects.length
    ) {
      throw new Error('Preview projects must appear exactly once')
    }
    for (const project of entry.selectedProjects) {
      const projectArg = `--project=${project}`
      if (entry.argv.filter((arg) => arg === projectArg).length !== 1) {
        throw new Error(`Preview argv must contain ${projectArg} exactly once`)
      }
    }
  }

  for (const entry of plan) {
    const expectedWorkers =
      entry.suite === 'preview'
        ? capacityPlan.previewWorkers
        : capacityPlan.devWorkers
    if (entry.workers !== expectedWorkers) {
      throw new Error(
        `${entry.suite} workers must come from the shared visual capacity plan`,
      )
    }
  }
}

export function printVisualPlan(plan, capacityPlan) {
  console.log(formatVisualCapacitySummary(capacityPlan))
  for (const entry of plan) {
    console.log(`[visual-plan] suite=${entry.suite}`)
    console.log(
      `[visual-plan] selected-projects=${entry.selectedProjects.join(',') || 'none'}`,
    )
    console.log(`[visual-plan] argv=${entry.argv.join(' ')}`)
    console.log(`[visual-plan] workers=${entry.workers}`)
    console.log(`[visual-plan] report-directory=${entry.reportDirectory}`)
    console.log(
      `[visual-plan] result-namespaces=${entry.projectResultNamespaces.join(',')}`,
    )
  }
}

function visualPlanEnvironment(capacityPlan, env = process.env) {
  return {
    ...env,
    [VISUAL_CAPACITY_PLAN_ENV]: serializeVisualCapacityPlan(capacityPlan),
  }
}

export function runVisualRuntimePreparation(spawn = spawnSync) {
  console.log('[visual-plan] runtime-prepare=pnpm run visual:prepare')
  const result = spawn('pnpm', ['run', 'visual:prepare'], {
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  return result.status ?? 1
}

export function runVisualPlan(
  plan,
  spawn = spawnSync,
  capacityPlan = resolveVisualCapacityPlan(),
) {
  let exitCode = 0
  const env = visualPlanEnvironment(capacityPlan)

  for (const entry of plan) {
    const [command, ...args] = entry.argv
    const result = spawn(command, args, {
      env,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
    if (result.status !== 0) exitCode = result.status ?? 1
  }

  return exitCode
}

function runVisualEntry(entry, spawn, env) {
  return new Promise((resolve) => {
    const [command, ...args] = entry.argv
    const child = spawn(command, args, {
      env,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
    child.once('error', () => resolve(1))
    child.once('close', (code) => resolve(code ?? 1))
  })
}

export async function runVisualPlanAsync(
  plan,
  {
    capacityPlan = resolveVisualCapacityPlan(),
    env = process.env,
    spawn = spawnChild,
  } = {},
) {
  const childEnv = visualPlanEnvironment(capacityPlan, env)
  if (capacityPlan.suiteMode === 'parallel' && plan.length > 1) {
    const statuses = await Promise.all(
      plan.map((entry) => runVisualEntry(entry, spawn, childEnv)),
    )
    return statuses.find((status) => status !== 0) ?? 0
  }

  let exitCode = 0
  for (const entry of plan) {
    const status = await runVisualEntry(entry, spawn, childEnv)
    if (status !== 0) exitCode ||= status
  }
  return exitCode
}

async function main() {
  try {
    const options = parseVisualArgs(process.argv.slice(2))
    const capacityPlan = resolveVisualCapacityPlan()
    const plan = createVisualPlan(options, capacityPlan)
    validateVisualPlan(plan, capacityPlan)
    printVisualPlan(plan, capacityPlan)
    if (!options.list) {
      const preparationStatus = runVisualRuntimePreparation()
      if (preparationStatus !== 0) {
        process.exitCode = preparationStatus
        return
      }
      const env = {
        ...process.env,
        FSUS_VISUAL_ORCHESTRATED: '1',
        FSUS_VISUAL_EVIDENCE:
          options.evidence || process.env.FSUS_VISUAL_EVIDENCE === '1'
            ? '1'
            : '0',
      }
      console.log(
        `[visual-plan] evidence=${env.FSUS_VISUAL_EVIDENCE === '1' ? 'full' : 'failures-only'}`,
      )
      process.exitCode = await runVisualPlanAsync(plan, {
        capacityPlan,
        env,
      })
      await cleanupSuccessfulVisualEvidence(env, undefined, true)
    }
  } catch (error) {
    console.error(
      `[visual-plan] ${error instanceof Error ? error.message : String(error)}`,
    )
    process.exitCode = 2
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  void main()
}

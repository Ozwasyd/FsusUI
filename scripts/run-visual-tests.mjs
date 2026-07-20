#!/usr/bin/env node
import { spawn as spawnChild, spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import {
  VISUAL_CAPACITY_PLAN_ENV,
  formatVisualCapacitySummary,
  resolveVisualCapacityPlan,
  serializeVisualCapacityPlan,
} from './visual-capacity.mjs'
import {
  cleanupSuccessfulVisualEvidence,
  writeVisualEvidenceManifest,
} from './visual-evidence-policy.mjs'
import {
  VISUAL_PROFILES,
  createAffectedSelection,
  createSmokeSelection,
  loadVisualProfileRegistry,
} from './visual-profiles.mjs'

export const PREVIEW_PROJECTS = [
  'desktop-light',
  'mobile-light',
  'desktop-dark',
  'mobile-dark',
]

export function resolveProfileCapacityPlan(profile, capacityPlan) {
  if (profile !== 'smoke') return capacityPlan
  return {
    ...capacityPlan,
    auditBucketCount: 1,
    previewWorkers: 1,
    suiteMode: 'serial',
    reasons: [
      ...capacityPlan.reasons,
      'smoke profile capped browser execution to one worker',
    ],
  }
}

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
  const profile = readOption(normalizedArgs, 'profile')
  const suite = readOption(normalizedArgs, 'suite') ?? 'full'
  const projectRequested = normalizedArgs.some(
    (arg) => arg === '--project' || arg.startsWith('--project='),
  )
  const projectOption = readOption(normalizedArgs, 'project')
  const optionValueIndexes = new Set()
  normalizedArgs.forEach((arg, index) => {
    if (
      ['--base', '--profile', '--project', '--shard', '--suite'].includes(arg)
    ) {
      optionValueIndexes.add(index + 1)
    }
  })
  const positionalProject = normalizedArgs.find(
    (arg, index) => !arg.startsWith('-') && !optionValueIndexes.has(index),
  )
  const project = projectOption ?? positionalProject
  const shard = readOption(normalizedArgs, 'shard')
  const list =
    normalizedArgs.includes('--list') || normalizedArgs.includes('--dry-run')
  const evidence = normalizedArgs.includes('--evidence')
  const base = readOption(normalizedArgs, 'base')
  const help =
    normalizedArgs.includes('--help') ||
    normalizedArgs.includes('--help-profiles')

  if (profile && !VISUAL_PROFILES.includes(profile)) {
    throw new Error(
      `Unknown visual profile: ${profile}. Expected one of ${VISUAL_PROFILES.join(', ')}`,
    )
  }

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
  const shardedFullProfile = profile === 'full' || profile === 'evidence'
  if (shard && ((suite !== 'preview' && !shardedFullProfile) || project)) {
    throw new Error(
      '--shard is only valid for preview, full, or evidence without a single-project selection',
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

  return { base, evidence, help, list, profile, project, shard, suite }
}

export function createVisualPlan(
  { profile, project, shard, suite },
  capacityPlan = resolveVisualCapacityPlan(),
  selection,
) {
  const namespaceProfile = profile ?? suite
  const namespaceShard = (shard ?? 'local').replace(/[^a-zA-Z0-9._-]+/gu, '-')
  const selectedProjects = project
    ? [project]
    : (selection?.projects ?? [...PREVIEW_PROJECTS])
  const previewArgs = [
    'exec',
    'playwright',
    'test',
    '--config=vue/playwright.config.ts',
    ...selectedProjects.map((name) => `--project=${name}`),
  ]
  if (selection?.specs?.length) {
    previewArgs.push(
      ...selection.specs.map((spec) =>
        spec.replace(/^vue\/tests\/visual\//u, ''),
      ),
    )
  }
  if (selection?.grep) previewArgs.push('--grep', selection.grep)
  if (shard) previewArgs.push(`--shard=${shard}`)

  const preview = {
    argv: ['pnpm', ...previewArgs],
    projectResultNamespaces: selectedProjects.map(
      (name) =>
        `vue/test-results/profile-${namespaceProfile}/suite-preview/project-${name}/shard-${namespaceShard}`,
    ),
    reportDirectory: `playwright-report/profile-${namespaceProfile}/suite-preview/shard-${namespaceShard}`,
    selectedProjects,
    suite: 'preview',
    workers:
      profile === 'smoke'
        ? Math.min(1, capacityPlan.previewWorkers)
        : capacityPlan.previewWorkers,
    environment:
      selection?.auditComponents?.length > 0
        ? { FSUS_UI_AUDIT_COMPONENTS: selection.auditComponents.join(',') }
        : {},
  }
  const dev = {
    argv: [
      'pnpm',
      'exec',
      'playwright',
      'test',
      '--config=vue/playwright.dev.config.ts',
    ],
    projectResultNamespaces: [
      `vue/test-results/profile-${namespaceProfile}/suite-dev/project-default/shard-${namespaceShard}`,
    ],
    reportDirectory: `playwright-report/profile-${namespaceProfile}/suite-dev/shard-${namespaceShard}`,
    selectedProjects: [],
    suite: 'dev',
    workers: capacityPlan.devWorkers,
    environment: {},
  }

  if (profile === 'smoke' || profile === 'affected') return [preview]
  if (suite === 'preview') return [preview]
  if (suite === 'dev') return [dev]
  if (shard && Number(shard.split('/')[0]) !== 1) return [preview]
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
    if (Object.keys(entry.environment ?? {}).length > 0) {
      console.log(
        `[visual-plan] environment=${Object.entries(entry.environment)
          .map(([name, value]) => `${name}=${value}`)
          .join(' ')}`,
      )
    }
  }
}

export function printVisualProfileHelp() {
  console.log('Visual profiles (browser execution is always explicit):')
  console.log(
    '  pnpm test:visual:smoke     representative desktop/light + compact/dark fixtures',
  )
  console.log(
    '  pnpm test:visual:affected  local Git diff mapped to specs, sections, and audit components',
  )
  console.log(
    '  pnpm test:visual:full      all four projects plus exactly one Dev suite',
  )
  console.log(
    '  pnpm test:visual:evidence  full coverage with successful screenshots, traces, manifest, and HTML reports',
  )
  console.log(
    'Add --dry-run to any profile to print a browser-free, network-free plan.',
  )
  console.log(
    'Affected baseline: --base=<local-ref> or FSUS_VISUAL_BASE=<local-ref>.',
  )
}

export function printVisualSelection(selection) {
  if (!selection) return
  console.log(`[visual-profile] profile=${selection.profile}`)
  if (selection.requestedProfile) {
    console.log(`[visual-profile] requested=${selection.requestedProfile}`)
  }
  if (selection.base) console.log(`[visual-profile] base=${selection.base}`)
  if (selection.changedFiles) {
    console.log(
      `[visual-profile] changed-files=${selection.changedFiles.join(',') || 'none'}`,
    )
  }
  console.log(`[visual-profile] specs=${selection.specs.join(',')}`)
  console.log(
    `[visual-profile] sections=${selection.sections.join(',') || 'none'}`,
  )
  console.log(
    `[visual-profile] audit-components=${selection.auditComponents.join(',') || 'none'}`,
  )
  if (selection.fallbackReason) {
    console.log(
      `[visual-profile] fallback=smoke reason=${selection.fallbackReason}`,
    )
  }
  if (selection.fullRequired) {
    console.log(
      `[visual-profile] full-required=yes files=${selection.fullRequiredFiles.join(',')}`,
    )
    console.log('[visual-profile] recommendation=pnpm test:visual:full')
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
      env: { ...env, ...entry.environment },
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
      env: { ...env, ...entry.environment },
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
    if (options.help) {
      printVisualProfileHelp()
      return
    }
    const registry = loadVisualProfileRegistry()
    const selection =
      options.profile === 'smoke'
        ? createSmokeSelection(registry)
        : options.profile === 'affected'
          ? createAffectedSelection({ base: options.base, registry })
          : undefined
    const capacityPlan = resolveProfileCapacityPlan(
      options.profile,
      resolveVisualCapacityPlan(),
    )
    const plan = createVisualPlan(options, capacityPlan, selection)
    validateVisualPlan(plan, capacityPlan)
    printVisualSelection(selection)
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
          options.profile === 'evidence' ||
          options.evidence ||
          process.env.FSUS_VISUAL_EVIDENCE === '1'
            ? '1'
            : '0',
        FSUS_VISUAL_PROFILE: options.profile ?? options.suite,
        FSUS_VISUAL_SHARD: options.shard ?? 'local',
      }
      console.log(
        `[visual-plan] evidence=${env.FSUS_VISUAL_EVIDENCE === '1' ? 'full' : 'failures-only'}`,
      )
      const testExitCode = await runVisualPlanAsync(plan, {
        capacityPlan,
        env,
      })
      try {
        await writeVisualEvidenceManifest(plan, capacityPlan, testExitCode, env)
      } catch (error) {
        console.error(
          `[visual-evidence] failed to write manifest: ${error instanceof Error ? error.message : String(error)}`,
        )
        process.exitCode = 1
        return
      }
      process.exitCode = testExitCode
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

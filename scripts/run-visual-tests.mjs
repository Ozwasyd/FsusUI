#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

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

  return { list, project, shard, suite }
}

export function createVisualPlan({ project, shard, suite }) {
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
  }

  if (suite === 'preview') return [preview]
  if (suite === 'dev') return [dev]
  return [preview, dev]
}

export function validateVisualPlan(plan) {
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
}

export function printVisualPlan(plan) {
  for (const entry of plan) {
    console.log(`[visual-plan] suite=${entry.suite}`)
    console.log(
      `[visual-plan] selected-projects=${entry.selectedProjects.join(',') || 'none'}`,
    )
    console.log(`[visual-plan] argv=${entry.argv.join(' ')}`)
    console.log(`[visual-plan] report-directory=${entry.reportDirectory}`)
    console.log(
      `[visual-plan] result-namespaces=${entry.projectResultNamespaces.join(',')}`,
    )
  }
}

export function runVisualPlan(plan, spawn = spawnSync) {
  let exitCode = 0

  for (const entry of plan) {
    const [command, ...args] = entry.argv
    const result = spawn(command, args, {
      env: process.env,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
    if (result.status !== 0) exitCode = result.status ?? 1
  }

  return exitCode
}

function main() {
  try {
    const options = parseVisualArgs(process.argv.slice(2))
    const plan = createVisualPlan(options)
    validateVisualPlan(plan)
    printVisualPlan(plan)
    if (!options.list) process.exitCode = runVisualPlan(plan)
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
  main()
}

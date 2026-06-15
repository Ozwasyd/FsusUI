import { spawnSync } from 'node:child_process'
import process from 'node:process'

const mode = process.argv[2]

const pathGroups = {
  node: [
    /^scripts\//,
    /^internal\//,
    /^packages\/wasm\/build\.config\.ts$/,
    /^packages\/theme-chalk\/[^/]+$/,
    /^packages\/element-plus\/version\.ts$/,
    /^packages\/element-plus\/package\.json$/,
    /^tsconfig\.node\.json$/,
    /^package\.json$/,
    /^pnpm-lock\.yaml$/,
  ],
  web: [
    /^packages\/components\//,
    /^packages\/hooks\//,
    /^packages\/directives\//,
    /^packages\/utils\//,
    /^packages\/element-plus\//,
    /^packages\/theme-chalk\//,
    /^packages\/locale\//,
    /^packages\/constants\//,
    /^packages\/test-utils\//,
    /^packages\/wasm\//,
    /^typings\//,
    /^tests\//,
    /^playwright\./,
    /^vite\.config\./,
    /^vitest\.config\./,
    /^tsconfig\.(web|vite-config|vitest|base)\.json$/,
  ],
  unit: [
    /^packages\/components\//,
    /^packages\/hooks\//,
    /^packages\/directives\//,
    /^packages\/utils\//,
    /^packages\/theme-chalk\//,
    /^packages\/wasm\//,
    /^tests\/boundary\//,
    /^vitest\.config\./,
    /^tsconfig\.vitest\.json$/,
  ],
}

function git(args) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  return result.status === 0 ? result.stdout.trim() : ''
}

function parseEnvFiles(value) {
  return String(value ?? '')
    .split(/[\n,]/u)
    .map((file) => file.trim())
    .filter(Boolean)
}

function mergeBaseRef() {
  const explicit = process.env.FSUSUI_AFFECTED_BASE_REF
  if (explicit) return explicit

  const base = process.env.GITHUB_BASE_REF
  if (!base) return ''

  const remoteRef = `origin/${base}`
  const mergeBase = git(['merge-base', 'HEAD', remoteRef])
  return mergeBase || remoteRef
}

function changedFiles() {
  const envFiles = parseEnvFiles(process.env.FSUSUI_AFFECTED_FILES)
  if (envFiles.length > 0) return envFiles

  const baseRef = mergeBaseRef()
  if (baseRef) {
    const files = git(['diff', '--name-only', `${baseRef}...HEAD`])
    if (files) return files.split('\n').filter(Boolean)
  }

  const localFiles = git(['diff', '--name-only', 'HEAD'])
  const untrackedFiles = git(['ls-files', '--others', '--exclude-standard'])
  const localChanges = [
    ...localFiles.split('\n'),
    ...untrackedFiles.split('\n'),
  ].filter(Boolean)
  if (localChanges.length > 0) return [...new Set(localChanges)]

  const previousCommitFiles = git(['diff', '--name-only', 'HEAD~1..HEAD'])
  return previousCommitFiles ? previousCommitFiles.split('\n').filter(Boolean) : []
}

function matchesAny(file, patterns) {
  return patterns.some((pattern) => pattern.test(file))
}

function runScript(scriptName) {
  console.log(`[affected:${mode}] run ${scriptName}`)
  const result = spawnSync('pnpm', ['run', scriptName], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function typecheckScripts(files) {
  const scripts = []
  if (files.some((file) => matchesAny(file, pathGroups.node))) {
    scripts.push('typecheck:node')
  }
  if (files.some((file) => matchesAny(file, pathGroups.web))) {
    scripts.push('typecheck:web', 'typecheck:vitest')
  }
  if (files.some((file) => /^vite\.config\.|^tsconfig\.vite-config\.json$/.test(file))) {
    scripts.push('typecheck:vite-config')
  }
  return [...new Set(scripts)]
}

function unitArgs(files) {
  const targets = []
  if (files.some((file) => /^packages\/components\//.test(file))) targets.push('packages/components')
  if (files.some((file) => /^packages\/hooks\//.test(file))) targets.push('packages/hooks')
  if (files.some((file) => /^packages\/directives\//.test(file))) targets.push('packages/directives')
  if (files.some((file) => /^packages\/utils\//.test(file))) targets.push('packages/utils')
  if (files.some((file) => /^packages\/theme-chalk\//.test(file))) targets.push('packages/theme-chalk')
  if (files.some((file) => /^packages\/wasm\//.test(file))) targets.push('packages/wasm')
  if (files.some((file) => /^tests\/boundary\//.test(file))) targets.push('tests/boundary')
  if (files.some((file) => /^vitest\.config\.|^tsconfig\.vitest\.json$/.test(file))) {
    return ['packages/components', 'packages/hooks', 'packages/directives', 'packages/utils', 'tests/boundary']
  }
  return [...new Set(targets)]
}

function runVitest(targets) {
  console.log(`[affected:${mode}] run vitest ${targets.join(' ')}`)
  const result = spawnSync('pnpm', ['exec', 'vitest', 'run', ...targets], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

if (!['typecheck', 'unit'].includes(mode)) {
  console.error('[affected] usage: node scripts/run-affected-gate.mjs <typecheck|unit>')
  process.exit(2)
}

const files = changedFiles()
console.log(`[affected:${mode}] files=${files.length === 0 ? '(none)' : files.join(',')}`)

if (files.length === 0) {
  if (mode === 'typecheck') {
    runScript('typecheck:node')
    process.exit(0)
  }
  console.log('[affected:unit] no changed files; skipping unit subset')
  process.exit(0)
}

if (mode === 'typecheck') {
  const scripts = typecheckScripts(files)
  if (scripts.length === 0) {
    console.log('[affected:typecheck] docs/workflow-only change; skipping TypeScript typecheck')
    process.exit(0)
  }
  for (const scriptName of scripts) runScript(scriptName)
  process.exit(0)
}

const targets = unitArgs(files)
if (targets.length === 0) {
  console.log('[affected:unit] no unit target affected; skipping unit subset')
  process.exit(0)
}
runVitest(targets)

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import process from 'node:process'

const root = process.cwd()
const cacheDir = path.join(root, '.tmp/typecheck-cache')

const lanes = new Map([
  ['web', { tool: 'vue-tsc', project: 'vue/tsconfig.web.json', noCacheArgs: ['--composite', 'false'] }],
  ['node', { tool: 'tsc', project: 'vue/tsconfig.node.json', noCacheArgs: [] }],
  ['vite-config', { tool: 'vue-tsc', project: 'vue/tsconfig.vite-config.json', noCacheArgs: ['--composite', 'false'] }],
  ['vitest', { tool: 'vue-tsc', project: 'vue/tsconfig.vitest.json', noCacheArgs: ['--composite', 'false'] }],
])

function usage() {
  console.error('Usage: node scripts/run-typecheck.mjs <web|node|vite-config|vitest> [--no-cache]')
}

function git(args) {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  return result.status === 0 ? result.stdout.trim() : ''
}

function sourceFiles() {
  const tracked = git(['ls-files'])
  return tracked
    .split(/\r?\n/u)
    .filter((file) =>
      /^(package\.json|pnpm-lock\.yaml|vue\/tsconfig[^/]*\.json|vue\/typings\/.*\.d\.ts|vue\/packages\/.*\.(ts|tsx|vue|json)|vue\/internal\/.*\.(ts|json)|scripts\/run-typecheck\.mjs)$/u.test(file),
    )
    .sort()
}

function sourceHash() {
  const hash = createHash('sha256')
  for (const file of sourceFiles()) {
    const abs = path.join(root, file)
    if (!existsSync(abs)) continue
    hash.update(file)
    hash.update('\0')
    hash.update(readFileSync(abs))
    hash.update('\0')
  }
  return hash.digest('hex')
}

function cachePath(lane) {
  return path.join(cacheDir, `${lane}.tsbuildinfo`)
}

function run(tool, args) {
  const result = spawnSync('pnpm', ['exec', tool, ...args], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  })
  process.exit(result.status ?? 1)
}

const [lane, ...args] = process.argv.slice(2)
const config = lanes.get(lane)
const noCache = args.includes('--no-cache') || /^(1|true|yes)$/iu.test(process.env.FSUSUI_TYPECHECK_NO_CACHE ?? '')

if (!config || args.some((arg) => arg !== '--no-cache')) {
  usage()
  process.exit(2)
}

const baseArgs = ['-p', config.project, '--noEmit']
if (noCache) {
  console.log(`[typecheck:${lane}] no-cache project=${config.project}`)
  run(config.tool, [...baseArgs, ...config.noCacheArgs])
}

mkdirSync(cacheDir, { recursive: true })
const buildInfoPath = cachePath(lane)
const hash = sourceHash()
const cacheState = existsSync(buildInfoPath) ? 'cache-hit' : 'cache-miss'
console.log(`[typecheck:${lane}] ${cacheState} source-hash=${hash.slice(0, 16)} tsbuildinfo=${path.relative(root, buildInfoPath).replaceAll(path.sep, '/')}`)

run(config.tool, [
  ...baseArgs,
  ...config.noCacheArgs,
  '--incremental',
  '--tsBuildInfoFile',
  buildInfoPath,
])

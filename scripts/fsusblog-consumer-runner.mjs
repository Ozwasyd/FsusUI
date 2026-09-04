#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { canonicalJson } from './fsusui-release-dispatch-lib.mjs'

const args = process.argv.slice(2)
const option = (name) => {
  const index = args.indexOf(name)
  if (index < 0 || !args[index + 1]) throw new Error(`${name} is required.`)
  return path.resolve(args[index + 1])
}
const repo = option('--repository')
const candidate = option('--candidate')
const output = option('--output')
const sha = () =>
  createHash('sha256').update(readFileSync(candidate)).digest('hex')
const safeSha = () => {
  try {
    return sha()
  } catch {
    return null
  }
}
const clean = () =>
  execFileSync('git', ['status', '--porcelain'], {
    cwd: repo,
    encoding: 'utf8',
  }).trim()
    ? 'dirty'
    : 'clean'
const lock = JSON.parse(
  readFileSync(path.join(repo, 'src/frontend/package-lock.json'), 'utf8'),
)
const version = (name) => lock.packages?.[`node_modules/${name}`]?.version
const started = new Date()
const before = sha()
const workingTreeBefore = clean()
const child = spawnSync(
  'npm',
  [
    '--prefix',
    'src/frontend',
    'run',
    'verify:fsusui-candidate',
    '--',
    '--tarball',
    candidate,
  ],
  {
    cwd: repo,
    stdio: 'inherit',
    env: { ...process.env, FSUSBLOG_FSUSUI_CANDIDATE: candidate },
  },
)
const completed = new Date()
const record = {
  commitSha: execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repo,
    encoding: 'utf8',
  }).trim(),
  candidateSha256Before: before,
  candidateSha256After: safeSha(),
  workingTreeBefore,
  workingTreeAfter: clean(),
  commandStatus: child.status === 0 ? 'success' : 'failed',
  durationMs: Math.max(0, completed.getTime() - started.getTime()),
  startedAt: started.toISOString(),
  completedAt: completed.toISOString(),
  toolchain: {
    node: process.version.slice(1),
    npm: execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim(),
    vue: version('vue'),
    vite: version('vite'),
    typescript: version('typescript'),
    vueTsc: version('vue-tsc'),
  },
}
writeFileSync(output, canonicalJson(record), { mode: 0o600 })
if (child.status !== 0) process.exitCode = child.status ?? 1

if (
  !process.argv[1] ||
  path.resolve(process.argv[1]) !== fileURLToPath(import.meta.url)
)
  process.exitCode = 1

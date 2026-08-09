import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

const root = path.resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const valueOf = (name, fallback = '') => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : fallback
}
const base = valueOf('--base')
if (!base) throw new Error('Usage: pnpm perf:render:pr --base <ref>')
const output = path.resolve(root, valueOf('--output', '.tmp/performance/pr'))
const plan = path.join(output, 'impact-plan.json')
const run = (command, commandArgs, cwd = root, env = process.env) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { cwd, env, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code, signal) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} exited with ${code ?? signal}`)),
    )
  })

await mkdir(output, { recursive: true })
await run(process.execPath, [
  'scripts/render-performance-impact-plan.mjs',
  '--base',
  base,
  '--output',
  plan,
])
const parsedPlan = JSON.parse(await readFile(plan, 'utf8'))
if (!parsedPlan.run) {
  console.info(
    'No real-render performance ownership impact; skipping paired measurement.',
  )
  process.exit(0)
}

const suppliedBaseline = valueOf('--baseline-directory')
const temporaryRoot = suppliedBaseline
  ? null
  : await mkdtemp(path.join(os.tmpdir(), 'fsusui-perf-baseline-'))
const baseline = suppliedBaseline
  ? path.resolve(suppliedBaseline)
  : temporaryRoot
let ownsWorktree = false
try {
  if (!suppliedBaseline) {
    await run('git', ['worktree', 'add', '--detach', baseline, base])
    ownsWorktree = true
  }
  const status = path.join(output, 'baseline-status.json')
  await run(process.execPath, [
    'scripts/check-render-performance-baseline.mjs',
    '--directory',
    baseline,
    '--plan',
    plan,
    '--output',
    status,
  ])
  const baselineStatus = JSON.parse(await readFile(status, 'utf8'))
  await run('pnpm', ['install', '--frozen-lockfile'], root)
  if (parsedPlan.platforms.web.run)
    await run('pnpm', ['exec', 'playwright', 'install', 'chromium'], root)
  if (baselineStatus.available) {
    await run('pnpm', ['install', '--frozen-lockfile'], baseline)
    await run(
      'pnpm',
      [
        'perf:render',
        '--',
        '--impact-plan',
        plan,
        '--output',
        path.join(output, 'baseline'),
      ],
      baseline,
    )
  }
  await run('pnpm', [
    'perf:render',
    '--',
    '--impact-plan',
    plan,
    '--output',
    path.join(output, 'current'),
  ])
  if (baselineStatus.available)
    await run('pnpm', [
      'perf:render',
      '--',
      '--impact-plan',
      plan,
      '--output',
      path.join(output, 'current-repeat'),
    ])
  if (baselineStatus.available)
    await run(
      'pnpm',
      [
        'perf:render',
        '--',
        '--impact-plan',
        plan,
        '--output',
        path.join(output, 'baseline-repeat'),
      ],
      baseline,
    )
  if (baselineStatus.available)
    await run('pnpm', [
      'perf:render:compare',
      '--',
      path.join(output, 'baseline'),
      path.join(output, 'current'),
      '0.15',
      path.join(output, 'baseline-repeat'),
      path.join(output, 'current-repeat'),
    ])
} finally {
  if (ownsWorktree)
    await run('git', ['worktree', 'remove', '--force', baseline]).catch(
      () => {},
    )
  if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true })
}

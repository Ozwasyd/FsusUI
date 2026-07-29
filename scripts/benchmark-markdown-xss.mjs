import { spawnSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const release = process.argv.includes('--release')
const pnpmEntry = process.env.npm_execpath
if (!pnpmEntry) {
  throw new Error('[markdown-xss] pnpm entry is unavailable for benchmark')
}

const runCommand = release
  ? '_check:markdown-xss:release'
  : 'check:markdown-xss'
const execute = (label) => {
  const startedAt = performance.now()
  const result = spawnSync(
    process.execPath,
    [pnpmEntry, 'run', runCommand],
    {
      cwd: root,
      env: process.env,
      stdio: 'inherit',
    },
  )
  const seconds = (performance.now() - startedAt) / 1_000
  console.log(`[markdown-xss] timing ${label}=${seconds.toFixed(3)}s`)
  if (result.status !== 0) {
    throw new Error(
      `[markdown-xss] timing command failed label=${label} exit=${result.status}`,
    )
  }
  return seconds
}

if (release) {
  const duration = execute('release')
  if (duration > 120) {
    throw new Error(
      `[markdown-xss] release duration ${duration.toFixed(3)}s exceeds 120s`,
    )
  }
  console.log(
    `[markdown-xss] release performance OK duration=${duration.toFixed(
      3,
    )}s threshold=120s`,
  )
} else {
  execute('warmup')
  const samples = Array.from({ length: 5 }, (_, index) =>
    execute(`fast-${index + 1}`),
  )
  const sorted = [...samples].sort((left, right) => left - right)
  const median = sorted[Math.floor(sorted.length / 2)]
  console.log(
    `[markdown-xss] fast samples=${samples
      .map((sample) => sample.toFixed(3))
      .join(',')} median=${median.toFixed(3)}s threshold=15s`,
  )
  if (median > 15) {
    throw new Error(
      `[markdown-xss] fast median ${median.toFixed(3)}s exceeds 15s`,
    )
  }
}

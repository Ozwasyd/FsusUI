import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { resolveCapacityPlan } from './ci-capacity.mjs'
import { staticGovernanceArgs } from './governance-stage-policy.mjs'

// Only CI's static jobs use this entry point. Full local governance is unchanged;
// mandatory package production owns the one dynamic, candidate-bound check.
const { scripts } = JSON.parse(readFileSync('package.json', 'utf8'))
const args = staticGovernanceArgs(scripts['governance:check'])
const rawTasks = args.slice(2)

// Schedule the longest-running read-only governance gates first (LPT) so shorter
// tasks complete in their shadow and minimize total wall-clock latency.
const heavyTaskPriority = new Map([
  ['check:visual-governance', 0],
  ['avalonia:semantic:check', 1],
  ['test:contract-v2', 2],
  ['avalonia:baseline:check', 3],
  ['test:package-candidate', 4],
  ['check:npm-release-workflow', 5],
])
const tasks = [...rawTasks].sort((left, right) => {
  const leftPriority = heavyTaskPriority.get(left) ?? 100
  const rightPriority = heavyTaskPriority.get(right) ?? 100
  return leftPriority - rightPriority
})

const concurrency = Math.max(
  1,
  Math.min(
    tasks.length,
    4,
    Number(process.env.FSUS_STATIC_GOVERNANCE_CONCURRENCY) ||
      resolveCapacityPlan().budgets.parallelLaneLimit,
  ),
)

console.log(
  `[governance:ci-static] running ${tasks.length} static tasks with concurrency=${concurrency}`,
)

function runTask(task) {
  return new Promise((resolve) => {
    const startedAt = Date.now()
    const chunks = []
    const env = { ...process.env }
    delete env.NODE_OPTIONS
    const child = spawn('pnpm', ['run', task], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    child.stdout.on('data', (chunk) => chunks.push(chunk))
    child.stderr.on('data', (chunk) => chunks.push(chunk))
    child.once('error', (error) => {
      resolve({
        task,
        status: 1,
        durationMs: Date.now() - startedAt,
        output: `${Buffer.concat(chunks).toString('utf8')}\n${error.message}`.trim(),
      })
    })
    child.once('close', (code) => {
      resolve({
        task,
        status: code ?? 1,
        durationMs: Date.now() - startedAt,
        output: Buffer.concat(chunks).toString('utf8').trim(),
      })
    })
  })
}

let cursor = 0
const results = new Array(tasks.length)
const failures = []

async function worker() {
  while (cursor < tasks.length) {
    const index = cursor
    cursor += 1
    const task = tasks[index]
    const result = await runTask(task)
    results[index] = result
    const statusLabel = result.status === 0 ? 'PASS' : 'FAIL'
    console.log(
      `[governance:ci-static] ${statusLabel} ${task} (${(result.durationMs / 1000).toFixed(1)}s)`,
    )
    if (result.status !== 0) {
      failures.push(result)
      if (result.output) console.error(result.output)
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()))

if (failures.length > 0) {
  console.error(
    `[governance:ci-static] failed tasks (${failures.length}): ${failures.map((item) => item.task).join(', ')}`,
  )
  process.exitCode = 1
} else {
  console.log(
    `[governance:ci-static] all ${tasks.length} static governance tasks passed.`,
  )
}

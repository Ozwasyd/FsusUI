import {
  prepareHistoricalSdk,
  assertHistoricalIdentity,
} from './historical-render-environment.mjs'
import { spawn } from 'node:child_process'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { verifyImpactPlan } from './render-performance-impact.mjs'

const root = path.resolve(import.meta.dirname, '..')
const json = async (file) => JSON.parse(await readFile(file, 'utf8'))
const requireThat = (condition, message) => {
  if (!condition) throw new Error(`Historical baseline rejected: ${message}`)
}
const finite = (value) => Number.isFinite(value) && value >= 0
const samples = (values, count) =>
  Array.isArray(values) && values.length === count && values.every(finite)
const p95 = (values) =>
  [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1]

export async function validateBaselineEvidence(
  directory,
  plan,
  sha,
  startedAt,
) {
  const savedPlan = verifyImpactPlan(
    await json(path.join(directory, 'impact-plan.json')),
  )
  requireThat(savedPlan.planDigest === plan.planDigest, 'impact plan identity')
  for (const platform of ['web', 'avalonia']) {
    if (!plan.platforms[platform].run) continue
    const summary = await json(path.join(directory, platform, 'summary.json'))
    const native = platform === 'avalonia'
    requireThat(
      (native ? summary.GitSha : summary.gitSha) === sha,
      'checkout identity',
    )
    requireThat(
      (native ? summary.Profile : summary.profile) === plan.measurement.profile,
      'profile',
    )
    const generatedAt = Date.parse(
      native ? summary.GeneratedAt : summary.generatedAt,
    )
    requireThat(
      Number.isFinite(generatedAt) && generatedAt >= startedAt,
      'fresh measurement timestamp',
    )
    const runner = native ? summary.Runner : summary.runner
    requireThat(
      (native ? runner?.Samples : runner?.samples) === plan.measurement.samples,
      'sample count',
    )
    requireThat(
      (native ? runner?.Warmups : runner?.warmups) === plan.measurement.warmups,
      'warmup count',
    )
    const entries = native ? summary.Results : summary.results
    const count = native ? runner.ScenarioCount : runner.matrixSize
    requireThat(
      Array.isArray(entries) && entries.length > 0 && entries.length === count,
      'complete scenario matrix',
    )
    const ids = entries.map((entry) => (native ? entry.Id : entry.id))
    requireThat(
      new Set(ids).size === ids.length &&
        ids.every((id) => /^[\w.-]+$/u.test(id)),
      'unique scenario identities',
    )
    if (native) {
      for (const key of [
        'RenderingBackend',
        'WindowPlatform',
        'PlatformGraphicsBackend',
      ])
        requireThat(
          typeof summary.Environment?.[key] === 'string' &&
            summary.Environment[key] !== 'unresolved' &&
            summary.Environment[key].length > 0,
          `resolved ${key}`,
        )
    } else
      requireThat(
        /^Chromium \S+/u.test(summary.environment?.browser ?? ''),
        'resolved browser',
      )
    for (const entry of entries) {
      const id = native ? entry.Id : entry.id
      const raw = await json(
        path.join(
          directory,
          platform,
          ...(native ? ['raw'] : []),
          `${id}.raw.json`,
        ),
      )
      requireThat((native ? raw.Id : raw.id) === id, 'raw scenario identity')
      const values = native ? raw.FrameMs : raw.inputToFrame
      requireThat(
        samples(values, plan.measurement.samples),
        'complete finite raw frame samples',
      )
      requireThat(
        p95(values) ===
          (native ? entry.FrameMs?.P95 : entry.inputToNextFrameMs?.p95),
        'raw/summary p95 agreement',
      )
      if (native) {
        for (const key of [
          'MeasureArrangeMs',
          'DrawMs',
          'MountUnmountMs',
          'AllocatedBytes',
        ]) {
          requireThat(
            samples(raw[key], plan.measurement.samples),
            `complete raw ${key}`,
          )
          requireThat(
            entry[key]?.Max === Math.max(...raw[key]) &&
              entry[key]?.P95 === p95(raw[key]),
            `raw/summary ${key} agreement`,
          )
        }
        requireThat(
          raw.LongScroll?.Iterations === runner.LongScrollIterations &&
            runner.LongScrollIterations >= 256,
          'long-scroll evidence',
        )
        requireThat(
          entry.RetainedVisuals?.ReturnedToBaseline === true &&
            finite(entry.RetainedVisuals?.AfterUnload),
          'visual disposal evidence',
        )
      } else {
        requireThat(
          finite(entry.droppedFrameRate) &&
            entry.droppedFrameRate === raw.droppedFrameRate,
          'dropped-frame evidence',
        )
        requireThat(
          finite(entry.domNodes) && entry.domNodes === raw.domNodes,
          'DOM evidence',
        )
        requireThat(
          Array.isArray(raw.longTasks) &&
            raw.longTasks.every(finite) &&
            entry.longTasks?.longestMs === Math.max(0, ...raw.longTasks),
          'long-task evidence',
        )
      }
    }
  }
}

export function classifyHistoricalFailure(result, checker) {
  requireThat(
    result.code === 1 &&
      !result.signal &&
      checker.code === 1 &&
      !checker.signal,
    'non-policy process failure',
  )
  const errors = [...result.stderr.matchAll(/^Error: (.+)$/gmu)].map(
    (match) => match[1],
  )
  requireThat(
    errors.length === 2 &&
      errors[0] === 'Absolute runaway performance limits failed:' &&
      /^.+[/\\]node(?:\.exe)? exited with 1$/u.test(errors[1]),
    'unexpected failure chain',
  )
  const lines = (text) =>
    text.split('\n').filter((line) => /^(?:web|avalonia)\//u.test(line))
  const violations = lines(checker.stderr)
  requireThat(
    violations.length > 0 &&
      violations.every((line) => / exceeded runaway limit$/u.test(line)),
    'not an absolute metric violation',
  )
  requireThat(
    JSON.stringify(lines(result.stderr)) === JSON.stringify(violations),
    'checker failure disagreement',
  )
  return violations
}

const run = (command, args, options) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = '',
      stderr = ''
    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk)
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk)
      stderr += chunk
    })
    child.once('error', reject)
    child.once('close', (code, signal) =>
      resolve({ code, signal, stdout, stderr }),
    )
  })

async function main() {
  const args = process.argv.slice(2)
  const value = (name) => args[args.indexOf(name) + 1]
  for (const name of [
    '--directory',
    '--expected-sha',
    '--impact-plan',
    '--output',
  ])
    requireThat(args.includes(name) && value(name), `required ${name}`)
  const directory = path.resolve(value('--directory'))
  const output = path.resolve(value('--output'))
  const sha = value('--expected-sha')
  requireThat(/^[a-f0-9]{40}$/u.test(sha), 'exact historical SHA required')
  await assertHistoricalIdentity(directory, sha, output, 'before')
  const planPath = path.resolve(value('--impact-plan'))
  const plan = verifyImpactPlan(await json(planPath))
  requireThat(plan.run, 'measurement plan is skipped')
  for (const platform of ['web', 'avalonia']) {
    await access(path.join(output, platform)).then(
      () => {
        throw new Error('Historical baseline output must be fresh')
      },
      (error) => {
        if (error.code !== 'ENOENT') throw error
      },
    )
  }
  await mkdir(output, { recursive: true })
  const sdk = plan.platforms.avalonia.run
    ? await prepareHistoricalSdk(directory, root)
    : {
        env: process.env,
        cleanup: async () => {},
        evidence: { nativeSdkRequired: false },
      }
  await writeFile(
    path.join(output, 'historical-sdk.json'),
    `${JSON.stringify(sdk.evidence, null, 2)}\n`,
  ).catch(async (error) => {
    await sdk.cleanup()
    throw error
  })
  const startedAt = Date.now()
  let result
  try {
    result = await run(
      'pnpm',
      [
        'perf:render',
        '--',
        '--impact-plan',
        planPath,
        '--profile',
        plan.measurement.profile,
        '--output',
        output,
      ],
      { cwd: directory, env: { ...sdk.env, GITHUB_SHA: sha } },
    )
  } finally {
    await sdk.cleanup()
  }
  await writeFile(
    path.join(output, 'historical-process.log'),
    `${result.stdout}\n${result.stderr}`,
  )
  await assertHistoricalIdentity(directory, sha, output, 'after')
  await validateBaselineEvidence(output, plan, sha, startedAt)
  let violations = []
  if (result.code !== 0 || result.signal) {
    for (const file of [
      'scripts/check-render-performance-results.mjs',
      'tests/performance/render-performance-policy.json',
    ])
      requireThat(
        (await readFile(path.join(directory, file))).equals(
          await readFile(path.join(root, file)),
        ),
        `historical acceptance contract changed: ${file}`,
      )
    const checker = await run(
      process.execPath,
      [path.join(root, 'scripts/check-render-performance-results.mjs'), output],
      { cwd: root },
    )
    violations = classifyHistoricalFailure(result, checker)
  }
  const status = {
    schemaVersion: 1,
    kind: 'historical-baseline-measurement',
    sha,
    planDigest: plan.planDigest,
    exitCode: result.code,
    status: violations.length ? 'complete-over-limit' : 'complete',
    violations,
  }
  await writeFile(
    path.join(output, 'historical-measurement-status.json'),
    `${JSON.stringify(status, null, 2)}\n`,
  )
  console.info(
    `Historical baseline ${status.status}; candidate absolute limits and paired comparison remain required.`,
  )
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  await main()

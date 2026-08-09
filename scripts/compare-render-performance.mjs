import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { verifyImpactPlan } from './render-performance-impact.mjs'

// pnpm/npm may forward a literal `--` when invoked as `pnpm script -- args`.
const [
  baselineDirectory,
  currentDirectory,
  limitArgument = '0.15',
  baselineRepeatDirectory,
  currentRepeatDirectory,
] = process.argv.slice(2).filter((argument) => argument !== '--')
if (!baselineDirectory || !currentDirectory) {
  throw new Error(
    'Usage: compare-render-performance.mjs <baseline-dir> <current-dir> [relative-limit] [baseline-repeat-dir current-repeat-dir]',
  )
}
if (Boolean(baselineRepeatDirectory) !== Boolean(currentRepeatDirectory))
  throw new Error(
    'Order-balanced comparison requires both baseline and current repeat directories',
  )
const limit = Number(limitArgument)
const read = async (directory, platform) =>
  JSON.parse(
    await readFile(path.join(directory, platform, 'summary.json'), 'utf8'),
  )
const metricValue = (entry, platform) =>
  platform === 'web' ? entry.inputToNextFrameMs.p95 : entry.FrameMs.P95

const readPlan = async (directory) =>
  readFile(path.join(directory, 'impact-plan.json'), 'utf8')
    .then((value) => verifyImpactPlan(JSON.parse(value)))
    .catch((error) => {
      if (error.code === 'ENOENT') return null
      throw error
    })
const baselinePlan = await readPlan(baselineDirectory)
const currentPlan = await readPlan(currentDirectory)
const baselineRepeatPlan = baselineRepeatDirectory
  ? await readPlan(baselineRepeatDirectory)
  : null
const currentRepeatPlan = currentRepeatDirectory
  ? await readPlan(currentRepeatDirectory)
  : null
const plans = [
  baselinePlan,
  currentPlan,
  baselineRepeatPlan,
  currentRepeatPlan,
].filter(Boolean)
const expectedPlanCount = baselineRepeatDirectory ? 4 : 2
if (
  (plans.length !== 0 && plans.length !== expectedPlanCount) ||
  plans.some((plan) => plan.planDigest !== plans[0]?.planDigest)
)
  throw new Error(
    `Performance plan digest mismatch: ${plans.map((plan) => plan.planDigest).join(' ')}`,
  )

const regressions = []
for (const platform of ['web', 'avalonia']) {
  if (currentPlan && !currentPlan.platforms[platform].run) continue
  const baseline = await read(baselineDirectory, platform)
  const current = await read(currentDirectory, platform)
  const baselineRepeat = baselineRepeatDirectory
    ? await read(baselineRepeatDirectory, platform)
    : null
  const currentRepeat = currentRepeatDirectory
    ? await read(currentRepeatDirectory, platform)
    : null
  const entriesOf = (summary) => summary.results ?? summary.Results
  const mapOf = (summary) =>
    new Map(entriesOf(summary).map((entry) => [entry.id ?? entry.Id, entry]))
  const baselineMap = mapOf(baseline)
  const baselineRepeatMap = baselineRepeat ? mapOf(baselineRepeat) : null
  const currentRepeatMap = currentRepeat ? mapOf(currentRepeat) : null
  const currentResults = current.results ?? current.Results
  const currentIds = new Set(
    currentResults.map((entry) => entry.id ?? entry.Id),
  )
  for (const id of baselineMap.keys()) {
    if (!currentIds.has(id))
      regressions.push(
        `${platform}/${id}: baseline unavailable/contract changed; current scenario is missing from the shared plan`,
      )
  }
  for (const entry of currentResults) {
    const id = entry.id ?? entry.Id
    const previous = baselineMap.get(id)
    if (!previous) {
      regressions.push(
        `${platform}/${id}: baseline unavailable/contract changed; missing same-runner scenario`,
      )
      continue
    }
    const previousRepeat = baselineRepeatMap?.get(id)
    const entryRepeat = currentRepeatMap?.get(id)
    if (baselineRepeatDirectory && (!previousRepeat || !entryRepeat)) {
      regressions.push(
        `${platform}/${id}: order-balanced repeat is missing from the shared plan`,
      )
      continue
    }
    const beforeFirst = metricValue(previous, platform)
    const afterFirst = metricValue(entry, platform)
    const before = previousRepeat
      ? Math.sqrt(beforeFirst * metricValue(previousRepeat, platform))
      : beforeFirst
    const after = entryRepeat
      ? Math.sqrt(afterFirst * metricValue(entryRepeat, platform))
      : afterFirst
    if (before > 0 && after > before * (1 + limit)) {
      regressions.push(
        `${platform}/${id}: ${baselineRepeatDirectory ? 'order-balanced ' : ''}p95 ${after.toFixed(2)}ms > ${before.toFixed(2)}ms + ${(limit * 100).toFixed(0)}%`,
      )
    }
  }
}
if (regressions.length) {
  throw new Error(
    `Relative real-render performance regressions:\n${regressions.join('\n')}`,
  )
}
console.info(
  `Relative real-render performance passed (${baselineRepeatDirectory ? 'order-balanced, ' : ''}limit ${(limit * 100).toFixed(0)}%).`,
)

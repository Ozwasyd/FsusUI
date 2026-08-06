import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { verifyImpactPlan } from './render-performance-impact.mjs'

// pnpm/npm may forward a literal `--` when invoked as `pnpm script -- args`.
const [baselineDirectory, currentDirectory, limitArgument = '0.15'] =
  process.argv.slice(2).filter((argument) => argument !== '--')
if (!baselineDirectory || !currentDirectory) {
  throw new Error(
    'Usage: compare-render-performance.mjs <baseline-dir> <current-dir> [relative-limit]',
  )
}
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
if (Boolean(baselinePlan) !== Boolean(currentPlan))
  throw new Error('Performance plan is missing from one side of the comparison')
if (baselinePlan?.planDigest !== currentPlan?.planDigest)
  throw new Error(
    `Performance plan digest mismatch: baseline=${baselinePlan?.planDigest} current=${currentPlan?.planDigest}`,
  )

const regressions = []
for (const platform of ['web', 'avalonia']) {
  if (currentPlan && !currentPlan.platforms[platform].run) continue
  const baseline = await read(baselineDirectory, platform)
  const current = await read(currentDirectory, platform)
  const baselineMap = new Map(
    baseline.results?.map((entry) => [entry.id, entry]) ??
      baseline.Results.map((entry) => [entry.Id, entry]),
  )
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
    const before = metricValue(previous, platform)
    const after = metricValue(entry, platform)
    if (before > 0 && after > before * (1 + limit)) {
      regressions.push(
        `${platform}/${id}: p95 ${after.toFixed(2)}ms > ${before.toFixed(2)}ms + ${(limit * 100).toFixed(0)}%`,
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
  `Relative real-render performance passed (limit ${(limit * 100).toFixed(0)}%).`,
)

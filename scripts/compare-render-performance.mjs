import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const [baselineDirectory, currentDirectory, limitArgument = '0.15'] =
  process.argv.slice(2)
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

const regressions = []
for (const platform of ['web', 'avalonia']) {
  const baseline = await read(baselineDirectory, platform)
  const current = await read(currentDirectory, platform)
  const baselineMap = new Map(
    baseline.results?.map((entry) => [entry.id, entry]) ??
      baseline.Results.map((entry) => [entry.Id, entry]),
  )
  const currentResults = current.results ?? current.Results
  for (const entry of currentResults) {
    const id = entry.id ?? entry.Id
    const previous = baselineMap.get(id)
    if (!previous) {
      regressions.push(`${platform}/${id}: missing same-runner baseline`)
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

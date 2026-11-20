import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { isDeepStrictEqual } from 'node:util'
import { verifyWebMeasurement } from './verify-quick-web-60hz.mjs'
import { verifyImpactPlan } from './render-performance-impact.mjs'
import { historicalNativeSha, nativeDriverHash, isNativeSplitProtocol, supportedNativeProtocol, readNativeBinding } from './run-avalonia-layout-ready.mjs'
import { verifyAvaloniaLayoutReady } from './verify-avalonia-layout-ready.mjs'
import { identifyNativeProtocol, verifyAvaloniaSplitArm } from './verify-avalonia-split-arm.mjs'

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
if (!limitArgument.trim() || !Number.isFinite(limit) || limit < 0 || limit > 1)
  throw new Error('Relative performance limit must be a number from 0 to 1')
const read = async (directory, platform) =>
  JSON.parse(
    await readFile(path.join(directory, platform, 'summary.json'), 'utf8'),
  )
const metricValue = (entry, platform) =>
  platform === 'web' ? entry.inputToNextFrameMs?.p95 : entry.FrameMs?.P95

const measurementMap = (summary, platform, arm) => {
  const entries = summary.results ?? summary.Results
  if (!Array.isArray(entries) || entries.length === 0)
    throw new Error(`${platform}/${arm}: empty scenario matrix`)
  const result = new Map()
  for (const entry of entries) {
    const id = entry?.id ?? entry?.Id
    if (typeof id !== 'string' || !id.trim() || result.has(id))
      throw new Error(`${platform}/${arm}: invalid or duplicate scenario ${id}`)
    const p95 = metricValue(entry, platform)
    if (!Number.isFinite(p95) || p95 <= 0)
      throw new Error(
        `${platform}/${id}: ${arm} p95 must be finite and positive`,
      )
    result.set(id, p95)
  }
  return result
}

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

const protocol = process.env.FSUSUI_WEB_MEASUREMENT_PROTOCOL
if (protocol && protocol !== 'quick-web-60hz.v1') throw new Error('unsupported Web protocol')
const webSummary = currentPlan?.platforms.web.run === false ? null : await read(currentDirectory,'web')
if (currentPlan?.platforms.web.run !== false && (protocol || webSummary?.measurementProtocol)) {
  if (limit !== 0.15) throw new Error('60Hz protocol preserves the 15% regression limit')
  if (!baselineRepeatDirectory || !currentRepeatDirectory) throw new Error('60Hz protocol requires four arms')
  const candidateSha = execFileSync('git',['rev-parse','HEAD'],{cwd:path.resolve(import.meta.dirname,'..'),encoding:'utf8'}).trim()
  const candidateDriverHash = createHash('sha256').update(execFileSync('git',['show',`${candidateSha}:scripts/web-render-performance.mjs`],{cwd:path.resolve(import.meta.dirname,'..')})).digest('hex')
  const bindings=[]
  for (const [directory,kind] of [[baselineDirectory,'f2d-historical'],[currentDirectory,'292-candidate'],[baselineRepeatDirectory,'f2d-historical'],[currentRepeatDirectory,'292-candidate']]) {
    bindings.push(await verifyWebMeasurement(path.join(directory,'web'),kind,kind === 'f2d-historical' ? 'f2d929a5d045439c35e93b4771f912ce50ec2337' : candidateSha))
  }
  if (bindings[1].sourceSha256 !== candidateDriverHash || bindings[3].sourceSha256 !== candidateDriverHash) throw new Error('candidate driver differs from expected checkout')
  if (bindings.some(x=>x.protocolDigest!==bindings[0].protocolDigest) || bindings[0].productSha!==bindings[2].productSha || bindings[1].productSha!==bindings[3].productSha) throw new Error('four-arm protocol/source identity mismatch')
}
const native = process.env.FSUSUI_AVALONIA_MEASUREMENT_PROTOCOL
if (native && !supportedNativeProtocol(native)) throw new Error('unsupported Avalonia protocol')
const splitSummaries = new Map()
if (currentPlan?.platforms.avalonia.run !== false) {
  const dirs = [baselineDirectory, currentDirectory, baselineRepeatDirectory, currentRepeatDirectory].filter(Boolean)
  const nativeSummaries = await Promise.all(dirs.map((directory) => read(directory, 'avalonia')))
  const effectiveNativeProtocol = identifyNativeProtocol(native, nativeSummaries)
  if (effectiveNativeProtocol) {
    if (limit !== 0.15 || dirs.length !== 4) throw new Error('Avalonia layout-ready requires four arms and the 15% limit')
    const controllerRoot = path.resolve(import.meta.dirname, '..')
    const sha = execFileSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: controllerRoot, encoding: 'utf8' }).trim()
    const split = isNativeSplitProtocol(effectiveNativeProtocol)
    const driverHash = await nativeDriverHash(controllerRoot, { committed: split })
    let splitEnvironment
    let scenario = currentPlan ? (currentPlan.platforms.avalonia.scenario ?? '') : undefined
    for (const [index, directory] of dirs.entries()) {
      const expected = index % 2 === 0 ? historicalNativeSha : sha
      const nativeOutput = path.join(directory, 'avalonia')
      if (nativeSummaries[index].GitSha !== expected) throw new Error('Avalonia layout-ready summary identity mismatch')
      if (split) {
        const { canonical, theme, sustained } = await verifyAvaloniaSplitArm(nativeOutput, {
          productSha: expected, driverHash, plan: currentPlan, protocol: effectiveNativeProtocol,
        })
        if (splitEnvironment && !isDeepStrictEqual(splitEnvironment, canonical.Environment))
          throw new Error('Avalonia split runtime and renderer must match in all four arms')
        splitEnvironment ??= canonical.Environment
        splitSummaries.set(directory, [...canonical.Results, ...(theme?.Results ?? []), ...sustained.Results])
      } else {
        const proof = await readNativeBinding(nativeOutput, expected, driverHash, scenario)
        scenario ??= proof.scenario
        await verifyAvaloniaLayoutReady(nativeOutput, { scenario, impactPlan: currentPlan })
      }
    }
  }
}
const readComparable = async (directory, platform) =>
  platform === 'avalonia' && splitSummaries.has(directory)
    ? { Results: splitSummaries.get(directory) }
    : read(directory, platform)
const regressions = []
for (const platform of ['web', 'avalonia']) {
  if (currentPlan && !currentPlan.platforms[platform].run) continue
  const baseline = await readComparable(baselineDirectory, platform)
  const current = await readComparable(currentDirectory, platform)
  const baselineRepeat = baselineRepeatDirectory
    ? await readComparable(baselineRepeatDirectory, platform)
    : null
  const currentRepeat = currentRepeatDirectory
    ? await readComparable(currentRepeatDirectory, platform)
    : null
  const baselineMap = measurementMap(baseline, platform, 'baseline')
  const currentMap = measurementMap(current, platform, 'current')
  const baselineRepeatMap = baselineRepeat
    ? measurementMap(baselineRepeat, platform, 'baseline-repeat')
    : null
  const currentRepeatMap = currentRepeat
    ? measurementMap(currentRepeat, platform, 'current-repeat')
    : null
  const selectedScenario = currentPlan?.platforms[platform].scenario
  if (selectedScenario) {
    for (const measurements of [
      baselineMap,
      currentMap,
      baselineRepeatMap,
      currentRepeatMap,
    ]) {
      for (const id of measurements?.keys() ?? []) {
        // Match the existing producer filters, without changing the measured workload.
        const selected =
          platform === 'web'
            ? id.startsWith(selectedScenario)
            : id.toLowerCase().includes(selectedScenario.toLowerCase())
        if (!selected)
          regressions.push(
            `${platform}/${id}: scenario is outside the selected impact plan scope ${selectedScenario}`,
          )
      }
    }
  }
  for (const id of baselineMap.keys()) {
    if (!currentMap.has(id))
      regressions.push(
        `${platform}/${id}: baseline unavailable/contract changed; current scenario is missing from the shared plan`,
      )
  }
  for (const repeat of [baselineRepeatMap, currentRepeatMap]) {
    for (const id of repeat?.keys() ?? []) {
      if (!currentMap.has(id) || !baselineMap.has(id))
        regressions.push(
          `${platform}/${id}: extra order-balanced repeat scenario`,
        )
    }
  }
  for (const [id, afterFirst] of currentMap) {
    const beforeFirst = baselineMap.get(id)
    if (beforeFirst === undefined) {
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
    const before = previousRepeat
      ? Math.sqrt(beforeFirst * previousRepeat)
      : beforeFirst
    const after = entryRepeat ? Math.sqrt(afterFirst * entryRepeat) : afterFirst
    if (
      !Number.isFinite(before) ||
      before <= 0 ||
      !Number.isFinite(after) ||
      after <= 0
    )
      throw new Error(
        `${platform}/${id}: aggregate p95 must be finite and positive`,
      )
    if (after > before * (1 + limit)) {
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

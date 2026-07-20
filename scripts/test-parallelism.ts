import { availableParallelism, cpus } from 'node:os'
import { resolveCapacityPlan } from './ci-capacity.cjs'
import { resolveVisualCapacityPlan } from './visual-capacity.cjs'

const positiveInteger = (value: string | undefined) => {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

const availableWorkers = () => {
  const available = availableParallelism?.() ?? cpus().length
  return Math.max(1, available || 1)
}

export const resolveWorkerCount = (specificEnv: string) =>
  positiveInteger(process.env[specificEnv]) ??
  positiveInteger(process.env.FSUS_TEST_WORKERS) ??
  availableWorkers()

export const resolveVitestWorkers = () =>
  Math.min(
    resolveWorkerCount('FSUS_VITEST_WORKERS'),
    resolveCapacityPlan().vitestWorkersPerShard,
  )

export const resolvePlaywrightWorkers = () =>
  Math.min(
    resolveWorkerCount('FSUS_PLAYWRIGHT_WORKERS'),
    resolveCapacityPlan().lanes.visual,
  )

export const resolveVisualPreviewWorkers = () =>
  resolveVisualCapacityPlan().previewWorkers

export const resolveVisualDevWorkers = () =>
  resolveVisualCapacityPlan().devWorkers

export const resolveVisualAuditBucketCount = () =>
  resolveVisualCapacityPlan().auditBucketCount

export const resolveDomLayoutWorkers = () =>
  positiveInteger(process.env.FSUS_DOM_LAYOUT_WORKERS) ?? 1

export const resolveTestPort = (specificEnv: string, fallback: number) =>
  positiveInteger(process.env[specificEnv]) ?? fallback

export const resolveDomLayoutChunkSize = () =>
  positiveInteger(process.env.FSUS_DOM_LAYOUT_CHUNK_SIZE) ?? 12

const safeNamespace = (value: string | undefined, fallback: string) =>
  (value || fallback).replace(/[^a-zA-Z0-9._-]+/g, '-')

export const createVisualResultDirectory = (
  suiteName: string,
  projectName: string,
) =>
  `test-results/profile-${safeNamespace(process.env.FSUS_VISUAL_PROFILE, 'direct')}/suite-${safeNamespace(suiteName, 'unknown')}/project-${safeNamespace(projectName, 'default')}/shard-${safeNamespace(process.env.FSUS_VISUAL_SHARD, 'local')}`

export const createPlaywrightReporter = (suiteName: string) => {
  const outputFolder = `playwright-report/profile-${safeNamespace(process.env.FSUS_VISUAL_PROFILE, 'direct')}/suite-${safeNamespace(suiteName, 'unknown')}/shard-${safeNamespace(process.env.FSUS_VISUAL_SHARD, 'local')}`
  const htmlReporter = [
    'html',
    {
      open: 'never',
      outputFolder,
    },
  ]
  return process.env.CI
    ? [['github'], htmlReporter]
    : process.env.FSUS_VISUAL_EVIDENCE === '1'
      ? [['list'], htmlReporter]
      : 'list'
}

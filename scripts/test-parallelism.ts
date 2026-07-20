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

export const createPlaywrightReporter = (suiteName: string) =>
  process.env.CI
    ? [
        ['github'],
        [
          'html',
          {
            open: 'never',
            outputFolder: `playwright-report/${suiteName}`,
          },
        ],
      ]
    : 'list'

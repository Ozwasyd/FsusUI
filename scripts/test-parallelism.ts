import { availableParallelism, cpus } from 'node:os'

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
  resolveWorkerCount('FSUS_VITEST_WORKERS')

export const resolvePlaywrightWorkers = () =>
  resolveWorkerCount('FSUS_PLAYWRIGHT_WORKERS')

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

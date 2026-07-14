import { writeFile } from 'node:fs/promises'
import os from 'node:os'
import process from 'node:process'
import { performance } from 'node:perf_hooks'
import { ref, shallowRef, watch } from 'vue'

const argv = process.argv.slice(2)
const valueOf = (name, fallback) => {
  const index = argv.indexOf(name)
  return index >= 0 ? argv[index + 1] : fallback
}
const size = Number(valueOf('--size', '100000'))
const samples = Number(valueOf('--samples', '7'))
const output = valueOf('--output', '')

if (!Number.isSafeInteger(size) || size <= 0) {
  throw new Error('--size must be a positive safe integer')
}
if (!Number.isSafeInteger(samples) || samples < 3) {
  throw new Error('--samples must be an integer of at least 3')
}

const percentile = (values, ratio) => {
  const ordered = [...values].sort((left, right) => left - right)
  return ordered[
    Math.min(ordered.length - 1, Math.ceil(values.length * ratio) - 1)
  ]
}
const stats = (values) => ({
  min: Math.min(...values),
  p50: percentile(values, 0.5),
  p95: percentile(values, 0.95),
  p99: percentile(values, 0.99),
  max: Math.max(...values),
  samples: values.length,
})

const rawRowsA = Array.from({ length: size }, (_, index) => ({
  id: index,
  meta: { revision: 0 },
  score: index % 997,
}))
const rawRowsB = rawRowsA.map((row) => ({ ...row }))

const deepRows = ref(
  rawRowsA.map((row) => ({
    ...row,
    meta: { ...row.meta },
  })),
)
const identityRows = shallowRef(rawRowsA)
const explicitVersion = ref(0)
let deepCommits = 0
let identityCommits = 0
let versionCommits = 0

const deepSetupStarted = performance.now()
const stopDeep = watch(
  deepRows,
  () => {
    deepCommits += 1
  },
  { deep: true, flush: 'sync' },
)
const deepSetupMs = performance.now() - deepSetupStarted
const stopIdentity = watch(
  identityRows,
  () => {
    identityCommits += 1
  },
  { flush: 'sync' },
)
const stopVersion = watch(
  explicitVersion,
  () => {
    versionCommits += 1
    void identityRows.value.length
  },
  { flush: 'sync' },
)

const deepUpdateMs = []
const identityUpdateMs = []
const versionUpdateMs = []
for (let iteration = 0; iteration < samples + 1; iteration++) {
  const rowIndex = (iteration * 7919) % size
  let started = performance.now()
  deepRows.value[rowIndex].meta.revision += 1
  const deepDuration = performance.now() - started

  started = performance.now()
  identityRows.value = iteration % 2 === 0 ? rawRowsB : rawRowsA
  const identityDuration = performance.now() - started

  started = performance.now()
  explicitVersion.value += 1
  const versionDuration = performance.now() - started

  if (iteration > 0) {
    deepUpdateMs.push(deepDuration)
    identityUpdateMs.push(identityDuration)
    versionUpdateMs.push(versionDuration)
  }
}

stopDeep()
stopIdentity()
stopVersion()

const result = {
  schemaVersion: 1,
  kind: 'fsusui-table-data-change-performance',
  generatedAt: new Date().toISOString(),
  environment: {
    cpu: os.cpus()[0]?.model ?? 'unknown',
    logicalCores: os.cpus().length,
    node: process.version,
    platform: `${process.platform} ${os.release()} ${process.arch}`,
  },
  size,
  deepSetupMs,
  deepUpdateMs: stats(deepUpdateMs),
  identityUpdateMs: stats(identityUpdateMs),
  versionUpdateMs: stats(versionUpdateMs),
  commits: {
    deep: deepCommits,
    identity: identityCommits,
    version: versionCommits,
  },
}

const identityRatio = result.identityUpdateMs.p95 / result.deepUpdateMs.p95
const versionRatio = result.versionUpdateMs.p95 / result.deepUpdateMs.p95
if (identityRatio >= 0.5 || versionRatio >= 0.5) {
  throw new Error(
    `Explicit Table data boundaries must reduce p95 by at least 50% versus deep tracking; identity=${identityRatio.toFixed(3)}, version=${versionRatio.toFixed(3)}`,
  )
}

if (output) await writeFile(output, `${JSON.stringify(result, null, 2)}\n`)
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)

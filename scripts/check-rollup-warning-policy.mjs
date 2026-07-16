import { readFileSync } from 'node:fs'

const policyFile = 'vue/internal/build/src/utils/rollup.ts'
const taskFiles = [
  'vue/internal/build/src/tasks/full-bundle.ts',
  'vue/internal/build/src/tasks/modules.ts',
]
const policySource = readFileSync(policyFile, 'utf8')

function assert(condition, message) {
  if (!condition) {
    console.error(`[rollup-warning-policy] ${message}`)
    process.exit(1)
  }
}

for (const packageName of [
  'd3-interpolate',
  'd3-selection',
  'd3-transition',
  'mlly',
  'semver',
]) {
  assert(
    policySource.includes(`'${packageName}'`),
    `${policyFile} must list the exact ${packageName} package`,
  )
}

assert(
  policySource.includes("warning.code !== 'CIRCULAR_DEPENDENCY'") &&
    policySource.includes('participants.every') &&
    policySource.includes('packageNameFromModulePath'),
  `${policyFile} must require every circular participant to resolve to an allowed package`,
)
assert(
  !policySource.includes("source.includes('d3-") &&
    !policySource.includes("source.includes('mlly')") &&
    !policySource.includes("source.includes('semver"),
  `${policyFile} must not suppress circular warnings with broad substring checks`,
)

for (const taskFile of taskFiles) {
  const source = readFileSync(taskFile, 'utf8')
  assert(
    source.includes('shouldIgnoreRollupWarning') &&
      source.includes('if (shouldIgnoreRollupWarning(warning)) return'),
    `${taskFile} must use the shared warning policy`,
  )
}

console.log('[rollup-warning-policy] ok')

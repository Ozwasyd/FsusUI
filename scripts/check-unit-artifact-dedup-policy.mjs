import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const scripts = packageJson.scripts ?? {}
const reusableQualityWorkflow = readFileSync(
  '.github/workflows/_quality.yml',
  'utf8',
)
const releaseGovernance = readFileSync('docs/release-governance.md', 'utf8')
const engineeringHandoff = readFileSync('docs/engineering-handoff.md', 'utf8')

function assert(condition, message) {
  if (!condition) {
    console.error(`[unit-artifact-dedup] ${message}`)
    process.exit(1)
  }
}

function workflowJob(name) {
  const match = reusableQualityWorkflow.match(
    new RegExp(
      `\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [a-zA-Z][\\w-]*:\\n|$)`,
      'u',
    ),
  )
  return match?.[1] ?? ''
}

const unitArtifactsJob = workflowJob('unit-artifacts')
const unitJob = workflowJob('unit')
const docs = `${releaseGovernance}\n${engineeringHandoff}`

assert(
  scripts['check:unit-artifact-dedup']?.includes(
    'scripts/check-unit-artifact-dedup-policy.mjs',
  ),
  'package.json must expose check:unit-artifact-dedup',
)
assert(
  scripts['check:test-artifacts-ready']?.includes(
    'scripts/check-test-artifacts-ready.mjs',
  ),
  'package.json must expose check:test-artifacts-ready',
)
assert(
  scripts['governance:check']?.includes('check:unit-artifact-dedup'),
  'governance:check must include the unit artifact dedup policy guard',
)
assert(unitArtifactsJob, '_quality.yml must define a unit-artifacts job')
assert(unitJob, '_quality.yml must define a unit job')
for (const fragment of [
  'pnpm run prepare:test-artifacts',
  'actions/upload-artifact@v4',
  'name: unit-test-artifacts',
  'vue/packages/icons-vue/dist',
  'vue/packages/wasm/dist',
  'icons-cache-hit',
  'wasm-cache-hit',
]) {
  assert(
    unitArtifactsJob.includes(fragment),
    `unit-artifacts job must include ${fragment}`,
  )
}
assert(
  unitJob.includes('- capacity') && unitJob.includes('- unit-artifacts'),
  'unit shards must depend on capacity and unit-artifacts jobs',
)
assert(
  unitJob.includes('actions/download-artifact@v4') &&
    unitJob.includes('name: unit-test-artifacts'),
  'unit shards must download the prepared unit-test-artifacts artifact',
)
assert(
  unitJob.includes('pnpm run check:test-artifacts-ready'),
  'unit shards must validate downloaded artifacts without generating them',
)
for (const forbidden of [
  'pnpm run prepare:test-artifacts',
  'pnpm run ensure:icons',
  'pnpm run ensure:wasm',
  'emscripten-core/setup-emsdk',
  'actions/cache@v4',
]) {
  assert(
    !unitJob.includes(forbidden),
    `unit shards must not run artifact setup step: ${forbidden}`,
  )
}
for (const fragment of [
  'unit-test-artifacts',
  'check:test-artifacts-ready',
  'vitest run --shard',
  'unit-artifacts',
]) {
  assert(
    docs.includes(fragment),
    `docs must describe unit shard artifact flow: ${fragment}`,
  )
}

console.log('[unit-artifact-dedup] ok')

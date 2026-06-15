import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const scripts = packageJson.scripts ?? {}
const qualityWorkflow = readFileSync('.github/workflows/quality.yml', 'utf8')
const reusableQualityWorkflow = readFileSync(
  '.github/workflows/_quality.yml',
  'utf8',
)
const releaseGovernance = readFileSync('docs/release-governance.md', 'utf8')
const engineeringHandoff = readFileSync('docs/engineering-handoff.md', 'utf8')

function assert(condition, message) {
  if (!condition) {
    console.error(`[typecheck-cache] ${message}`)
    process.exit(1)
  }
}

const workflows = `${qualityWorkflow}\n${reusableQualityWorkflow}`
const docs = `${releaseGovernance}\n${engineeringHandoff}`.toLowerCase()
const typecheckLanes = ['web', 'node', 'vite-config', 'vitest']

assert(
  scripts['check:typecheck-cache']?.includes(
    'scripts/check-typecheck-cache-policy.mjs',
  ),
  'package.json must expose check:typecheck-cache',
)
assert(
  scripts['governance:check']?.includes('check:typecheck-cache'),
  'governance:check must include the typecheck cache policy guard',
)
assert(
  scripts.typecheck?.includes('typecheck:web')
    && scripts.typecheck?.includes('typecheck:node')
    && scripts.typecheck?.includes('typecheck:vite-config')
    && scripts.typecheck?.includes('typecheck:vitest'),
  'typecheck must keep the full four-lane graph',
)
assert(
  scripts['typecheck:affected']?.includes('scripts/run-affected-gate.mjs typecheck'),
  'typecheck:affected must keep affected PR-fast selection',
)
assert(
  scripts['typecheck:no-cache']?.includes('typecheck:web:no-cache')
    && scripts['typecheck:no-cache']?.includes('typecheck:node:no-cache')
    && scripts['typecheck:no-cache']?.includes('typecheck:vite-config:no-cache')
    && scripts['typecheck:no-cache']?.includes('typecheck:vitest:no-cache'),
  'typecheck:no-cache must keep a full diagnostic/release path',
)

for (const lane of typecheckLanes) {
  assert(
    scripts[`typecheck:${lane}`]?.includes('scripts/run-typecheck.mjs')
      && scripts[`typecheck:${lane}`]?.includes(lane),
    `typecheck:${lane} must use the incremental cache wrapper`,
  )
  assert(
    scripts[`typecheck:${lane}:no-cache`]?.includes('scripts/run-typecheck.mjs')
      && scripts[`typecheck:${lane}:no-cache`]?.includes('--no-cache'),
    `typecheck:${lane}:no-cache must use the cache-bypass wrapper`,
  )
}

assert(
  workflows.includes('.tmp/typecheck-cache'),
  'quality workflows must cache .tmp/typecheck-cache',
)
assert(
  workflows.includes('fsusui-typecheck-'),
  'typecheck cache key must use the fsusui-typecheck prefix',
)
for (const fragment of [
  'pnpm-lock.yaml',
  'package.json',
  'tsconfig*.json',
  'packages/**/*.ts',
  'packages/**/*.vue',
  'typings/**/*.d.ts',
  'scripts/run-typecheck.mjs',
]) {
  assert(workflows.includes(fragment), `typecheck cache key must include ${fragment}`)
}
for (const fragment of [
  'typecheck-cache-hit',
  'cache-hit',
  'cache-primary-key',
]) {
  assert(
    workflows.includes(fragment),
    `quality workflow logs must expose ${fragment}`,
  )
}
for (const fragment of [
  'typecheck cache',
  'cache hit',
  'cache miss',
  'typecheck:no-cache',
  'typecheck:affected',
]) {
  assert(docs.includes(fragment), `docs must describe ${fragment}`)
}

console.log('[typecheck-cache] ok')

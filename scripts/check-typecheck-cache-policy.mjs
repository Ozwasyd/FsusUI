import {
  assertIncludesAll,
  assertRegisteredGovernanceScript,
  createPolicyAssert,
  loadScriptsMap,
  readRepoText,
} from './lib/ci-policy-utils.mjs'

const assert = createPolicyAssert('typecheck-cache')
const scripts = loadScriptsMap()
const workflows = `${readRepoText('.github/workflows/quality.yml')}\n${readRepoText('.github/workflows/_quality.yml')}`
const capacityTypecheck = readRepoText('scripts/run-capacity-typecheck.mjs')
const capacityPlanner = readRepoText('scripts/ci-capacity.cjs')
const typecheckLanes = ['web', 'node', 'vite-config', 'vitest']

assertRegisteredGovernanceScript(
  assert,
  scripts,
  'check:typecheck-cache',
  'scripts/check-typecheck-cache-policy.mjs',
  'the typecheck cache policy guard',
)
assert(
  scripts.typecheck?.includes('run-capacity-typecheck.mjs') &&
    typecheckLanes.every((lane) => capacityPlanner.includes(`'${lane}'`)),
  'typecheck must keep the full four-lane graph',
)
assert(
  scripts['typecheck:affected']?.includes(
    'scripts/run-affected-gate.mjs typecheck',
  ),
  'typecheck:affected must keep affected PR-fast selection',
)
assert(
  scripts['typecheck:no-cache']?.includes(
    'run-capacity-typecheck.mjs --no-cache',
  ) && capacityTypecheck.includes("noCache ? ':no-cache' : ''"),
  'typecheck:no-cache must keep a full diagnostic/release path',
)

for (const lane of typecheckLanes) {
  assert(
    scripts[`typecheck:${lane}`]?.includes('scripts/run-typecheck.mjs') &&
      scripts[`typecheck:${lane}`]?.includes(lane),
    `typecheck:${lane} must use the incremental cache wrapper`,
  )
  assert(
    scripts[`typecheck:${lane}:no-cache`]?.includes(
      'scripts/run-typecheck.mjs',
    ) && scripts[`typecheck:${lane}:no-cache`]?.includes('--no-cache'),
    `typecheck:${lane}:no-cache must use the cache-bypass wrapper`,
  )
}

assertIncludesAll(
  assert,
  workflows,
  [
    '.tmp/typecheck-cache',
    'fsusui-v2-typecheck-',
    'pnpm-lock.yaml',
    'package.json',
    'vue/tsconfig*.json',
    'vue/packages/**/*.ts',
    'vue/packages/**/*.vue',
    'vue/typings/**/*.d.ts',
    'scripts/run-typecheck.mjs',
  ],
  (fragment) => `quality workflows must include ${fragment}`,
)

console.log('[typecheck-cache] ok')

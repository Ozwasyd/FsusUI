#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { EventEmitter } from 'node:events'
import {
  PREVIEW_PROJECTS,
  createVisualPlan,
  parseVisualArgs,
  runVisualPlan,
  runVisualPlanAsync,
  runVisualRuntimePreparation,
  validateVisualPlan,
} from './run-visual-tests.mjs'
import {
  VISUAL_CAPACITY_PLAN_ENV,
  createVisualCapacityPlan,
  parseVisualCapacityPlan,
} from './visual-capacity.mjs'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const scripts = packageJson.scripts ?? {}
const workflow = readFileSync('.github/workflows/_quality.yml', 'utf8')
const previewConfig = readFileSync('vue/playwright.config.ts', 'utf8')
const devConfig = readFileSync('vue/playwright.dev.config.ts', 'utf8')
const testParallelism = readFileSync('scripts/test-parallelism.ts', 'utf8')
const auditSpec = readFileSync('vue/tests/visual/ui-audit-all.spec.ts', 'utf8')
const capacitySource = readFileSync('scripts/visual-capacity.cjs', 'utf8')
const capacityFacade = readFileSync('scripts/visual-capacity.mjs', 'utf8')
const runtimeServer = readFileSync('scripts/serve-visual-runtime.mjs', 'utf8')
const evidencePolicy = readFileSync(
  'scripts/visual-evidence-policy.cjs',
  'utf8',
)
const capacityFixture = JSON.parse(
  readFileSync('tests/fixtures/visual-capacity/high-resource.json', 'utf8'),
)
const capacityPlan = createVisualCapacityPlan(capacityFixture)

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function workflowJob(name) {
  return (
    workflow.match(
      new RegExp(
        `\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [a-zA-Z][\\w-]*:\\n|$)`,
        'u',
      ),
    )?.[1] ?? ''
  )
}

function occurrences(value, fragment) {
  return value.split(fragment).length - 1
}

function expectInvalid(label, mutate) {
  const plan = createVisualPlan(
    parseVisualArgs(['--suite=full', '--list']),
    capacityPlan,
  )
  mutate(plan)
  let message = ''
  try {
    validateVisualPlan(plan, capacityPlan)
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  assert(message, `negative policy fixture did not reject ${label}`)
}

const visualJob = workflowJob('visual')
assert(
  scripts['check:visual-orchestration']?.includes(
    'scripts/check-visual-orchestration-policy.mjs',
  ),
  'package.json must expose check:visual-orchestration',
)
assert(
  scripts['governance:check']?.includes('check:visual-orchestration'),
  'governance:check must include the visual orchestration policy guard',
)
assert(
  scripts['visual:capacity']?.includes('visual-capacity.mjs --dry-run'),
  'package.json must expose the browser-free visual capacity dry-run',
)
for (const [name, fragment] of [
  ['visual:prepare', 'scripts/prepare-visual-runtime.mjs'],
  ['visual:prepare:dry-run', 'scripts/prepare-visual-runtime.mjs --dry-run'],
  ['visual:runtime:check', 'scripts/prepare-visual-runtime.mjs --check'],
  ['visual:serve:preview', 'serve-visual-runtime.mjs --suite=preview'],
  ['visual:serve:dev', 'serve-visual-runtime.mjs --suite=dev'],
  ['test:visual:evidence', 'run-visual-tests.mjs --suite=full --evidence'],
]) {
  assert(scripts[name]?.includes(fragment), `${name} must use ${fragment}`)
}
assert(visualJob, '_quality.yml must define one visual job')
assert(
  !/\n\s+matrix:\s*[\s\S]*?project:/u.test(visualJob),
  'visual job must not define a project matrix',
)
assert(
  !workflow.includes('pnpm test:visual --project='),
  'workflow must not pass --project through test:visual',
)
assert(
  occurrences(visualJob, 'pnpm test:visual:full') === 1,
  'visual job must contain exactly one full orchestration entry',
)
assert(
  occurrences(visualJob, 'pnpm visual:capacity') === 1 &&
    visualJob.includes('FSUS_VISUAL_SUITE_MODE: auto'),
  'visual job must probe one auto-mode capacity plan before orchestration',
)
assert(
  occurrences(visualJob, 'test:visual:dev') === 0,
  'visual job must not schedule the dev suite separately',
)

for (const [name, fragment] of [
  ['test:visual', 'scripts/run-visual-tests.mjs --suite=full'],
  ['test:visual:full', 'scripts/run-visual-tests.mjs --suite=full'],
  [
    'test:visual:project',
    'scripts/run-visual-tests.mjs --suite=preview --project',
  ],
  ['test:visual:plan', 'scripts/run-visual-tests.mjs --suite=full --list'],
]) {
  assert(scripts[name]?.includes(fragment), `${name} must use ${fragment}`)
}
for (const name of ['test:visual', 'test:visual:full', 'test:visual:project']) {
  assert(
    !/\brun-[ps]\b/u.test(scripts[name] ?? ''),
    `${name} must not depend on npm-run-all argument forwarding`,
  )
}
assert(
  scripts['test:visual:preview']?.includes(
    'playwright test --config=vue/playwright.config.ts',
  ),
  'preview diagnostic command must call Playwright directly',
)
assert(
  scripts['test:visual:dev']?.includes(
    'playwright test --config=vue/playwright.dev.config.ts',
  ),
  'dev diagnostic command must call Playwright directly',
)

const fullPlan = createVisualPlan(
  parseVisualArgs(['--suite=full', '--list']),
  capacityPlan,
)
validateVisualPlan(fullPlan, capacityPlan)
assert(fullPlan.length === 2, 'full plan must contain preview and dev once')
const preview = fullPlan.find((entry) => entry.suite === 'preview')
const dev = fullPlan.find((entry) => entry.suite === 'dev')
assert(preview && dev, 'full plan must expose preview and dev suites')
assert(
  JSON.stringify(preview.selectedProjects) === JSON.stringify(PREVIEW_PROJECTS),
  'full preview plan must select the canonical four projects once',
)
assert(
  dev.selectedProjects.length === 0,
  'dev suite must have no project matrix',
)

for (const project of PREVIEW_PROJECTS) {
  assert(
    occurrences(previewConfig, `name: '${project}'`) === 1,
    `preview config must define ${project} exactly once`,
  )
}
assert(
  previewConfig.includes("outputDir: 'test-results/visual-preview'") &&
    previewConfig.includes("createPlaywrightReporter('visual-preview')"),
  'preview results and report must use the visual-preview suite namespace',
)
assert(
  devConfig.includes("outputDir: 'test-results/demo-app-dev'") &&
    devConfig.includes("createPlaywrightReporter('demo-app-dev')"),
  'dev results and report must use the demo-app-dev suite namespace',
)
for (const [label, config, suite] of [
  ['preview', previewConfig, 'preview'],
  ['dev', devConfig, 'dev'],
]) {
  assert(
    config.includes(`serve-visual-runtime.mjs --suite=${suite}`),
    `${label} webServer must only serve a prepared visual runtime`,
  )
  for (const forbidden of [
    'prepare:test-artifacts',
    'ensure:wasm',
    'demo-app build',
  ]) {
    assert(
      !config.includes(forbidden),
      `${label} webServer must not execute ${forbidden}`,
    )
  }
  for (const fragment of [
    "globalTeardown: '../scripts/visual-evidence-policy.cjs'",
    'preserveOutput: evidencePolicy.preserveOutput',
    'screenshot: evidencePolicy.screenshot',
    'trace: evidencePolicy.trace',
  ]) {
    assert(
      config.includes(fragment),
      `${label} config must include ${fragment}`,
    )
  }
}
assert(
  previewConfig.includes("from '../scripts/visual-evidence-policy.cjs'") &&
    devConfig.includes("from '../scripts/visual-evidence-policy.cjs'"),
  'Playwright configs must consume the CJS-safe evidence policy boundary',
)
assert(
  runtimeServer.includes('pnpm visual:prepare') &&
    runtimeServer.includes('inspectVisualRuntime(config)') &&
    !runtimeServer.includes('ensure:wasm'),
  'direct Playwright server must fail with a local prepare command and never rebuild',
)
assert(
  evidencePolicy.includes(
    "preserveOutput: evidence ? 'always' : 'failures-only'",
  ) &&
    evidencePolicy.includes(
      "screenshot: evidence ? 'on' : 'only-on-failure'",
    ) &&
    evidencePolicy.includes("trace: evidence ? 'on' : 'retain-on-failure'"),
  'visual evidence policy must keep normal success artifacts out of reports',
)
assert(
  visualJob.includes("FSUS_VISUAL_EVIDENCE: ${{ inputs.group == 'release'") &&
    visualJob.includes("always() && inputs.group == 'release'") &&
    visualJob.includes('screenshots'),
  'release mode must explicitly retain the complete visual evidence matrix',
)
assert(
  visualJob.includes('PLAYWRIGHT_BROWSERS_PATH:') &&
    visualJob.includes('Restore Playwright Chromium cache') &&
    visualJob.includes(
      "runner.os }}-playwright-chromium-${{ hashFiles('package.json', 'pnpm-lock.yaml')",
    ) &&
    (visualJob.match(/playwright install --with-deps chromium/gu)?.length ??
      0) === 1,
  'visual job must cache one fixed Chromium installation per OS and Playwright lock state',
)
assert(
  previewConfig.includes('resolveVisualPreviewWorkers()') &&
    !previewConfig.includes('resolvePlaywrightWorkers()'),
  'preview config must consume previewWorkers from the shared visual capacity plan',
)
assert(
  devConfig.includes('resolveVisualDevWorkers()') &&
    !/workers:\s*1[,\n]/u.test(devConfig),
  'dev config must consume devWorkers from the shared visual capacity plan',
)
assert(
  testParallelism.includes("from './visual-capacity.cjs'") &&
    testParallelism.includes('resolveVisualAuditBucketCount') &&
    testParallelism.includes('resolveVisualCapacityPlan().previewWorkers') &&
    testParallelism.includes('resolveVisualCapacityPlan().devWorkers'),
  'visual worker and audit readers must share the visual capacity module',
)
assert(
  capacityFacade.includes("from './visual-capacity.cjs'") &&
    capacitySource.includes('module.exports ='),
  'visual capacity must keep a CJS-safe core behind its ESM CLI facade',
)
assert(
  auditSpec.includes('resolveVisualAuditBucketCount()') &&
    auditSpec.includes('visual-audit-bucket-count'),
  'UI audit must expose the plan-backed bucket count entry for #230',
)
assert(
  !/(?:previewWorkers|devWorkers|auditBucketCount)\s*[:=][^\n]*cpus\(\)\.length/u.test(
    capacitySource,
  ),
  'visual capacity policy must not derive execution counts from cpus().length',
)

expectInvalid('duplicate preview project', (plan) => {
  const entry = plan.find((candidate) => candidate.suite === 'preview')
  entry.selectedProjects.push(entry.selectedProjects[0])
})
expectInvalid('duplicate dev suite', (plan) => {
  plan.push({ ...plan.find((entry) => entry.suite === 'dev') })
})
expectInvalid('shared result namespace', (plan) => {
  plan[1].projectResultNamespaces = [plan[0].projectResultNamespaces[0]]
})
expectInvalid('preview worker drift', (plan) => {
  plan[0].workers += 1
})

const collectedSuites = []
let preparationCount = 0
assert(
  runVisualRuntimePreparation((command, args) => {
    preparationCount += 1
    assert(
      command === 'pnpm' && args.join(' ') === 'run visual:prepare',
      'visual runner must invoke the dedicated runtime preparation command',
    )
    return { status: 0 }
  }) === 0 && preparationCount === 1,
  'visual runner must prepare the shared runtime exactly once',
)
const collectedExitCode = runVisualPlan(
  fullPlan,
  (_command, args, options) => {
    const suite = args.some((arg) => arg.includes('playwright.config.ts'))
      ? 'preview'
      : 'dev'
    collectedSuites.push(suite)
    assert(
      parseVisualCapacityPlan(options.env[VISUAL_CAPACITY_PLAN_ENV])
        .effectiveCpu === capacityPlan.effectiveCpu,
      'runner must pass the same serialized visual capacity plan to every suite',
    )
    return { status: suite === 'preview' ? 1 : 0 }
  },
  capacityPlan,
)
assert(
  collectedSuites.join(',') === 'preview,dev' && collectedExitCode === 1,
  'full runner must execute dev after a preview failure and preserve failure status',
)

function createAsyncSpawn(statuses) {
  const state = { active: 0, launches: [], maxActive: 0 }
  const spawn = (_command, args, options) => {
    const child = new EventEmitter()
    const suite = args.some((arg) => arg.includes('playwright.config.ts'))
      ? 'preview'
      : 'dev'
    state.active += 1
    state.maxActive = Math.max(state.maxActive, state.active)
    state.launches.push(suite)
    assert(
      options.env[VISUAL_CAPACITY_PLAN_ENV],
      'async visual runner must pass the shared plan environment',
    )
    globalThis.queueMicrotask(() => {
      state.active -= 1
      child.emit('close', statuses[suite] ?? 0)
    })
    return child
  }
  return { spawn, state }
}

const parallelSpawn = createAsyncSpawn({ preview: 0, dev: 0 })
assert(
  (await runVisualPlanAsync(fullPlan, {
    capacityPlan,
    spawn: parallelSpawn.spawn,
  })) === 0 && parallelSpawn.state.maxActive === 2,
  'parallel capacity plan must run preview and dev concurrently',
)

const serialSpawn = createAsyncSpawn({ preview: 1, dev: 0 })
const serialCapacityPlan = { ...capacityPlan, suiteMode: 'serial' }
assert(
  (await runVisualPlanAsync(fullPlan, {
    capacityPlan: serialCapacityPlan,
    spawn: serialSpawn.spawn,
  })) === 1 &&
    serialSpawn.state.maxActive === 1 &&
    serialSpawn.state.launches.join(',') === 'preview,dev',
  'serial capacity plan must preserve order, continue after failure, and return failure',
)

console.log('[visual-orchestration] ok')

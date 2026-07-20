#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import {
  PREVIEW_PROJECTS,
  createVisualPlan,
  parseVisualArgs,
  runVisualPlan,
  validateVisualPlan,
} from './run-visual-tests.mjs'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const scripts = packageJson.scripts ?? {}
const workflow = readFileSync('.github/workflows/_quality.yml', 'utf8')
const previewConfig = readFileSync('vue/playwright.config.ts', 'utf8')
const devConfig = readFileSync('vue/playwright.dev.config.ts', 'utf8')

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
  const plan = createVisualPlan(parseVisualArgs(['--suite=full', '--list']))
  mutate(plan)
  let message = ''
  try {
    validateVisualPlan(plan)
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

const fullPlan = createVisualPlan(parseVisualArgs(['--suite=full', '--list']))
validateVisualPlan(fullPlan)
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

const collectedSuites = []
const collectedExitCode = runVisualPlan(fullPlan, (_command, args) => {
  const suite = args.some((arg) => arg.includes('playwright.config.ts'))
    ? 'preview'
    : 'dev'
  collectedSuites.push(suite)
  return { status: suite === 'preview' ? 1 : 0 }
})
assert(
  collectedSuites.join(',') === 'preview,dev' && collectedExitCode === 1,
  'full runner must execute dev after a preview failure and preserve failure status',
)

console.log('[visual-orchestration] ok')

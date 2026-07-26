import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const scripts = packageJson.scripts ?? {}
const reusableQualityWorkflow = readFileSync(
  '.github/workflows/_quality.yml',
  'utf8',
)
const releaseGovernance = readFileSync('docs/releases/governance.md', 'utf8')
const engineeringHandoff = readFileSync('docs/engineering-handoff.md', 'utf8')

function assert(condition, message) {
  if (!condition) {
    console.error(`[short-quality] ${message}`)
    process.exit(1)
  }
}

const docs = `${releaseGovernance}\n${engineeringHandoff}`.toLowerCase()

assert(
  scripts['check:short-quality-consolidation']?.includes(
    'scripts/check-short-quality-consolidation.mjs',
  ),
  'package.json must expose check:short-quality-consolidation',
)
assert(
  scripts['governance:check']?.includes('check:short-quality-consolidation'),
  'governance:check must include the short quality consolidation guard',
)

assert(
  reusableQualityWorkflow.includes('static-quality:'),
  'reusable quality workflow must define one static-quality job',
)

for (const job of [
  'contract',
  'lint',
  'tokens',
  'icons',
  'conformance',
  'governance',
]) {
  assert(
    !new RegExp(String.raw`\n  ${job}:\n`).test(reusableQualityWorkflow),
    `short ${job} job must be folded into static-quality`,
  )
}

for (const fragment of [
  'Run contract checks',
  'pnpm run check:consumer-contract',
  'pnpm run check:npm-dist-tag',
  'Run lint',
  'pnpm lint',
  'Run token checks',
  'pnpm run tokens:check',
  'pnpm run tokens:lint',
  'Run icon checks',
  'pnpm run icons:check',
  'pnpm run icons:lint',
  'Run conformance',
  'pnpm run conformance',
  'Run governance',
  'pnpm run governance:check',
]) {
  assert(
    reusableQualityWorkflow.includes(fragment),
    `static-quality must keep identifiable step/command: ${fragment}`,
  )
}

assert(
  /consumer-install:[\s\S]*needs:[\s\S]*static-quality[\s\S]*build-package/.test(
    reusableQualityWorkflow,
  ),
  'consumer-install must depend on static-quality and build-package',
)

for (const fragment of [
  'static-quality',
  'short quality',
  'shared setup',
  'failure output',
]) {
  assert(docs.includes(fragment), `docs must describe ${fragment}`)
}

console.log('[short-quality] ok')

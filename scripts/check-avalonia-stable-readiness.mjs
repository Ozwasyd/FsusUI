import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8')

const readJson = (relativePath) => JSON.parse(read(relativePath))

const assertIncludes = (content, term, label) => {
  if (!content.includes(term)) throw new Error(`${label} missing ${term}`)
}

const validateReleaseEvidence = (content, spec, label) => {
  for (const term of spec.requiredEvidenceTerms) {
    assertIncludes(content.toLowerCase(), term.toLowerCase(), label)
  }
}

const workflowJob = (content, name) => {
  const match = content.match(
    new RegExp(
      `\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [a-zA-Z][\\w-]*:\\n|$)`,
      'u',
    ),
  )
  return match?.[1] ?? ''
}

const validateTopLevelGroups = (qualityWorkflow, spec, label) => {
  for (const group of Object.keys(spec.groups)) {
    if (group === 'pr-fast') continue
    const job = workflowJob(qualityWorkflow, group)
    if (!job) throw new Error(`${label} missing ${group} group job`)
    assertIncludes(job, 'uses: ./.github/workflows/_quality.yml', label)
    assertIncludes(job, `group: ${group}`, label)
  }
  assertIncludes(qualityWorkflow, "inputs.group == 'main'", label)
  assertIncludes(qualityWorkflow, "inputs.group == 'nightly'", label)
  assertIncludes(qualityWorkflow, "inputs.group == 'release'", label)
}

const validateWorkflow = (qualityWorkflow, reusableWorkflow, spec, label) => {
  validateTopLevelGroups(qualityWorkflow, spec, label)
  for (const os of spec.requiredOperatingSystems) {
    assertIncludes(reusableWorkflow, os, label)
  }
  for (const job of spec.requiredJobs) {
    assertIncludes(reusableWorkflow, `${job}:`, label)
  }
  validateWorkflowArtifacts(reusableWorkflow, spec, label)
  assertIncludes(qualityWorkflow, 'pull_request:', label)
  assertIncludes(qualityWorkflow, 'schedule:', label)
  assertIncludes(qualityWorkflow, 'workflow_dispatch:', label)
  assertIncludes(reusableWorkflow, 'workflow_call:', label)
  assertIncludes(reusableWorkflow, 'group:', label)
  assertIncludes(reusableWorkflow, 'pnpm run verify:stable', label)
  assertIncludes(reusableWorkflow, 'pnpm run verify:nightly', label)
  assertIncludes(reusableWorkflow, 'pnpm run verify:release', label)
  assertIncludes(reusableWorkflow, 'pnpm run dotnet:verify', label)
  assertIncludes(reusableWorkflow, 'actions/cache@v4', label)
}

const validateWorkflowArtifacts = (reusableWorkflow, spec, label) => {
  for (const artifactName of spec.requiredArtifactNames) {
    assertIncludes(reusableWorkflow, artifactName, label)
  }
}

const runFixtureChecks = (spec) => {
  const invalidRelease = read(
    'tests/fixtures/avalonia-stable-readiness/invalid-release-notes.md',
  )
  let releaseMessage = ''
  try {
    validateReleaseEvidence(invalidRelease, spec, 'invalid release notes')
  } catch (error) {
    releaseMessage = error instanceof Error ? error.message : String(error)
  }
  if (!releaseMessage.includes('token version')) {
    throw new Error(
      `invalid release notes fixture did not fail on token version: ${releaseMessage || 'success'}`,
    )
  }

  const invalidWorkflow = read(
    'tests/fixtures/avalonia-stable-readiness/invalid-quality.yml',
  )
  let workflowMessage = ''
  try {
    validateWorkflowArtifacts(invalidWorkflow, spec, 'invalid workflow')
  } catch (error) {
    workflowMessage = error instanceof Error ? error.message : String(error)
  }
  if (!workflowMessage.includes('avalonia-stable-evidence')) {
    throw new Error(
      `invalid workflow fixture did not fail on avalonia-stable-evidence: ${workflowMessage || 'success'}`,
    )
  }
}

try {
  const spec = readJson('spec/ci/avalonia-stable-readiness.json')
  runFixtureChecks(spec)

  const packageJson = readJson('package.json')
  const scripts = packageJson.scripts ?? {}
  for (const script of [
    'verify:pr-fast',
    'verify:full',
    'verify:nightly',
    'verify:stable',
    'verify:release',
    'check:avalonia-stable-readiness',
  ]) {
    if (!scripts[script]) throw new Error(`package.json missing ${script}`)
  }
  if (!scripts['verify:release'].includes('verify:stable')) {
    throw new Error('verify:release must include verify:stable')
  }

  validateWorkflow(
    read('.github/workflows/quality.yml'),
    read('.github/workflows/_quality.yml'),
    spec,
    'quality workflow',
  )
  validateReleaseEvidence(
    read('docs/releases/avalonia-stable-readiness.md'),
    spec,
    'avalonia stable release evidence',
  )
  console.log('Avalonia stable readiness check passed.')
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}

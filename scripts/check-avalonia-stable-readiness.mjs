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

const validateStableEvidenceSections = (content, spec, label) => {
  const normalized = content.toLowerCase()
  for (const section of spec.requiredStableEvidenceSections) {
    assertIncludes(normalized, section.toLowerCase(), label)
  }
}

const validateStableChecklistCoverage = (content, spec, label) => {
  const normalized = content.toLowerCase()
  for (const issueNumber of spec.requiredStableIssueNumbers) {
    const issueToken = `#${issueNumber}`
    assertIncludes(content, issueToken, label)
    const issueLine = content
      .split('\n')
      .find((line) => line.includes(issueToken))
      ?.toLowerCase()
    if (!issueLine || !/(closed|not required)/u.test(issueLine)) {
      throw new Error(`${label} must mark ${issueToken} closed or not required`)
    }
  }

  for (const family of spec.requiredStableComponentFamilies) {
    assertIncludes(normalized, `\`${family}\``, label)
    const familyLine = content
      .split('\n')
      .find((line) => line.includes(`\`${family}\``))
      ?.toLowerCase()
    if (
      !familyLine ||
      !familyLine.includes('docs/releases/evidence/avalonia-stable/')
    ) {
      throw new Error(`${label} missing evidence link for ${family}`)
    }
  }
}

const validateStableEvidenceBundle = (spec) => {
  const evidenceRoot = 'docs/releases/evidence/avalonia-stable'
  for (const file of spec.requiredStableEvidenceFiles) {
    const relativePath = `${evidenceRoot}/${file}`
    if (!fs.existsSync(path.join(root, relativePath))) {
      throw new Error(`${relativePath} missing`)
    }
  }

  const bundle = spec.requiredStableEvidenceFiles
    .map((file) => read(`${evidenceRoot}/${file}`))
    .join('\n')
  validateStableEvidenceSections(bundle, spec, 'avalonia stable RC evidence')
  validateStableChecklistCoverage(
    read(`${evidenceRoot}/stable-readiness-checklist.md`),
    spec,
    'avalonia stable checklist',
  )
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
  assertIncludes(reusableWorkflow, '--profile nightly', label)
  assertIncludes(reusableWorkflow, '--profile release', label)
  assertIncludes(reusableWorkflow, 'dotnet-platform:', label)
  assertIncludes(reusableWorkflow, 'dotnet-package:', label)
  assertIncludes(reusableWorkflow, 'node scripts/ci-readiness.mjs check', label)
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

  const invalidStableEvidence = read(
    'tests/fixtures/avalonia-stable-readiness/invalid-stable-evidence.md',
  )
  let stableEvidenceMessage = ''
  try {
    validateStableEvidenceSections(
      invalidStableEvidence,
      spec,
      'invalid stable evidence',
    )
  } catch (error) {
    stableEvidenceMessage =
      error instanceof Error ? error.message : String(error)
  }
  if (!stableEvidenceMessage.includes('consumer install results')) {
    throw new Error(
      `invalid stable evidence fixture did not fail on consumer install results: ${stableEvidenceMessage || 'success'}`,
    )
  }

  const invalidChecklist = read(
    'tests/fixtures/avalonia-stable-readiness/invalid-checklist.md',
  )
  let checklistMessage = ''
  try {
    validateStableChecklistCoverage(
      invalidChecklist,
      spec,
      'invalid stable checklist',
    )
  } catch (error) {
    checklistMessage = error instanceof Error ? error.message : String(error)
  }
  if (!checklistMessage.includes('#130')) {
    throw new Error(
      `invalid checklist fixture did not fail on #130: ${checklistMessage || 'success'}`,
    )
  }
}

try {
  const spec = readJson('spec/ci/avalonia-stable-readiness.json')
  const alignment = readJson('.tmp/conformance-v2/alignment.json')
  if (alignment.schema !== 'fsusui.alignment.v2') {
    throw new Error('Contract V2 alignment artifact schema invalid')
  }
  const derivedFamilies = alignment.consumers?.galleryStableFamilies ?? []
  const missingStableFamilies = spec.requiredStableComponentFamilies.filter(
    (family) => !derivedFamilies.includes(family),
  )
  if (missingStableFamilies.length) {
    throw new Error(
      `Avalonia stable readiness blocked by derived alignment gaps: ${missingStableFamilies.join(', ')}`,
    )
  }
  if (alignment.consumers?.releaseReady !== true) {
    throw new Error('Avalonia release readiness is false in derived alignment')
  }
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
    read('docs/releases/readiness/avalonia-stable.md'),
    spec,
    'avalonia stable release evidence',
  )
  validateStableEvidenceBundle(spec)
  console.log('Avalonia stable readiness check passed.')
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}

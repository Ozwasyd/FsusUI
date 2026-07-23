/* global __dirname, module, require */

const { mkdir, rm, writeFile } = require('node:fs/promises')
const { resolve } = require('node:path')

const repositoryRoot = resolve(__dirname, '..')

const isVisualEvidenceMode = (env = process.env) =>
  /^(1|true|yes|on)$/iu.test(env.FSUS_VISUAL_EVIDENCE ?? '')

const visualEvidencePolicy = (env = process.env) => {
  const evidence = isVisualEvidenceMode(env)
  return {
    evidence,
    preserveOutput: evidence ? 'always' : 'failures-only',
    screenshot: evidence ? 'on' : 'only-on-failure',
    trace: 'retain-on-failure',
  }
}

async function cleanupSuccessfulVisualEvidence(
  env = process.env,
  root = repositoryRoot,
  orchestratedFinal = false,
) {
  if (isVisualEvidenceMode(env)) return
  if (env.FSUS_VISUAL_ORCHESTRATED === '1' && !orchestratedFinal) return
  await rm(resolve(root, 'screenshots'), {
    force: true,
    recursive: true,
  })
}

async function writeVisualEvidenceManifest(
  plan,
  capacityPlan,
  testExitCode,
  env = process.env,
  root = repositoryRoot,
) {
  if (!isVisualEvidenceMode(env)) return undefined
  const manifest = {
    schemaVersion: 1,
    profile: env.FSUS_VISUAL_PROFILE || 'evidence',
    shard: env.FSUS_VISUAL_SHARD || 'local',
    testExitCode,
    runtimeManifest: '.tmp/visual-runtime/manifest.json',
    capacityPlan,
    suites: plan.map((entry) => ({
      suite: entry.suite,
      projects:
        entry.selectedProjects.length > 0
          ? entry.selectedProjects
          : ['default'],
      reportDirectory: entry.reportDirectory,
      resultNamespaces: entry.projectResultNamespaces,
    })),
  }
  const directory = resolve(root, '.tmp/visual-evidence')
  const path = resolve(directory, 'manifest.json')
  await mkdir(directory, { recursive: true })
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  return path
}

async function visualEvidenceGlobalTeardown() {
  await cleanupSuccessfulVisualEvidence(process.env)
}

module.exports = visualEvidenceGlobalTeardown
module.exports.cleanupSuccessfulVisualEvidence = cleanupSuccessfulVisualEvidence
module.exports.isVisualEvidenceMode = isVisualEvidenceMode
module.exports.visualEvidencePolicy = visualEvidencePolicy
module.exports.writeVisualEvidenceManifest = writeVisualEvidenceManifest

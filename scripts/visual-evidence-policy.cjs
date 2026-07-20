/* global __dirname, module, require */

const { rm } = require('node:fs/promises')
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
    trace: evidence ? 'on' : 'retain-on-failure',
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

async function visualEvidenceGlobalTeardown() {
  await cleanupSuccessfulVisualEvidence(process.env)
}

module.exports = visualEvidenceGlobalTeardown
module.exports.cleanupSuccessfulVisualEvidence = cleanupSuccessfulVisualEvidence
module.exports.isVisualEvidenceMode = isVisualEvidenceMode
module.exports.visualEvidencePolicy = visualEvidencePolicy

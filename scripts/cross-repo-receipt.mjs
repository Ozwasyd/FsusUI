#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { canonicalJson } from './fsusui-release-dispatch-lib.mjs'

export const REQUIRED_GATES = [
  'published-package-typecheck',
  'fsusui-export-boundary',
  'frontend-production-build',
  'worker-wasm-package-path',
  'single-vue-runtime',
]
const HEX_40 = /^[a-f0-9]{40}$/u
const HEX_64 = /^[a-f0-9]{64}$/u
const SAFE_CODE = /^[a-z0-9-]+$/u
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u
const FORBIDDEN = /authorization|bearer\s|private[ _-]?key|token|\.npmrc/iu

const exact = (value, keys, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object.`)
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  if (
    actual.length !== expected.length ||
    actual.some((v, i) => v !== expected[i])
  )
    throw new Error(`${label} has missing or unknown fields.`)
}
const nonempty = (value, label) => {
  if (typeof value !== 'string' || !value)
    throw new Error(`${label} is required.`)
}

export function validateCrossGateReceipt(receipt) {
  exact(
    receipt,
    [
      'schemaVersion',
      'status',
      'fsusui',
      'candidate',
      'fsusblog',
      'toolchain',
      'gates',
      'workingTree',
      'startedAt',
      'completedAt',
      'workflow',
      'diagnostics',
    ],
    '#318 receipt',
  )
  if (
    receipt.schemaVersion !== 1 ||
    !['success', 'failed'].includes(receipt.status)
  )
    throw new Error('#318 receipt schema/status is invalid.')
  exact(
    receipt.fsusui,
    ['repository', 'sourceCommit', 'releaseTag'],
    'FsusUI identity',
  )
  if (
    receipt.fsusui.repository !== 'Ozwasyd/FsusUI' ||
    !HEX_40.test(receipt.fsusui.sourceCommit) ||
    !/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(receipt.fsusui.releaseTag)
  )
    throw new Error('#318 receipt FsusUI identity is invalid.')
  exact(
    receipt.candidate,
    ['package', 'version', 'sha256', 'manifestSha256', 'bindingSha256'],
    'Candidate identity',
  )
  if (
    receipt.candidate.package !== '@ozwasyd/element-plus' ||
    receipt.candidate.version !== receipt.fsusui.releaseTag.slice(1) ||
    ![
      receipt.candidate.sha256,
      receipt.candidate.manifestSha256,
      receipt.candidate.bindingSha256,
    ].every((v) => HEX_64.test(v))
  )
    throw new Error('#318 receipt candidate identity is invalid.')
  exact(
    receipt.fsusblog,
    ['repository', 'defaultBranch', 'commitSha'],
    'FsusBlog identity',
  )
  if (
    receipt.fsusblog.repository !== 'Ozwasyd/FsusBlog' ||
    !receipt.fsusblog.defaultBranch ||
    !HEX_40.test(receipt.fsusblog.commitSha)
  )
    throw new Error('#318 receipt FsusBlog identity is invalid.')
  exact(
    receipt.toolchain,
    ['node', 'npm', 'vue', 'vite', 'typescript', 'vueTsc'],
    'Toolchain',
  )
  for (const [name, version] of Object.entries(receipt.toolchain))
    nonempty(version, `Toolchain ${name}`)
  if (
    !Array.isArray(receipt.gates) ||
    receipt.gates.length !== REQUIRED_GATES.length
  )
    throw new Error('#318 receipt gate coverage is incomplete.')
  for (const name of REQUIRED_GATES) {
    const gate = receipt.gates.find((entry) => entry.name === name)
    if (
      !gate ||
      Object.keys(gate).length !== 3 ||
      !['success', 'failed', 'skipped'].includes(gate.status) ||
      !Number.isInteger(gate.durationMs) ||
      gate.durationMs < 0
    )
      throw new Error(`#318 receipt gate ${name} is invalid.`)
  }
  if (
    new Set(receipt.gates.map((gate) => gate.name)).size !==
    REQUIRED_GATES.length
  )
    throw new Error('#318 receipt gate coverage contains duplicates.')
  exact(receipt.workingTree, ['before', 'after'], 'Working tree')
  if (
    !ISO.test(receipt.startedAt) ||
    !ISO.test(receipt.completedAt) ||
    receipt.completedAt < receipt.startedAt
  )
    throw new Error('#318 receipt timestamps are invalid.')
  exact(receipt.workflow, ['runId', 'runUrl'], 'Workflow identity')
  if (
    !/^[1-9]\d*$/u.test(receipt.workflow.runId) ||
    !/^https:\/\//u.test(receipt.workflow.runUrl)
  )
    throw new Error('#318 receipt workflow identity is invalid.')
  if (
    !Array.isArray(receipt.diagnostics) ||
    receipt.diagnostics.some(
      (code) => typeof code !== 'string' || !SAFE_CODE.test(code),
    )
  )
    throw new Error('#318 receipt diagnostics are not sanitized codes.')
  if (FORBIDDEN.test(JSON.stringify(receipt)))
    throw new Error('#318 receipt contains sensitive data.')
  const successful =
    receipt.gates.every((gate) => gate.status === 'success') &&
    receipt.workingTree.before === 'clean' &&
    receipt.workingTree.after === 'clean' &&
    receipt.diagnostics.length === 0
  if ((receipt.status === 'success') !== successful)
    throw new Error(
      '#318 receipt success does not match executed gate evidence.',
    )
  return receipt
}

export function createCrossGateReceipt({
  bindingRecord,
  runRecord,
  fsusblog,
  workflow,
}) {
  if (
    bindingRecord.binding?.status !== 'success' ||
    !HEX_64.test(bindingRecord.bindingSha256 ?? '')
  )
    throw new Error('Candidate binding record is invalid.')
  const sameCandidate =
    runRecord.candidateSha256Before ===
      bindingRecord.binding.candidate.sha256 &&
    runRecord.candidateSha256After === bindingRecord.binding.candidate.sha256
  const gates = REQUIRED_GATES.map((name) => {
    const gate = runRecord.gates?.find((entry) => entry.name === name)
    return gate
      ? { name, status: gate.status, durationMs: gate.durationMs }
      : { name, status: 'skipped', durationMs: 0 }
  })
  const diagnostics = []
  if (!sameCandidate) diagnostics.push('candidate-mutated')
  if (runRecord.commitSha !== fsusblog.commitSha)
    diagnostics.push('commit-mismatch')
  if (runRecord.workingTreeBefore !== 'clean') diagnostics.push('dirty-before')
  if (runRecord.workingTreeAfter !== 'clean') diagnostics.push('dirty-after')
  if (runRecord.commandStatus !== 'success')
    diagnostics.push('consumer-command-failed')
  if (runRecord.evidenceStatus === 'missing')
    diagnostics.push('consumer-evidence-missing')
  if (runRecord.evidenceStatus === 'invalid')
    diagnostics.push('consumer-evidence-invalid')
  if (gates.some((gate) => gate.status === 'failed'))
    diagnostics.push('consumer-gate-failed')
  if (gates.some((gate) => gate.status === 'skipped'))
    diagnostics.push('consumer-gate-skipped')
  const receipt = {
    schemaVersion: 1,
    status: diagnostics.length === 0 ? 'success' : 'failed',
    fsusui: {
      repository: bindingRecord.binding.sourceRepository,
      sourceCommit: bindingRecord.binding.sourceCommit,
      releaseTag: bindingRecord.binding.releaseTag,
    },
    candidate: {
      package: bindingRecord.binding.candidate.name,
      version: bindingRecord.binding.candidate.version,
      sha256: bindingRecord.binding.candidate.sha256,
      manifestSha256: bindingRecord.binding.candidate.manifestSha256,
      bindingSha256: bindingRecord.bindingSha256,
    },
    fsusblog,
    toolchain: runRecord.toolchain,
    gates,
    workingTree: {
      before: runRecord.workingTreeBefore,
      after: runRecord.workingTreeAfter,
    },
    startedAt: runRecord.startedAt,
    completedAt: runRecord.completedAt,
    workflow,
    diagnostics,
  }
  validateCrossGateReceipt(receipt)
  return {
    receipt,
    receiptSha256: createHash('sha256')
      .update(canonicalJson(receipt))
      .digest('hex'),
  }
}

const args = process.argv.slice(2)
const option = (name) => {
  const index = args.indexOf(name)
  if (index < 0 || !args[index + 1]) throw new Error(`${name} is required.`)
  return args[index + 1]
}
const read = (name) =>
  JSON.parse(readFileSync(path.resolve(option(name)), 'utf8'))

export function main() {
  const output = path.resolve(option('--output'))
  const result = createCrossGateReceipt({
    bindingRecord: read('--binding'),
    runRecord: read('--run-record'),
    fsusblog: {
      repository: 'Ozwasyd/FsusBlog',
      defaultBranch: option('--default-branch'),
      commitSha: option('--commit-sha'),
    },
    workflow: { runId: option('--run-id'), runUrl: option('--run-url') },
  })
  mkdirSync(path.dirname(output), { recursive: true })
  writeFileSync(output, canonicalJson(result.receipt), { mode: 0o600 })
  const checksum = output.endsWith('.json')
    ? `${output.slice(0, -'.json'.length)}.sha256`
    : `${output}.sha256`
  writeFileSync(
    checksum,
    `${result.receiptSha256}  ${path.basename(output)}\n`,
    { mode: 0o600 },
  )
  const githubOutput = process.env.GITHUB_OUTPUT
  if (githubOutput)
    writeFileSync(
      githubOutput,
      `status=${result.receipt.status}\ndigest=${result.receiptSha256}\n`,
      { flag: 'a' },
    )
  process.stdout.write(`${result.receiptSha256}\n`)
  if (result.receipt.status !== 'success') process.exitCode = 1
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main()
  } catch (error) {
    console.error(
      `[cross-repo-receipt] ${error instanceof Error ? error.message : String(error)}`,
    )
    process.exitCode = 1
  }
}

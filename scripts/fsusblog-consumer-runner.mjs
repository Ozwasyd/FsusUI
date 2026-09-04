#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { REQUIRED_GATES } from './cross-repo-receipt.mjs'
import { canonicalJson } from './fsusui-release-dispatch-lib.mjs'

const option = (args, name) => {
  const index = args.indexOf(name)
  if (index < 0 || !args[index + 1]) throw new Error(`${name} is required.`)
  return path.resolve(args[index + 1])
}

const exact = (value, keys, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object.`)
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  )
    throw new Error(`${label} has missing or unknown fields.`)
}

export function validateProducerEvidence(evidence, candidateSha256) {
  exact(
    evidence,
    ['schemaVersion', 'candidateSha256', 'gates'],
    'FsusBlog producer evidence',
  )
  if (
    evidence.schemaVersion !== 1 ||
    evidence.candidateSha256 !== candidateSha256
  )
    throw new Error('FsusBlog producer evidence candidate identity mismatch.')
  if (
    !Array.isArray(evidence.gates) ||
    evidence.gates.length !== REQUIRED_GATES.length
  )
    throw new Error('FsusBlog producer evidence gate coverage is incomplete.')
  const names = new Set()
  for (const gate of evidence.gates) {
    exact(gate, ['name', 'status', 'durationMs'], 'FsusBlog producer gate')
    if (
      !REQUIRED_GATES.includes(gate.name) ||
      names.has(gate.name) ||
      !['success', 'failed', 'skipped'].includes(gate.status) ||
      !Number.isInteger(gate.durationMs) ||
      gate.durationMs < 0
    )
      throw new Error('FsusBlog producer evidence gate is invalid.')
    names.add(gate.name)
  }
  if (REQUIRED_GATES.some((name) => !names.has(name)))
    throw new Error('FsusBlog producer evidence gate coverage is incomplete.')
  return evidence
}

const skippedGates = () =>
  REQUIRED_GATES.map((name) => ({ name, status: 'skipped', durationMs: 0 }))

export function readProducerEvidence(evidencePath, candidateSha256) {
  if (!existsSync(evidencePath))
    return { evidenceStatus: 'missing', gates: skippedGates() }
  try {
    const evidence = validateProducerEvidence(
      JSON.parse(readFileSync(evidencePath, 'utf8')),
      candidateSha256,
    )
    return { evidenceStatus: 'valid', gates: evidence.gates }
  } catch {
    return { evidenceStatus: 'invalid', gates: skippedGates() }
  }
}

export function main(args = process.argv.slice(2)) {
  const repo = option(args, '--repository')
  const candidate = option(args, '--candidate')
  const output = option(args, '--output')
  const evidencePath = `${output}.producer.json`
  const sha = () =>
    createHash('sha256').update(readFileSync(candidate)).digest('hex')
  const safeSha = () => {
    try {
      return sha()
    } catch {
      return null
    }
  }
  const clean = () =>
    execFileSync('git', ['status', '--porcelain'], {
      cwd: repo,
      encoding: 'utf8',
    }).trim()
      ? 'dirty'
      : 'clean'
  const lock = JSON.parse(
    readFileSync(path.join(repo, 'src/frontend/package-lock.json'), 'utf8'),
  )
  const version = (name) => lock.packages?.[`node_modules/${name}`]?.version
  const started = new Date()
  const before = sha()
  const workingTreeBefore = clean()
  rmSync(evidencePath, { force: true })
  const child = spawnSync(
    'npm',
    [
      '--prefix',
      'src/frontend',
      'run',
      'verify:fsusui-candidate',
      '--',
      '--tarball',
      candidate,
    ],
    {
      cwd: repo,
      stdio: 'inherit',
      env: {
        ...process.env,
        FSUSBLOG_FSUSUI_CANDIDATE: candidate,
        FSUSBLOG_FSUSUI_CANDIDATE_EVIDENCE: evidencePath,
      },
    },
  )
  const completed = new Date()
  const producer = readProducerEvidence(evidencePath, before)
  rmSync(evidencePath, { force: true })
  const gatesSuccessful = producer.gates.every(
    (gate) => gate.status === 'success',
  )
  const record = {
    commitSha: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repo,
      encoding: 'utf8',
    }).trim(),
    candidateSha256Before: before,
    candidateSha256After: safeSha(),
    workingTreeBefore,
    workingTreeAfter: clean(),
    commandStatus:
      child.status === 0 &&
      producer.evidenceStatus === 'valid' &&
      gatesSuccessful
        ? 'success'
        : 'failed',
    evidenceStatus: producer.evidenceStatus,
    gates: producer.gates,
    durationMs: Math.max(0, completed.getTime() - started.getTime()),
    startedAt: started.toISOString(),
    completedAt: completed.toISOString(),
    toolchain: {
      node: process.version.slice(1),
      npm: execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim(),
      vue: version('vue'),
      vite: version('vite'),
      typescript: version('typescript'),
      vueTsc: version('vue-tsc'),
    },
  }
  writeFileSync(output, canonicalJson(record), { mode: 0o600 })
  if (record.commandStatus !== 'success') process.exitCode = child.status || 1
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main()

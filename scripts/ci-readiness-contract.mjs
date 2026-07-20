import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
export const readinessSpec = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'spec/ci/readiness-gates.json'), 'utf8'),
)

export function sha256Path(target) {
  const absolute = path.resolve(target)
  if (!fs.existsSync(absolute))
    throw new Error(`Artifact is missing: ${target}`)
  const hash = createHash('sha256')
  const visit = (current, relative = '') => {
    const stat = fs.statSync(current)
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current).sort())
        visit(path.join(current, entry), path.join(relative, entry))
      return
    }
    hash.update(relative.split(path.sep).join('/'))
    hash.update('\0')
    hash.update(fs.readFileSync(current))
    hash.update('\0')
  }
  visit(
    absolute,
    fs.statSync(absolute).isDirectory() ? '' : path.basename(absolute),
  )
  return hash.digest('hex')
}

export function repositoryCommit(cwd = repoRoot) {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd,
    encoding: 'utf8',
  }).trim()
}

export function manifestIdentity(manifest) {
  const dimensions = Object.entries(manifest.dimensions ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join(',')
  return dimensions ? `${manifest.gate}[${dimensions}]` : manifest.gate
}

function assertHex(value, label) {
  if (!/^[a-f0-9]{64}$/u.test(value ?? ''))
    throw new Error(`${label} must be a lowercase SHA-256 digest.`)
}

function validateManifestShape(manifest, file) {
  if (manifest.schemaVersion !== 1)
    throw new Error(`${file}: unsupported readiness manifest schema.`)
  for (const field of [
    'workflowGroup',
    'commitSha',
    'gate',
    'status',
    'createdAt',
    'inputFingerprint',
    'reportSummary',
  ]) {
    if (typeof manifest[field] !== 'string' || manifest[field].length === 0)
      throw new Error(`${file}: missing ${field}.`)
  }
  if (!/^[a-f0-9]{40}$/u.test(manifest.commitSha))
    throw new Error(`${file}: commitSha must be a full Git SHA.`)
  assertHex(manifest.inputFingerprint, `${file}: inputFingerprint`)
  if (!manifest.toolchain || typeof manifest.toolchain.node !== 'string')
    throw new Error(`${file}: missing toolchain/runtime identity.`)
  if (
    !manifest.run ||
    !String(manifest.run.id) ||
    !String(manifest.run.attempt)
  )
    throw new Error(`${file}: missing workflow run identity.`)
  if (!Array.isArray(manifest.artifacts))
    throw new Error(`${file}: artifacts must be an array.`)
  for (const artifact of manifest.artifacts) {
    if (!artifact.name || !artifact.path)
      throw new Error(`${file}: artifact name/path is required.`)
    assertHex(artifact.sha256, `${file}: ${artifact.name}`)
  }
}

function validateOwner(gate, manifests, owner) {
  if (owner.cardinality === 'single') {
    if (manifests.length !== 1)
      throw new Error(
        `${gate}: expected exactly one execution owner, found ${manifests.length}.`,
      )
    return
  }
  const dimension = owner.dimension
  const values = manifests.map((manifest) => manifest.dimensions?.[dimension])
  if (values.some((value) => !value))
    throw new Error(`${gate}: every manifest must declare ${dimension}.`)
  if (new Set(values).size !== values.length)
    throw new Error(`${gate}: duplicate ${dimension} manifest.`)
  if (owner.cardinality === 'matrix') {
    const missing = owner.values.filter((value) => !values.includes(value))
    const unexpected = values.filter((value) => !owner.values.includes(value))
    if (missing.length || unexpected.length)
      throw new Error(
        `${gate}: matrix mismatch (missing=${missing.join(',') || 'none'}; unexpected=${unexpected.join(',') || 'none'}).`,
      )
    return
  }
  const shards = values.map((value) => {
    const match = /^(\d+)\/(\d+)$/u.exec(value)
    if (!match) throw new Error(`${gate}: invalid shard dimension ${value}.`)
    return { index: Number(match[1]), total: Number(match[2]) }
  })
  const totals = new Set(shards.map(({ total }) => total))
  if (totals.size !== 1)
    throw new Error(`${gate}: shard manifests disagree on total.`)
  const total = shards[0].total
  const indexes = new Set(shards.map(({ index }) => index))
  const missing = Array.from({ length: total }, (_, index) => index + 1).filter(
    (index) => !indexes.has(index),
  )
  if (manifests.length !== total || missing.length)
    throw new Error(
      `${gate}: missing shard(s) ${missing.join(',') || 'unknown'}.`,
    )
}

export function validateReadiness({
  manifests,
  profile,
  group,
  commitSha,
  runId,
  runAttempt,
  root,
}) {
  const required = readinessSpec.profiles[profile]
  if (!required) throw new Error(`Unknown readiness profile: ${profile}.`)
  const identities = new Set()
  for (const { manifest, file } of manifests) {
    validateManifestShape(manifest, file)
    const identity = manifestIdentity(manifest)
    if (identities.has(identity))
      throw new Error(`Duplicate readiness manifest: ${identity}.`)
    identities.add(identity)
    if (manifest.workflowGroup !== group)
      throw new Error(`${identity}: workflow group mismatch.`)
    if (manifest.commitSha !== commitSha)
      throw new Error(`${identity}: commit SHA mismatch.`)
    if (String(manifest.run.id) !== String(runId))
      throw new Error(
        `${identity}: stale artifact from workflow run ${manifest.run.id}.`,
      )
    if (String(manifest.run.attempt) !== String(runAttempt))
      throw new Error(
        `${identity}: stale artifact from workflow attempt ${manifest.run.attempt}.`,
      )
    if (manifest.status !== 'success')
      throw new Error(`${identity}: leaf status is ${manifest.status}.`)
    const summary = path.resolve(root, manifest.reportSummary)
    if (!fs.existsSync(summary))
      throw new Error(`${identity}: report summary is missing.`)
    for (const artifact of manifest.artifacts) {
      const artifactPath = path.resolve(root, artifact.path)
      if (
        fs.existsSync(artifactPath) &&
        sha256Path(artifactPath) !== artifact.sha256
      )
        throw new Error(
          `${identity}: artifact digest mismatch for ${artifact.name}.`,
        )
    }
  }
  for (const gate of required) {
    const gateManifests = manifests
      .map(({ manifest }) => manifest)
      .filter((manifest) => manifest.gate === gate)
    if (gateManifests.length === 0)
      throw new Error(`Missing required leaf manifest: ${gate}.`)
    validateOwner(gate, gateManifests, readinessSpec.owners[gate])
  }
  const unexpected = manifests
    .map(({ manifest }) => manifest.gate)
    .filter((gate) => !readinessSpec.owners[gate])
  if (unexpected.length) throw new Error(`Unknown leaf gate: ${unexpected[0]}.`)
  for (const binding of readinessSpec.artifactBindings) {
    const find = (gate) =>
      manifests
        .map(({ manifest }) => manifest)
        .find((manifest) => manifest.gate === gate)
        ?.artifacts.find((artifact) => artifact.name === binding.name)
    const producer = find(binding.producer)
    const consumer = find(binding.consumer)
    if (!producer || !consumer)
      throw new Error(
        `${binding.name}: producer/consumer artifact evidence missing.`,
      )
    if (producer.sha256 !== consumer.sha256)
      throw new Error(`${binding.name}: producer/consumer digest mismatch.`)
  }
  return {
    schemaVersion: 1,
    profile,
    workflowGroup: group,
    commitSha,
    run: { id: String(runId), attempt: String(runAttempt) },
    generatedAt: new Date().toISOString(),
    manifests: manifests
      .map(({ manifest }) => ({
        identity: manifestIdentity(manifest),
        inputFingerprint: manifest.inputFingerprint,
        artifacts: manifest.artifacts,
      }))
      .sort((left, right) => left.identity.localeCompare(right.identity)),
  }
}

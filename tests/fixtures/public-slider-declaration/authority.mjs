import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { URL } from 'node:url'
import { gunzipSync } from 'node:zlib'
import {
  buildInputRecord,
  candidateManifestName,
  verifyCandidate,
} from '../../../scripts/npm-candidate-lib.mjs'

export const authority = JSON.parse(
  readFileSync(new URL('./authority.json', import.meta.url), 'utf8'),
)
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const inventoryHash = (rows) =>
  sha256(
    rows
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([file, hash]) => `${file}\0${hash}\n`)
      .join(''),
  )

// Include production source, compiler/build/config inputs and frozen manifests.
// Test-only and README successors do not change the declaration input identity.
const sourceInput = (file) =>
  ((/^(vue|scripts|config)\//.test(file) &&
    /\.(?:[cm]?js|jsx|tsx?|vue|json|ya?ml)$/.test(file)) ||
    [
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'tsconfig.json',
    ].includes(file)) &&
  !file
    .split('/')
    .some((part) =>
      [
        'node_modules',
        'dist',
        '__tests__',
        'tests',
        'test-utils',
        'mock',
      ].includes(part),
    )

export function sourceProfile(root) {
  const files = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: root, encoding: 'utf8' },
  )
    .split('\0')
    .filter(sourceInput)
  const unique = [...new Set(files)]
  const hash = inventoryHash(
    unique.map((file) => [file, sha256(readFileSync(path.join(root, file)))]),
  )
  const profile = authority.profiles.find(
    (p) =>
      p.sourceInputsSha256 === hash && p.sourceInputCount === unique.length,
  )
  assert.ok(
    profile,
    `Unrecognized declaration source inputs: ${hash} (${unique.length})`,
  )
  return profile
}

// Read committed blob bytes, not a manifest's claim that it names known source.
function committedInputs(root, commit) {
  assert.match(commit, /^[a-f0-9]{40}$/, 'full candidate source commit')
  const files = execFileSync('git', ['ls-tree', '-rz', '--full-tree', commit], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean)
    .map((row) => {
      const [metadata, file] = row.split('\t')
      return { file, object: metadata.split(' ')[2] }
    })
    .filter(({ file }) => sourceInput(file))
  const blobs = execFileSync('git', ['cat-file', '--batch'], {
    cwd: root,
    input: files.map(({ object }) => `${object}\n`).join(''),
    maxBuffer: 64 * 1024 * 1024,
  })
  let offset = 0
  const rows = files.map(({ file, object }) => {
    const end = blobs.indexOf(10, offset)
    const [id, type, length] = blobs.subarray(offset, end).toString().split(' ')
    assert.equal(id, object)
    assert.equal(type, 'blob')
    const size = Number(length)
    assert.ok(Number.isSafeInteger(size) && size >= 0)
    const bytes = blobs.subarray(end + 1, end + 1 + size)
    assert.equal(bytes.length, size)
    offset = end + 1 + size + 1
    return [file, sha256(bytes)]
  })
  return { hash: inventoryHash(rows), count: rows.length }
}

export function candidateIdentity(root, profile, tarball) {
  assert.equal(sourceProfile(root).name, profile.name)
  const sidecar = JSON.parse(
    readFileSync(
      path.join(path.dirname(tarball), candidateManifestName),
      'utf8',
    ),
  )
  const committed = committedInputs(root, sidecar.commitSha)
  assert.equal(
    committed.hash,
    profile.sourceInputsSha256,
    'candidate committed source inputs',
  )
  assert.equal(committed.count, profile.sourceInputCount)
  const manifest = verifyCandidate({
    repoRoot: root,
    tarballPath: tarball,
    expectedCommit: sidecar.commitSha,
    expectedTagVersion: '1.5.1',
    requireProfile: 'Release',
  })
  const record = buildInputRecord(root, manifest.commitSha)
  assert.deepEqual(
    manifest.build.inputs,
    record.inputs,
    'all canonical build input digests',
  )
  assert.equal(manifest.build.inputFingerprint, record.fingerprint)
  assert.equal(manifest.build.command, 'pnpm run build:npm-package')
  assert.equal(manifest.build.scriptVersion, 1)
  assert.deepEqual(
    manifest.toolchain,
    authority.candidateContract.toolchain,
    'locked toolchain identity',
  )
  assert.deepEqual(
    manifest.package,
    authority.candidateContract.package,
    'exact prepared package identity',
  )
  return manifest
}

export function assertConsumerLock(consumer, tarball) {
  const lock = readFileSync(path.join(consumer, 'pnpm-lock.yaml'), 'utf8')
  const identity = {}
  for (const section of ['packages', 'snapshots']) {
    let body = lock.split(`\n${section}:\n`)[1]
    assert.ok(body, `frozen consumer ${section}`)
    if (section === 'packages') body = body.split('\nsnapshots:\n')[0]
    const blocks = body.split(/(?=^ {2}\S)/m)
    const own = blocks.filter((block) =>
      /^ {2}'?@ozwasyd\/element-plus@file:/.test(block),
    )
    assert.equal(own.length, 1, `one actual package in consumer ${section}`)
    if (section === 'packages') {
      const integrity = own[0].match(/integrity: (sha512-[^,}\s]+)/)?.[1]
      assert.equal(
        integrity,
        `sha512-${createHash('sha512').update(readFileSync(tarball)).digest('base64')}`,
        'frozen install integrity binds this actual archive',
      )
    }
    const thirdParty = blocks.filter((block) => !own.includes(block))
    identity[section] = {
      count: thirdParty.length - 1,
      sha256: sha256(thirdParty.join('')),
    }
  }
  assert.deepEqual(
    identity,
    authority.candidateContract.thirdPartyLock,
    'complete original frozen third-party graph',
  )
  return identity
}

// Exact publication rewrites from the pinned prepare-npm-package producer.
export function publishedDeclaration(text) {
  for (const pattern of [
    /(\bfrom\s+['"])element-plus(?=(?:\/[^'"]*)?['"])/g,
    /(\bimport\s*\(\s*['"])element-plus(?=(?:\/[^'"]*)?['"])/g,
    /(\brequire\s*\(\s*['"])element-plus(?=(?:\/[^'"]*)?['"])/g,
    /(\bimport\s+['"])element-plus(?=(?:\/[^'"]*)?['"])/g,
  ])
    text = text.replace(
      pattern,
      (_, prefix) => `${prefix}@ozwasyd/element-plus`,
    )
  return text
}

export function assertSliderDeclarations(actual, generated) {
  assert.equal(
    generated.length,
    16,
    'complete actual canonical Slider declaration inventory',
  )
  for (const module of ['es', 'lib']) {
    const rows = [...actual]
      .filter(
        ([file]) =>
          file.startsWith(`${module}/components/slider/`) &&
          /\.d\.(?:ts|mts|cts)$/.test(file),
      )
      .map(([file, hash]) => [file.slice(module.length + 1), hash])
      .sort()
    assert.deepEqual(
      rows,
      [...generated].sort(),
      `${module} complete fresh canonical Slider declarations`,
    )
  }
}

export function normalizeInstalled(rows) {
  return rows.map((row) => ({
    ...row,
    file: row.file?.includes('/@ozwasyd/element-plus/')
      ? `@ozwasyd/element-plus/${row.file.split('/@ozwasyd/element-plus/').at(-1)}`
      : row.file,
    message: row.message.replace(
      /typeof import\("[^"]*\/@ozwasyd\/element-plus\//g,
      'typeof import("@ozwasyd/element-plus/',
    ),
  }))
}

export function assertProducer(profile, rows) {
  assert.deepEqual(
    rows,
    profile.producerDiagnostics,
    `complete canonical diagnostic inventory for ${profile.name}`,
  )
}

export function assertInstalled(profile, phase, rows) {
  const normalized = normalizeInstalled(rows)
  const local = normalized.filter((d) => d.file === `slider-${phase}.ts`)
  const external = normalized.filter((d) => d.file !== `slider-${phase}.ts`)
  assert.deepEqual(
    external,
    profile.externalDiagnostics,
    `complete strict external diagnostic inventory for ${profile.name}`,
  )
  assert.deepEqual(
    local,
    phase === 'positive' ? [] : authority.negative,
    'all original strict slider controls, including exact messages and codes',
  )
}

// Both known artifacts are ordinary npm tar archives. Verify the actual file:
// caller-supplied manifest labels or package versions cannot select expectations.
export function installedArtifact(
  root,
  profile,
  tarball,
  packageRoot,
  canonical,
) {
  const manifest = candidateIdentity(root, profile, tarball)
  const bytes = readFileSync(tarball)
  assert.equal(
    sha256(bytes),
    manifest.artifact.sha256,
    'actual candidate tarball identity bound by canonical verifier',
  )
  const tar = gunzipSync(bytes)
  const entries = new Map()
  for (let offset = 0; offset + 512 <= tar.length; ) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every((byte) => byte === 0)) break
    const text = (start, length) =>
      header
        .subarray(start, start + length)
        .toString()
        .replace(/\0.*$/s, '')
    assert.ok(['0', ''].includes(text(156, 1)), 'ordinary npm archive file')
    const prefix = text(345, 155)
    const name = `${prefix ? `${prefix}/` : ''}${text(0, 100)}`
    assert.ok(name.startsWith('package/') && !name.split('/').includes('..'))
    const size = Number.parseInt(text(124, 12).trim(), 8)
    assert.ok(
      Number.isSafeInteger(size) &&
        size >= 0 &&
        offset + 512 + size <= tar.length,
    )
    const file = name.slice('package/'.length)
    assert.ok(!entries.has(file), `unique archive entry ${file}`)
    entries.set(file, sha256(tar.subarray(offset + 512, offset + 512 + size)))
    offset += 512 + Math.ceil(size / 512) * 512
  }
  const actual = new Map()
  const visit = (dir, relative = '') => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = `${relative}${entry.name}`
      // pnpm adds dependency links/bin shims here; these are not archive files.
      if (file === 'node_modules') continue
      if (entry.isDirectory()) visit(path.join(dir, entry.name), `${file}/`)
      else {
        assert.ok(entry.isFile(), `ordinary installed file ${file}`)
        actual.set(file, sha256(readFileSync(path.join(dir, entry.name))))
      }
    }
  }
  visit(packageRoot)
  assert.deepEqual(
    [...actual].sort(),
    [...entries].sort(),
    'installed bytes match actual tarball',
  )
  assert.equal(
    canonical.canonicalCompleted,
    true,
    'successful actual producer in this invocation',
  )
  assert.equal(canonical.sourceInputsSha256, profile.sourceInputsSha256)
  assertSliderDeclarations(actual, canonical.sliderDeclarations)
  const slider = [...actual].filter(([file]) =>
    /^(es|lib)\/components\/slider\/.*\.(mjs|js)$/.test(file),
  )
  assert.equal(slider.length, authority.sliderRuntime.count)
  assert.equal(
    inventoryHash(slider),
    authority.sliderRuntime.sha256,
    'all 36 original packed slider runtime files remain byte-identical',
  )
  return {
    tarballSha256: sha256(bytes),
    candidateCommit: manifest.commitSha,
    inputFingerprint: manifest.build.inputFingerprint,
    manifestSha256: sha256(
      readFileSync(path.join(path.dirname(tarball), candidateManifestName)),
    ),
    installedPayloadFiles: actual.size,
    installedPayloadSha256: inventoryHash([...actual]),
    canonicalSliderDeclarationFiles: canonical.sliderDeclarations.length * 2,
    sliderRuntimeFiles: slider.length,
  }
}

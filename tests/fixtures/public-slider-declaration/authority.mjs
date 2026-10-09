import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { URL } from 'node:url'
import { gunzipSync } from 'node:zlib'

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
export function installedArtifact(profile, tarball, packageRoot) {
  const bytes = readFileSync(tarball)
  assert.equal(
    sha256(bytes),
    profile.tarballSha256,
    'actual candidate tarball identity',
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
    tarballSha256: profile.tarballSha256,
    sliderRuntimeFiles: slider.length,
  }
}

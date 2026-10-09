import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { URL } from 'node:url'
import {
  buildInputRecord,
  canonicalJsonDigest,
  extractCandidate,
} from '../../../scripts/npm-candidate-lib.mjs'

export const authority = JSON.parse(
  readFileSync(new URL('./authority.json', import.meta.url), 'utf8'),
)
const digest = (contents) => createHash('sha256').update(contents).digest('hex')

export function isSourceInput(file) {
  return (
    (['vue/', 'scripts/', 'config/'].some((prefix) =>
      file.startsWith(prefix),
    ) ||
      [
        'package.json',
        'pnpm-lock.yaml',
        'pnpm-workspace.yaml',
        '.npmrc',
        'tsconfig.json',
      ].includes(file)) &&
    !file
      .split('/')
      .some((segment) =>
        ['test', 'mock'].some((fragment) => segment.includes(fragment)),
      )
  )
}

export function readSourceAuthority(root) {
  const files = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: root, encoding: 'utf8' },
  )
    .split('\0')
    .filter(isSourceInput)
    .sort()
  const inputs = files.map((file) => {
    const contents = readFileSync(path.join(root, file))
    const blob = createHash('sha1')
      .update(`blob ${Buffer.byteLength(contents)}\0`)
      .update(contents)
      .digest('hex')
    return [file, blob]
  })
  const fingerprint = digest(JSON.stringify(inputs))
  const state = authority.sourceStates.find(
    (candidate) => candidate.sourceInputFingerprint === fingerprint,
  )
  assert.ok(state, `unrecognized declaration source inputs: ${fingerprint}`)
  assert.equal(inputs.length, state.sourceInputCount)
  return state
}

function packageTree(root, directory = root) {
  return readdirSync(directory)
    .sort()
    .flatMap((name) => {
      const file = path.join(directory, name)
      const stat = lstatSync(file)
      if (stat.isDirectory()) return packageTree(root, file)
      return [
        [
          path.relative(root, file),
          stat.isSymbolicLink()
            ? `symlink:${readlinkSync(file)}`
            : digest(readFileSync(file)),
        ],
      ]
    })
}

export function readArtifactAuthority(root, consumer, packageRoot) {
  const consumerManifest = JSON.parse(
    readFileSync(path.join(consumer, 'package.json'), 'utf8'),
  )
  const specifier = consumerManifest.dependencies['@ozwasyd/element-plus']
  assert.match(specifier, /^file:.*\.tgz$/)
  const tarballPath = path.resolve(consumer, specifier.slice(5))
  const tarballSha256 = digest(readFileSync(tarballPath))
  const artifact = authority.artifacts.find(
    (candidate) => candidate.sha256 === tarballSha256,
  )
  assert.ok(artifact, `unrecognized declaration artifact: ${tarballSha256}`)
  assert.equal(artifact.manifest.commitSha, artifact.sourceSha)
  assert.equal(artifact.manifest.artifact.sha256, tarballSha256)
  assert.equal(artifact.manifest.sourceProfile, 'Release')
  assert.equal(
    artifact.manifest.build.inputFingerprint,
    buildInputRecord(root, artifact.sourceSha).fingerprint,
  )
  assert.equal(
    artifact.manifest.build.lockfileSha256,
    digest(readFileSync(path.join(root, 'pnpm-lock.yaml'))),
  )
  assert.equal(
    canonicalJsonDigest(
      JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8')),
    ),
    artifact.manifest.package.packageJsonCanonicalSha256,
  )
  const temporary = mkdtempSync(
    path.join(os.tmpdir(), 'datepicker-panel-artifact-'),
  )
  try {
    const extracted = extractCandidate(tarballPath, temporary)
    assert.deepEqual(
      Object.fromEntries(packageTree(packageRoot)),
      {
        ...Object.fromEntries(packageTree(extracted)),
        ...Object.fromEntries(artifact.installationAdditions),
      },
      'the installed package must contain the exact verified tarball bytes',
    )
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
  return artifact
}

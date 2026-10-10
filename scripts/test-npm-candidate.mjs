import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import './prepare-npm-package.test.mjs'
import {
  candidateManifestName,
  candidateTarballName,
  compareCandidates,
  createCandidate,
  moveCandidateTarball,
  verifyCandidate,
} from './npm-candidate-lib.mjs'

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'fsusui-candidate-tests-'))
const commitSha = 'a'.repeat(40)

function assertThrows(action, pattern, label) {
  try {
    action()
  } catch (error) {
    if (pattern.test(String(error))) return
    throw new Error(`${label} failed with unexpected error: ${error}`, {
      cause: error,
    })
  }
  throw new Error(`${label} did not fail.`)
}

function makePackage(directory, overrides = {}) {
  mkdirSync(path.join(directory, 'lib'), { recursive: true })
  mkdirSync(path.join(directory, 'es'), { recursive: true })
  mkdirSync(path.join(directory, 'dist'), { recursive: true })
  writeFileSync(path.join(directory, 'lib/index.js'), 'module.exports = {}\n')
  writeFileSync(path.join(directory, 'es/index.mjs'), 'export default {}\n')
  writeFileSync(path.join(directory, 'es/index.d.ts'), 'export {}\n')
  writeFileSync(path.join(directory, 'dist/fsus.css'), ':root {}\n')
  writeFileSync(
    path.join(directory, 'package.json'),
    `${JSON.stringify(
      {
        name: '@ozwasyd/element-plus',
        version: '1.5.1',
        main: 'lib/index.js',
        module: 'es/index.mjs',
        types: 'es/index.d.ts',
        style: 'dist/fsus.css',
        repository: {
          type: 'git',
          url: 'https://github.com/Ozwasyd/FsusUI.git',
        },
        publishConfig: {
          access: 'public',
          registry: 'https://registry.npmjs.org/',
        },
        ...overrides,
      },
      null,
      2,
    )}\n`,
  )
}

function createFixture(name, packageOverrides = {}) {
  const packageRoot = path.join(tempRoot, `${name}-package`)
  const outputDir = path.join(tempRoot, `${name}-candidate`)
  makePackage(packageRoot, packageOverrides)
  createCandidate({
    repoRoot,
    packageRoot,
    outputDir,
    commitSha,
    toolchain: { node: 'fixture', pnpm: 'fixture', npm: 'fixture' },
  })
  return {
    outputDir,
    packageRoot,
    tarball: path.join(outputDir, candidateTarballName),
  }
}

try {
  const crossDeviceSource = path.join(tempRoot, 'cross-device-source.tgz')
  const crossDeviceDestination = path.join(
    tempRoot,
    'cross-device-output',
    candidateTarballName,
  )
  mkdirSync(path.dirname(crossDeviceDestination), { recursive: true })
  writeFileSync(crossDeviceSource, 'candidate-bytes')
  let simulatedCrossDeviceRename = true
  moveCandidateTarball(crossDeviceSource, crossDeviceDestination, {
    rename(source, destination) {
      if (simulatedCrossDeviceRename) {
        simulatedCrossDeviceRename = false
        const error = new Error('simulated cross-device move')
        error.code = 'EXDEV'
        throw error
      }
      renameSync(source, destination)
    },
  })
  if (
    existsSync(crossDeviceSource) ||
    readFileSync(crossDeviceDestination, 'utf8') !== 'candidate-bytes' ||
    readdirSync(path.dirname(crossDeviceDestination)).some((name) =>
      name.startsWith('.fsusui-candidate-move-'),
    )
  ) {
    throw new Error(
      'Cross-device candidate move did not preserve bytes and cleanup.',
    )
  }

  const failedSource = path.join(tempRoot, 'failed-cross-device-source.tgz')
  const failedDestination = path.join(
    tempRoot,
    'failed-cross-device-output',
    candidateTarballName,
  )
  mkdirSync(path.dirname(failedDestination), { recursive: true })
  writeFileSync(failedSource, 'must-not-publish')
  assertThrows(
    () =>
      moveCandidateTarball(failedSource, failedDestination, {
        copyFile() {
          throw new Error('simulated copy failure')
        },
        rename() {
          const error = new Error('simulated cross-device move')
          error.code = 'EXDEV'
          throw error
        },
      }),
    /simulated copy failure/iu,
    'cross-device copy failure fixture',
  )
  if (
    !existsSync(failedSource) ||
    existsSync(failedDestination) ||
    readdirSync(path.dirname(failedDestination)).some((name) =>
      name.startsWith('.fsusui-candidate-move-'),
    )
  ) {
    throw new Error(
      'Failed cross-device move left a canonical or staging artifact.',
    )
  }

  assertThrows(
    () =>
      moveCandidateTarball('source', 'destination', {
        rename() {
          const error = new Error('simulated permission failure')
          error.code = 'EACCES'
          throw error
        },
      }),
    /simulated permission failure/iu,
    'non-cross-device move failure fixture',
  )

  const valid = createFixture('valid')
  verifyCandidate({
    repoRoot,
    tarballPath: valid.tarball,
    expectedCommit: commitSha,
  })

  const versionMismatch = createFixture('version-mismatch')
  const manifestPath = path.join(
    versionMismatch.outputDir,
    candidateManifestName,
  )
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  manifest.package.version = '1.5.2'
  writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`)
  assertThrows(
    () =>
      verifyCandidate({
        repoRoot,
        tarballPath: versionMismatch.tarball,
        expectedCommit: commitSha,
      }),
    /metadata does not match/iu,
    'version mismatch fixture',
  )

  const missingRoot = path.join(tempRoot, 'missing-package')
  makePackage(missingRoot)
  rmSync(path.join(missingRoot, 'lib/index.js'))
  assertThrows(
    () =>
      createCandidate({
        repoRoot,
        packageRoot: missingRoot,
        outputDir: path.join(tempRoot, 'missing-candidate'),
        commitSha,
      }),
    /missing main entry/iu,
    'missing file fixture',
  )

  const workspaceRoot = path.join(tempRoot, 'workspace-package')
  makePackage(workspaceRoot, { dependencies: { internal: 'workspace:*' } })
  assertThrows(
    () =>
      createCandidate({
        repoRoot,
        packageRoot: workspaceRoot,
        outputDir: path.join(tempRoot, 'workspace-candidate'),
        commitSha,
      }),
    /workspace protocol/iu,
    'workspace protocol fixture',
  )

  const fileDependencyRoot = path.join(tempRoot, 'file-dependency-package')
  makePackage(fileDependencyRoot, { dependencies: { local: 'file:../local-pkg' } })
  assertThrows(
    () =>
      createCandidate({
        repoRoot,
        packageRoot: fileDependencyRoot,
        outputDir: path.join(tempRoot, 'file-dependency-candidate'),
        commitSha,
      }),
    /file protocol reference/iu,
    'file protocol fixture',
  )

  const linkDependencyRoot = path.join(tempRoot, 'link-dependency-package')
  makePackage(linkDependencyRoot, { dependencies: { local: 'link:../local-pkg' } })
  assertThrows(
    () =>
      createCandidate({
        repoRoot,
        packageRoot: linkDependencyRoot,
        outputDir: path.join(tempRoot, 'link-dependency-candidate'),
        commitSha,
      }),
    /link protocol reference/iu,
    'link protocol fixture',
  )

  const privateRegistryRoot = path.join(tempRoot, 'private-registry-package')
  makePackage(privateRegistryRoot, {
    publishConfig: {
      access: 'public',
      registry: 'https://npm.internal.example.com/',
    },
  })
  assertThrows(
    () =>
      createCandidate({
        repoRoot,
        packageRoot: privateRegistryRoot,
        outputDir: path.join(tempRoot, 'private-registry-candidate'),
        commitSha,
      }),
    /private registry/iu,
    'private registry fixture',
  )

  const tampered = createFixture('tampered')
  appendFileSync(tampered.tarball, 'tampered')
  assertThrows(
    () =>
      verifyCandidate({
        repoRoot,
        tarballPath: tampered.tarball,
        expectedCommit: commitSha,
      }),
    /checksum sidecar/iu,
    'digest tamper fixture',
  )

  assertThrows(
    () =>
      verifyCandidate({
        repoRoot,
        tarballPath: valid.tarball,
        expectedCommit: 'b'.repeat(40),
      }),
    /source SHA mismatch/iu,
    'source SHA fixture',
  )

  const rebuilt = createFixture('rebuilt')
  const comparison = compareCandidates(valid.tarball, rebuilt.tarball)
  if (!comparison.canonicalDigest || comparison.files < 5) {
    throw new Error('Canonical comparison did not report the package tree.')
  }
  const changed = createFixture('changed')
  const changedRoot = path.join(tempRoot, 'changed-second-package')
  cpSync(changed.packageRoot, changedRoot, { recursive: true })
  writeFileSync(
    path.join(changedRoot, 'lib/index.js'),
    'module.exports = { changed: true }\n',
  )
  const changedSecond = path.join(tempRoot, 'changed-second-candidate')
  createCandidate({
    repoRoot,
    packageRoot: changedRoot,
    outputDir: changedSecond,
    commitSha,
    toolchain: { node: 'fixture', pnpm: 'fixture', npm: 'fixture' },
  })
  assertThrows(
    () =>
      compareCandidates(
        changed.tarball,
        path.join(changedSecond, candidateTarballName),
      ),
    /canonical contents differ/iu,
    'reproducibility mismatch fixture',
  )

  console.log('[npm-candidate] 13 fixture scenarios passed')
} finally {
  rmSync(tempRoot, { force: true, recursive: true })
}

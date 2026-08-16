import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolveNpmDistTag } from './resolve-npm-dist-tag.mjs'

export const candidateSchemaVersion = 1
export const candidateTarballName = 'fsusui-npm-candidate.tgz'
export const candidateChecksumName = 'fsusui-npm-candidate.sha256'
export const candidateManifestName = 'fsusui-npm-candidate.manifest.json'
export const canonicalIgnoredFields = []

const sha256 = (contents) => createHash('sha256').update(contents).digest('hex')

export const sha256File = (filePath) => sha256(readFileSync(filePath))

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortJson(value[key])]),
    )
  }
  return value
}

export const canonicalJson = (value) => `${JSON.stringify(sortJson(value))}\n`
export const canonicalJsonDigest = (value) => sha256(canonicalJson(value))

function cleanNpmEnvironment() {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) => !name.startsWith('npm_config_'),
    ),
  )
}

function commandVersion(command, args = ['--version']) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    env: command === 'npm' ? cleanNpmEnvironment() : process.env,
  }).trim()
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function resolveCommit(repoRoot) {
  return (
    process.env.GITHUB_SHA ||
    execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim()
  )
}

function inputDigests(repoRoot) {
  const inputPaths = [
    'pnpm-lock.yaml',
    'package.json',
    'scripts/npm-candidate-lib.mjs',
    'scripts/package-candidate.mjs',
    'scripts/prepare-npm-package.mjs',
    'vue/packages/element-plus/package.json',
  ]
  return Object.fromEntries(
    inputPaths.map((relativePath) => {
      const filePath = path.join(repoRoot, relativePath)
      if (!existsSync(filePath)) {
        throw new Error(`Candidate build input is missing: ${relativePath}`)
      }
      return [relativePath, sha256File(filePath)]
    }),
  )
}

export function buildInputRecord(repoRoot, commitSha) {
  const inputs = inputDigests(repoRoot)
  return {
    fingerprint: canonicalJsonDigest({ commitSha, inputs }),
    inputs,
  }
}

function validatePackageShape(packageRoot, packageJson) {
  if (!packageJson.name || !packageJson.version) {
    throw new Error('Candidate package.json must contain name and version.')
  }
  for (const field of ['main', 'module', 'types', 'style']) {
    const relativePath = packageJson[field]
    if (!relativePath || !existsSync(path.join(packageRoot, relativePath))) {
      throw new Error(
        `Candidate package is missing ${field} entry ${String(relativePath)}.`,
      )
    }
  }
  const exportTargets = []
  const visitExport = (value) => {
    if (typeof value === 'string') exportTargets.push(value)
    else if (Array.isArray(value)) value.forEach(visitExport)
    else if (value && typeof value === 'object') {
      Object.values(value).forEach(visitExport)
    }
  }
  visitExport(packageJson.exports)
  for (const target of exportTargets) {
    if (
      target.startsWith('./') &&
      !target.includes('*') &&
      !existsSync(path.join(packageRoot, target))
    ) {
      throw new Error(`Candidate package export is missing: ${target}.`)
    }
  }
  const workspaceFiles = collectFiles(packageRoot).filter((filePath) => {
    if (lstatSync(filePath).isSymbolicLink()) return false
    return /["']workspace:[^"']*["']/u.test(readFileSync(filePath, 'utf8'))
  })
  if (workspaceFiles.length > 0) {
    throw new Error(
      `Candidate contains workspace protocol references: ${workspaceFiles
        .map((filePath) => path.relative(packageRoot, filePath))
        .join(', ')}`,
    )
  }
  validateDependencyManifest(packageJson)
}

const PUBLIC_NPM_REGISTRY = 'https://registry.npmjs.org'
const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
]

function isPublicRegistry(registry) {
  return registry?.replace(/\/+$/u, '') === PUBLIC_NPM_REGISTRY
}

function validateDependencyManifest(packageJson) {
  for (const field of DEPENDENCY_FIELDS) {
    const dependencies = packageJson[field]
    if (!dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)) {
      continue
    }
    for (const [name, specifier] of Object.entries(dependencies)) {
      if (typeof specifier !== 'string') continue
      const protocolMatch = /^(file|link|workspace):/u.exec(specifier)
      if (protocolMatch) {
        throw new Error(
          `Candidate dependency '${name}' leaks a ${protocolMatch[1]} protocol reference: ${specifier}`,
        )
      }
      if (/^https?:\/\//u.test(specifier) && !specifier.startsWith(`${PUBLIC_NPM_REGISTRY}/`)) {
        throw new Error(
          `Candidate dependency '${name}' references a non-public registry URL: ${specifier}`,
        )
      }
    }
  }
  const registry = packageJson.publishConfig?.registry
  if (registry && !isPublicRegistry(registry)) {
    throw new Error(`Candidate publishConfig leaks a private registry: ${registry}`)
  }
}

function collectFiles(rootDir, currentDir = rootDir) {
  const files = []
  for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
    const absolutePath = path.join(currentDir, entry.name)
    if (entry.isDirectory()) files.push(...collectFiles(rootDir, absolutePath))
    else files.push(absolutePath)
  }
  return files
}

function packDirectory(packageRoot, outputDir) {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'fsusui-npm-pack-'))
  try {
    const output = execFileSync(
      'npm',
      ['pack', packageRoot, '--json', '--pack-destination', tempDir],
      { cwd: tempDir, encoding: 'utf8', env: cleanNpmEnvironment() },
    )
    const result = JSON.parse(output)
    const filename = result.at(0)?.filename
    if (!filename)
      throw new Error('npm pack did not report a tarball filename.')
    const destination = path.join(outputDir, candidateTarballName)
    renameSync(path.join(tempDir, filename), destination)
    return destination
  } finally {
    rmSync(tempDir, { force: true, recursive: true })
  }
}

export function createCandidate({
  repoRoot,
  packageRoot,
  outputDir,
  commitSha = resolveCommit(repoRoot),
  sourceProfile = 'Release',
  toolchain,
}) {
  mkdirSync(outputDir, { recursive: true })
  const packageJson = readJson(path.join(packageRoot, 'package.json'))
  validatePackageShape(packageRoot, packageJson)
  const tarballPath = packDirectory(packageRoot, outputDir)
  const tarballSha256 = sha256File(tarballPath)
  const buildInput = buildInputRecord(repoRoot, commitSha)
  const publishConfig = packageJson.publishConfig ?? {}
  const manifest = {
    schemaVersion: candidateSchemaVersion,
    sourceProfile,
    commitSha,
    package: {
      name: packageJson.name,
      version: packageJson.version,
      distTag: resolveNpmDistTag(packageJson.version),
      packageJsonCanonicalSha256: canonicalJsonDigest(packageJson),
    },
    artifact: {
      filename: candidateTarballName,
      sha256: tarballSha256,
    },
    toolchain: toolchain ?? {
      node: process.version,
      pnpm: commandVersion('pnpm'),
      npm: commandVersion('npm'),
    },
    build: {
      scriptVersion: candidateSchemaVersion,
      command: 'pnpm run build:npm-package',
      lockfileSha256: buildInput.inputs['pnpm-lock.yaml'],
      inputFingerprint: buildInput.fingerprint,
      inputs: buildInput.inputs,
    },
    metadata: {
      publishConfigPresent: Object.keys(publishConfig).length > 0,
      publicAccess: publishConfig.access === 'public',
      registry: publishConfig.registry ?? 'https://registry.npmjs.org/',
      provenanceEligible: Boolean(
        packageJson.repository &&
        publishConfig.access === 'public' &&
        (publishConfig.registry ?? 'https://registry.npmjs.org/') ===
          'https://registry.npmjs.org/',
      ),
    },
  }
  writeFileSync(
    path.join(outputDir, candidateChecksumName),
    `${tarballSha256}  ${candidateTarballName}\n`,
  )
  writeFileSync(
    path.join(outputDir, candidateManifestName),
    canonicalJson(manifest),
  )
  return { manifest, tarballPath }
}

function assertSafeArchive(entries) {
  for (const entry of entries) {
    if (
      path.isAbsolute(entry) ||
      entry.split('/').includes('..') ||
      (!entry.startsWith('package/') && entry !== 'package')
    ) {
      throw new Error(`Candidate archive contains unsafe path: ${entry}`)
    }
  }
}

export function extractCandidate(tarballPath, destination) {
  const listing = execFileSync('tar', ['-tzf', tarballPath], {
    encoding: 'utf8',
  })
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean)
  assertSafeArchive(listing)
  mkdirSync(destination, { recursive: true })
  execFileSync('tar', ['-xzf', tarballPath, '-C', destination])
  return path.join(destination, 'package')
}

export function readCandidatePackageJson(tarballPath) {
  const tempDir = mkdtempSync(
    path.join(os.tmpdir(), 'fsusui-candidate-package-'),
  )
  try {
    const packageRoot = extractCandidate(tarballPath, tempDir)
    return readJson(path.join(packageRoot, 'package.json'))
  } finally {
    rmSync(tempDir, { force: true, recursive: true })
  }
}

function sidecarPaths(tarballPath) {
  const directory = path.dirname(tarballPath)
  return {
    checksumPath: path.join(directory, candidateChecksumName),
    manifestPath: path.join(directory, candidateManifestName),
  }
}

export function verifyCandidate({
  repoRoot,
  tarballPath,
  expectedCommit = resolveCommit(repoRoot),
  expectedTagVersion,
  requireProfile = 'Release',
}) {
  const { checksumPath, manifestPath } = sidecarPaths(tarballPath)
  for (const requiredPath of [tarballPath, checksumPath, manifestPath]) {
    if (!existsSync(requiredPath)) {
      throw new Error(`Candidate artifact is missing: ${requiredPath}`)
    }
  }
  const manifest = readJson(manifestPath)
  const digest = sha256File(tarballPath)
  const checksum = readFileSync(checksumPath, 'utf8').trim()
  if (checksum !== `${digest}  ${path.basename(tarballPath)}`) {
    throw new Error('Candidate checksum sidecar does not match the tarball.')
  }
  if (
    manifest.schemaVersion !== candidateSchemaVersion ||
    manifest.artifact?.filename !== path.basename(tarballPath) ||
    manifest.artifact?.sha256 !== digest
  ) {
    throw new Error(
      'Candidate manifest digest or schema does not match tarball.',
    )
  }
  if (manifest.sourceProfile !== requireProfile) {
    throw new Error(
      `Candidate source profile mismatch: expected ${requireProfile}, got ${manifest.sourceProfile}.`,
    )
  }
  if (manifest.commitSha !== expectedCommit) {
    throw new Error(
      `Candidate source SHA mismatch: expected ${expectedCommit}, got ${manifest.commitSha}.`,
    )
  }
  if (
    manifest.build?.lockfileSha256 !==
      sha256File(path.join(repoRoot, 'pnpm-lock.yaml')) ||
    manifest.build?.inputFingerprint !==
      buildInputRecord(repoRoot, manifest.commitSha).fingerprint
  ) {
    throw new Error('Candidate lockfile or build input fingerprint drifted.')
  }
  const tempDir = mkdtempSync(
    path.join(os.tmpdir(), 'fsusui-candidate-verify-'),
  )
  try {
    const packageRoot = extractCandidate(tarballPath, tempDir)
    const packageJson = readJson(path.join(packageRoot, 'package.json'))
    const sourcePackageJson = readJson(
      path.join(repoRoot, 'vue/packages/element-plus/package.json'),
    )
    validatePackageShape(packageRoot, packageJson)
    if (
      packageJson.name !== manifest.package?.name ||
      packageJson.version !== manifest.package?.version ||
      canonicalJsonDigest(packageJson) !==
        manifest.package?.packageJsonCanonicalSha256 ||
      resolveNpmDistTag(packageJson.version) !== manifest.package?.distTag
    ) {
      throw new Error('Candidate package metadata does not match manifest.')
    }
    if (
      packageJson.name !==
        (process.env.NPM_PACKAGE_NAME || '@ozwasyd/element-plus') ||
      packageJson.version !== sourcePackageJson.version
    ) {
      throw new Error(
        'Candidate package identity drifted from release sources.',
      )
    }
    if (expectedTagVersion && packageJson.version !== expectedTagVersion) {
      throw new Error(
        `Tag version ${expectedTagVersion} does not match candidate package version ${packageJson.version}.`,
      )
    }
    if (
      !manifest.metadata?.publishConfigPresent ||
      !manifest.metadata?.publicAccess ||
      !manifest.metadata?.provenanceEligible
    ) {
      throw new Error(
        'Candidate is missing required publish/provenance metadata.',
      )
    }
  } finally {
    rmSync(tempDir, { force: true, recursive: true })
  }
  return manifest
}

function canonicalTree(packageRoot) {
  return Object.fromEntries(
    collectFiles(packageRoot)
      .map((filePath) => {
        const relativePath = path
          .relative(packageRoot, filePath)
          .split(path.sep)
          .join('/')
        const stat = lstatSync(filePath)
        return [
          relativePath,
          stat.isSymbolicLink()
            ? `symlink:${readlinkSync(filePath)}`
            : sha256File(filePath),
        ]
      })
      .sort(([left], [right]) => left.localeCompare(right)),
  )
}

export function compareCandidates(leftTarball, rightTarball) {
  const tempDir = mkdtempSync(
    path.join(os.tmpdir(), 'fsusui-candidate-compare-'),
  )
  try {
    const leftRoot = extractCandidate(leftTarball, path.join(tempDir, 'left'))
    const rightRoot = extractCandidate(
      rightTarball,
      path.join(tempDir, 'right'),
    )
    const leftTree = canonicalTree(leftRoot)
    const rightTree = canonicalTree(rightRoot)
    if (canonicalJson(leftTree) !== canonicalJson(rightTree)) {
      const paths = new Set([
        ...Object.keys(leftTree),
        ...Object.keys(rightTree),
      ])
      const differences = [...paths].filter(
        (relativePath) => leftTree[relativePath] !== rightTree[relativePath],
      )
      throw new Error(
        `Candidate canonical contents differ: ${differences.slice(0, 20).join(', ')}`,
      )
    }
    return {
      byteIdentical: sha256File(leftTarball) === sha256File(rightTarball),
      canonicalDigest: canonicalJsonDigest(leftTree),
      files: Object.keys(leftTree).length,
      ignoredFields: canonicalIgnoredFields,
    }
  } finally {
    rmSync(tempDir, { force: true, recursive: true })
  }
}

export function copyCandidate(candidateDir, destinationDir) {
  mkdirSync(destinationDir, { recursive: true })
  for (const filename of [
    candidateTarballName,
    candidateChecksumName,
    candidateManifestName,
  ]) {
    cpSync(
      path.join(candidateDir, filename),
      path.join(destinationDir, filename),
    )
  }
}

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const option = (name, fallback) => {
  const index = process.argv.indexOf(name)
  return index === -1 ? fallback : process.argv[index + 1]
}
const evidenceRoot = path.resolve(option('--root', '.dotnet-evidence'))
const expectedPlatforms = ['linux', 'windows', 'macos']
const manifests = expectedPlatforms.map((platform) => {
  const file = path.join(evidenceRoot, 'platform', platform, 'manifest.json')
  if (!fs.existsSync(file))
    throw new Error(`Missing ${platform} platform manifest: ${file}`)
  return JSON.parse(fs.readFileSync(file, 'utf8'))
})
if (new Set(manifests.map(({ platform }) => platform)).size !== 3) {
  throw new Error(
    'Platform manifests must cover Linux, Windows, and macOS without duplicates.',
  )
}
for (const platform of expectedPlatforms) {
  if (!manifests.some((manifest) => manifest.platform === platform))
    throw new Error(`Platform manifest set is missing ${platform}.`)
}
const commits = new Set(manifests.map(({ commitSha }) => commitSha))
if (commits.size !== 1)
  throw new Error('Platform manifests do not describe the same commit.')
for (const manifest of manifests) {
  if (
    manifest.smoke?.status !== 'passed' ||
    manifest.testSummary?.failed !== 0 ||
    manifest.testSummary?.errors !== 0
  ) {
    throw new Error(`${manifest.platform} platform verification did not pass.`)
  }
}

const packageManifestPath = path.join(
  evidenceRoot,
  'package',
  'package',
  'manifest.json',
)
if (!fs.existsSync(packageManifestPath))
  throw new Error(`Missing package manifest: ${packageManifestPath}`)
const packageManifest = JSON.parse(fs.readFileSync(packageManifestPath, 'utf8'))
if (packageManifest.commitSha !== [...commits][0])
  throw new Error(
    'Package and platform manifests do not describe the same commit.',
  )
if (
  packageManifest.contractV2Alignment?.candidate !== packageManifest.commitSha ||
  !/^[0-9a-f]{64}$/u.test(
    packageManifest.contractV2Alignment?.contractHash ?? '',
  ) ||
  !/^[0-9a-f]{64}$/u.test(
    packageManifest.contractV2Alignment?.alignmentHash ?? '',
  ) ||
  !Array.isArray(packageManifest.contractV2Alignment?.stableContractIds) ||
  !Number.isInteger(packageManifest.contractV2Alignment?.governedGapCount)
) {
  throw new Error('Package manifest Contract V2 alignment binding is invalid.')
}
const packageRoot = path.join(evidenceRoot, 'package', 'nuget')
const aggregate = createHash('sha256')
for (const candidate of packageManifest.packages) {
  const file = path.join(packageRoot, candidate.file)
  if (!fs.existsSync(file))
    throw new Error(`Package candidate file is missing: ${candidate.file}`)
  const digest = createHash('sha256')
    .update(fs.readFileSync(file))
    .digest('hex')
  if (digest !== candidate.sha256)
    throw new Error(`Package digest mismatch: ${candidate.file}`)
  aggregate.update(`${candidate.file}\0${digest}\n`)
}
if (aggregate.digest('hex') !== packageManifest.candidateSha256)
  throw new Error('Unique NuGet candidate digest does not match its files.')
console.log(
  `[dotnet-manifests] platforms=3 candidate-sha256=${packageManifest.candidateSha256}`,
)

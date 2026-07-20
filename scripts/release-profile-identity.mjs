import fs from 'node:fs'
import path from 'node:path'

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'))

export function verifyReleaseIdentity({
  repoRoot,
  candidateManifestPath,
  releaseTag,
  commitSha,
}) {
  if (!candidateManifestPath)
    throw new Error('Release profile requires --candidate-manifest.')
  if (!releaseTag) throw new Error('Release profile requires --release-tag.')
  if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(releaseTag))
    throw new Error(`Release tag is invalid: ${releaseTag}.`)
  const manifest = readJson(path.resolve(candidateManifestPath))
  const sourcePackage = readJson(
    path.resolve(repoRoot, 'vue/packages/element-plus/package.json'),
  )
  const expectedPackageName =
    process.env.NPM_PACKAGE_NAME || '@ozwasyd/element-plus'
  const tagVersion = releaseTag.slice(1)
  const candidateDigest = manifest.artifact?.sha256
  if (manifest.commitSha !== commitSha)
    throw new Error(
      'Release candidate commit SHA does not match the workflow SHA.',
    )
  if (
    manifest.sourceProfile !== 'Release' ||
    manifest.package?.name !== expectedPackageName ||
    manifest.package?.version !== tagVersion ||
    sourcePackage.version !== tagVersion ||
    !/^[a-f0-9]{64}$/u.test(candidateDigest ?? '')
  )
    throw new Error(
      'Release tag, candidate version, source package version, or source profile does not match.',
    )
  return {
    commitSha,
    tag: releaseTag,
    package: manifest.package.name,
    packageVersion: tagVersion,
    candidateSha256: candidateDigest,
  }
}

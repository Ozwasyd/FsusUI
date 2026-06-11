import { pathToFileURL } from 'node:url'

const versionPattern = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/u

export function resolveNpmDistTag(version) {
  const normalizedVersion = version.trim()
  const match = normalizedVersion.match(versionPattern)

  if (!match) {
    throw new Error(
      `Invalid npm package version "${version}". Expected X.Y.Z or X.Y.Z-prerelease.`,
    )
  }

  const prerelease = match[4]
  if (!prerelease) {
    return 'latest'
  }

  const [channel] = prerelease.split('.')
  if (channel === 'preview') {
    return 'preview'
  }

  if (['alpha', 'beta', 'rc', 'next'].includes(channel)) {
    return 'next'
  }

  throw new Error(
    `Unsupported npm prerelease channel "${channel}" in ${normalizedVersion}. Allowed channels are preview, alpha, beta, rc, and next.`,
  )
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const version = process.argv[2]

  if (!version) {
    throw new Error('Usage: node scripts/resolve-npm-dist-tag.mjs <version>')
  }

  console.log(resolveNpmDistTag(version))
}

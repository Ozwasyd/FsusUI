import { execFileSync } from 'node:child_process'

export const registryUrl = 'https://npm.pkg.github.com'

export function sanitizePackagePart(value) {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (!sanitized) {
    throw new Error(
      `Unable to derive an npm-safe package segment from "${value}".`,
    )
  }

  return sanitized
}

export function parseRepositoryFromRemote(remoteUrl) {
  const normalized = remoteUrl
    .trim()
    .replace(/^git\+/, '')
    .replace(/\.git$/, '')

  const sshMatch = normalized.match(/^git@([^:]+):([^/]+)\/(.+)$/)
  if (sshMatch) {
    return {
      serverUrl: `https://${sshMatch[1]}`,
      owner: sshMatch[2],
      repo: sshMatch[3],
    }
  }

  const sshProtocolMatch = normalized.match(
    /^ssh:\/\/git@([^/]+)\/([^/]+)\/(.+)$/,
  )
  if (sshProtocolMatch) {
    return {
      serverUrl: `https://${sshProtocolMatch[1]}`,
      owner: sshProtocolMatch[2],
      repo: sshProtocolMatch[3],
    }
  }

  const httpsMatch = normalized.match(/^https?:\/\/([^/]+)\/([^/]+)\/(.+)$/)
  if (httpsMatch) {
    return {
      serverUrl: `https://${httpsMatch[1]}`,
      owner: httpsMatch[2],
      repo: httpsMatch[3],
    }
  }

  throw new Error(`Unsupported git remote URL: ${remoteUrl}`)
}

export function getPackageBaseName(packageName) {
  const normalizedName = packageName.trim()

  if (normalizedName.startsWith('@')) {
    const [, baseName] = normalizedName.split('/')
    if (!baseName) {
      throw new Error(`Invalid scoped package name: ${packageName}`)
    }

    return baseName
  }

  return normalizedName
}

export function resolveRepositoryContext(repoRoot) {
  const envRepo = process.env.GITHUB_REPOSITORY
  if (envRepo) {
    const [owner, repo] = envRepo.split('/')
    if (!owner || !repo) {
      throw new Error(`Invalid GITHUB_REPOSITORY value: ${envRepo}`)
    }

    return {
      serverUrl: (
        process.env.GITHUB_SERVER_URL || 'https://github.com'
      ).replace(/\/$/, ''),
      owner,
      repo,
    }
  }

  const remoteUrl = execFileSync('git', ['remote', 'get-url', 'origin'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })

  return parseRepositoryFromRemote(remoteUrl)
}

export function resolvePackageName(owner, defaultBaseName) {
  const configuredName = process.env.GITHUB_PACKAGE_NAME?.trim()
  if (configuredName) {
    return configuredName
  }

  const scope = sanitizePackagePart(process.env.GITHUB_PACKAGE_SCOPE || owner)
  const packageBaseName = sanitizePackagePart(
    process.env.GITHUB_PACKAGE_BASENAME || defaultBaseName,
  )

  return `@${scope}/${packageBaseName}`
}

export function validateScopedPackageName(packageName) {
  if (!/^@[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/.test(packageName)) {
    throw new Error(
      `GitHub Packages requires a lowercase scoped package name, got: ${packageName}`,
    )
  }
}

export function resolvePackageContract({ repoRoot, sourcePackageName }) {
  const repository = resolveRepositoryContext(repoRoot)
  const packageName = resolvePackageName(
    repository.owner,
    getPackageBaseName(sourcePackageName),
  )

  validateScopedPackageName(packageName)

  const scope = packageName.slice(1).split('/')[0]
  const repositoryWebUrl = `${repository.serverUrl}/${repository.owner}/${repository.repo}`
  const repositoryGitUrl = `${repositoryWebUrl}.git`

  return {
    packageName,
    repository,
    repositoryGitUrl,
    repositoryWebUrl,
    scope,
  }
}

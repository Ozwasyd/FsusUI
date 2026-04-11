import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const registryUrl = 'https://npm.pkg.github.com'
const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const distRoot = path.join(repoRoot, 'dist', 'element-plus')
const distPackagePath = path.join(distRoot, 'package.json')
const distNpmrcPath = path.join(distRoot, '.npmrc')
const sourcePackagePath = path.join(
  repoRoot,
  'packages',
  'element-plus',
  'package.json'
)

if (!existsSync(distPackagePath)) {
  throw new Error(
    'Missing dist/element-plus/package.json. Run the build before preparing the GitHub Packages artifact.'
  )
}

function sanitizePackagePart(value) {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (!sanitized) {
    throw new Error(`Unable to derive an npm-safe package segment from "${value}".`)
  }

  return sanitized
}

function parseRepositoryFromRemote(remoteUrl) {
  const normalized = remoteUrl.trim().replace(/^git\+/, '').replace(/\.git$/, '')

  const sshMatch = normalized.match(/^git@([^:]+):([^/]+)\/(.+)$/)
  if (sshMatch) {
    return {
      serverUrl: `https://${sshMatch[1]}`,
      owner: sshMatch[2],
      repo: sshMatch[3],
    }
  }

  const sshProtocolMatch = normalized.match(/^ssh:\/\/git@([^/]+)\/([^/]+)\/(.+)$/)
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

function getPackageBaseName(packageName) {
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

function assertPublicInterfaceMatches(sourcePackageJson, distPackageJson) {
  const publicInterfaceFields = [
    'main',
    'module',
    'types',
    'exports',
    'unpkg',
    'jsdelivr',
    'style',
    'sideEffects',
    'peerDependencies',
    'dependencies',
    'vetur',
    'web-types',
    'browserslist',
  ]

  const mismatchedFields = publicInterfaceFields.filter((field) => {
    return JSON.stringify(sourcePackageJson[field]) !== JSON.stringify(distPackageJson[field])
  })

  if (mismatchedFields.length > 0) {
    throw new Error(
      `The built package does not expose the same public interface as element-plus. Mismatched fields: ${mismatchedFields.join(', ')}`
    )
  }
}

function resolveRepositoryContext() {
  const envRepo = process.env.GITHUB_REPOSITORY
  if (envRepo) {
    const [owner, repo] = envRepo.split('/')
    if (!owner || !repo) {
      throw new Error(`Invalid GITHUB_REPOSITORY value: ${envRepo}`)
    }

    return {
      serverUrl: (process.env.GITHUB_SERVER_URL || 'https://github.com').replace(/\/$/, ''),
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

function resolvePackageName(owner, defaultBaseName) {
  const configuredName = process.env.GITHUB_PACKAGE_NAME?.trim()
  if (configuredName) {
    return configuredName
  }

  const scope = sanitizePackagePart(process.env.GITHUB_PACKAGE_SCOPE || owner)
  const packageBaseName = sanitizePackagePart(
    process.env.GITHUB_PACKAGE_BASENAME || defaultBaseName
  )

  return `@${scope}/${packageBaseName}`
}

function validateScopedPackageName(packageName) {
  if (!/^@[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/.test(packageName)) {
    throw new Error(
      `GitHub Packages requires a lowercase scoped package name, got: ${packageName}`
    )
  }
}

const repository = resolveRepositoryContext()
const sourcePackageJson = JSON.parse(readFileSync(sourcePackagePath, 'utf8'))
const defaultPackageBaseName = getPackageBaseName(sourcePackageJson.name)
const packageName = resolvePackageName(repository.owner, defaultPackageBaseName)
validateScopedPackageName(packageName)

const scope = packageName.slice(1).split('/')[0]
const repositoryWebUrl = `${repository.serverUrl}/${repository.owner}/${repository.repo}`
const repositoryGitUrl = `${repositoryWebUrl}.git`
const packageJson = JSON.parse(readFileSync(distPackagePath, 'utf8'))

assertPublicInterfaceMatches(sourcePackageJson, packageJson)

packageJson.name = packageName
packageJson.repository = {
  type: 'git',
  url: `git+${repositoryGitUrl}`,
}
packageJson.homepage = repositoryWebUrl
packageJson.bugs = {
  url: `${repositoryWebUrl}/issues`,
}
packageJson.publishConfig = {
  registry: registryUrl,
}

writeFileSync(distPackagePath, `${JSON.stringify(packageJson, null, 2)}\n`)
writeFileSync(distNpmrcPath, `@${scope}:registry=${registryUrl}\n`)

console.log(
  `Prepared ${packageJson.name}@${packageJson.version} for GitHub Packages from ${repository.owner}/${repository.repo}.`
)
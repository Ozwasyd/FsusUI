import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  registryUrl,
  resolvePackageContract,
} from './github-package-contract.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const distRoot = path.join(repoRoot, 'dist', 'element-plus')
const distPackagePath = path.join(distRoot, 'package.json')
const distNpmrcPath = path.join(distRoot, '.npmrc')
const sourcePackagePath = path.join(
  repoRoot,
  'packages',
  'element-plus',
  'package.json',
)
const workspaceRoots = ['packages', 'internal']
const collectOnly = process.argv.includes('--collect')
const strict = process.argv.includes('--strict') || !collectOnly
const installDependencyFields = [
  'dependencies',
  'peerDependencies',
  'optionalDependencies',
]
const wasmRuntimeArtifacts = [
  'dist/ep_wasm.wasm',
  'es/wasm/ep_wasm.mjs',
  'es/wasm/dist/ep_wasm.mjs',
  'es/wasm/dist/ep_wasm.wasm',
  'lib/wasm/ep_wasm.mjs',
  'lib/wasm/dist/ep_wasm.mjs',
  'lib/wasm/dist/ep_wasm.wasm',
  'dist/markdown_basic.js',
  'dist/markdown_basic.wasm',
  'dist/markdown_simd.js',
  'dist/markdown_simd.wasm',
  'es/wasm/dist/markdown_basic.js',
  'es/wasm/dist/markdown_basic.wasm',
  'es/wasm/dist/markdown_simd.js',
  'es/wasm/dist/markdown_simd.wasm',
  'lib/wasm/dist/markdown_basic.js',
  'lib/wasm/dist/markdown_basic.wasm',
  'lib/wasm/dist/markdown_simd.js',
  'lib/wasm/dist/markdown_simd.wasm',
]
const selfReferenceFileExtensions = [
  '.d.ts',
  '.d.mts',
  '.d.cts',
  '.js',
  '.mjs',
  '.cjs',
]
const rawSourceExtensions = new Set([
  '.c',
  '.cc',
  '.cpp',
  '.h',
  '.hpp',
  '.rs',
  '.ts',
  '.tsx',
  '.vue',
])
const secretFilePatterns = [
  /^\.env(?:\.|$)/u,
  /^\.npmrc(?:\.|$)/u,
  /^id_(?:rsa|ed25519)(?:\.|$)/u,
  /\.(?:key|pem|p12|pfx|crt|csr)$/iu,
]
const secretContentPatterns = [
  /(?:gho|ghp|github_pat)_[A-Za-z0-9_]+/u,
  /_authToken\s*=\s*(?!\$\{)[^\s]+/u,
  /BEGIN [A-Z ]*PRIVATE KEY/u,
]
const secretScanExtensions = new Set([
  '',
  '.cjs',
  '.css',
  '.d.ts',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.scss',
  '.txt',
  '.ts',
  '.yaml',
  '.yml',
])

if (!existsSync(distPackagePath)) {
  throw new Error(
    'Missing dist/element-plus/package.json. Run the build before preparing the GitHub Packages artifact.',
  )
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
    return (
      JSON.stringify(sourcePackageJson[field]) !==
      JSON.stringify(distPackageJson[field])
    )
  })

  if (mismatchedFields.length > 0) {
    throw new Error(
      `The built package does not expose the same public interface as element-plus. Mismatched fields: ${mismatchedFields.join(', ')}`,
    )
  }
}

function collectUnexpectedBuildArtifacts(rootDir, currentDir = rootDir) {
  const unexpected = []
  const entries = readdirSync(currentDir, { withFileTypes: true })

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name)
    const relativePath = path.relative(rootDir, absolutePath)

    if (entry.isDirectory()) {
      if (
        relativePath === 'es/node_modules' ||
        relativePath === 'lib/node_modules'
      ) {
        unexpected.push(relativePath)
        continue
      }

      unexpected.push(...collectUnexpectedBuildArtifacts(rootDir, absolutePath))
      continue
    }

    if (
      /^build\.config\.[^.]+$/u.test(entry.name) ||
      /^vite\.config\.[^.]+$/u.test(entry.name) ||
      entry.name === 'gulpfile.ts' ||
      entry.name === 'gulpfile.js' ||
      entry.name === 'gulpfile.mjs' ||
      entry.name === 'gulpfile.cjs'
    ) {
      unexpected.push(relativePath)
    }
  }

  return unexpected
}

function assertDistArtifactShape(rootDir) {
  const unexpectedArtifacts = collectUnexpectedBuildArtifacts(rootDir)

  if (unexpectedArtifacts.length > 0) {
    throw new Error(
      `Unexpected build-time artifacts found in dist/element-plus: ${unexpectedArtifacts.join(', ')}`,
    )
  }
}

function collectPublishFiles(rootDir, currentDir = rootDir) {
  const files = []
  const entries = readdirSync(currentDir, { withFileTypes: true })

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name)

    if (entry.isDirectory()) {
      files.push(...collectPublishFiles(rootDir, absolutePath))
      continue
    }

    files.push(absolutePath)
  }

  return files
}

function stripSourceMappingUrlReferences(rootDir) {
  const candidates = collectPublishFiles(rootDir).filter((filePath) => {
    return ['.css', '.js', '.mjs', '.cjs'].includes(path.extname(filePath))
  })

  for (const filePath of candidates) {
    const original = readFileSync(filePath, 'utf8')
    const stripped = original
      .replace(/\n?\/\/# sourceMappingURL=.*$/gmu, '')
      .replace(/\n?\/\*# sourceMappingURL=.*?\*\/\s*$/gmu, '')

    if (stripped !== original) {
      writeFileSync(filePath, stripped)
    }
  }
}

function pruneSourceMaps(rootDir) {
  const maps = collectPublishFiles(rootDir).filter((filePath) =>
    filePath.endsWith('.map'),
  )

  for (const filePath of maps) {
    unlinkSync(filePath)
  }

  return maps.length
}

function rewriteWorkerRuntimeReferences(rootDir) {
  const candidates = collectPublishFiles(rootDir).filter((filePath) => {
    return ['.js', '.mjs', '.cjs'].includes(path.extname(filePath))
  })
  let rewritten = 0

  for (const filePath of candidates) {
    const extension = path.extname(filePath)
    const workerExtension = extension === '.mjs' ? '.mjs' : '.js'
    const original = readFileSync(filePath, 'utf8')
    const next = original.replace(
      /(\.\/markdown-renderer\.worker)\.ts/g,
      `$1${workerExtension}`,
    )

    if (next !== original) {
      writeFileSync(filePath, next)
      rewritten += 1
    }
  }

  return rewritten
}

function assertNoSecretsOrRawSources(rootDir) {
  const violations = []

  for (const filePath of collectPublishFiles(rootDir)) {
    const relativePath = path.relative(rootDir, filePath)
    const basename = path.basename(filePath)
    const extension = path.extname(filePath)
    const stat = statSync(filePath)

    if (relativePath === '.npmrc') {
      const npmrc = readFileSync(filePath, 'utf8')
      if (secretContentPatterns.some((pattern) => pattern.test(npmrc))) {
        violations.push(`${relativePath}: contains a publish token`)
      }
      continue
    }

    if (secretScanExtensions.has(extension) && stat.size <= 2_000_000) {
      const content = readFileSync(filePath, 'utf8')
      if (secretContentPatterns.some((pattern) => pattern.test(content))) {
        violations.push(`${relativePath}: secret-like content`)
        continue
      }
    }

    if (secretFilePatterns.some((pattern) => pattern.test(basename))) {
      violations.push(`${relativePath}: secret-like filename`)
      continue
    }

    if (
      relativePath.includes('__tests__/') ||
      /(?:^|\/)tests?\//u.test(relativePath)
    ) {
      violations.push(`${relativePath}: test artifact`)
      continue
    }

    if (
      /\.(?:test|spec)\.[cm]?[jt]sx?$/iu.test(basename) ||
      /\.(?:test|spec)\.vue$/iu.test(basename)
    ) {
      violations.push(`${relativePath}: test source artifact`)
      continue
    }

    const declarationFile =
      basename.endsWith('.d.ts') ||
      basename.endsWith('.d.mts') ||
      basename.endsWith('.d.cts')
    if (rawSourceExtensions.has(extension) && !declarationFile) {
      violations.push(`${relativePath}: raw source extension`)
      continue
    }

    if (extension === '.map') {
      violations.push(`${relativePath}: source map`)
      continue
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `Publish artifact contains secrets or source-only files:\n${violations.join('\n')}`,
    )
  }
}

function assertWasmRuntimeArtifacts(rootDir) {
  const missing = []
  const empty = []

  for (const artifact of wasmRuntimeArtifacts) {
    const artifactPath = path.join(rootDir, artifact)
    if (!existsSync(artifactPath)) {
      missing.push(artifact)
      continue
    }

    if (statSync(artifactPath).size === 0) {
      empty.push(artifact)
    }
  }

  if (missing.length > 0 || empty.length > 0) {
    const details = []
    if (missing.length > 0) {
      details.push(`missing: ${missing.join(', ')}`)
    }
    if (empty.length > 0) {
      details.push(`empty: ${empty.join(', ')}`)
    }
    throw new Error(
      `WASM runtime artifacts are incomplete in dist/element-plus (${details.join('; ')}).`,
    )
  }
}

function isSelfReferenceCandidate(filePath) {
  return selfReferenceFileExtensions.some((extension) => {
    return filePath.endsWith(extension)
  })
}

function collectSelfReferenceCandidates(rootDir, currentDir = rootDir) {
  const files = []
  const entries = readdirSync(currentDir, { withFileTypes: true })

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name)

    if (entry.isDirectory()) {
      files.push(...collectSelfReferenceCandidates(rootDir, absolutePath))
      continue
    }

    if (isSelfReferenceCandidate(absolutePath)) {
      files.push(absolutePath)
    }
  }

  return files
}

function rewritePublishedSelfReferences(rootDir, packageName) {
  const candidates = collectSelfReferenceCandidates(rootDir)
  const patterns = [
    /(\bfrom\s+['"])element-plus(?=(?:\/[^'"]*)?['"])/g,
    /(\bimport\s*\(\s*['"])element-plus(?=(?:\/[^'"]*)?['"])/g,
    /(\brequire\s*\(\s*['"])element-plus(?=(?:\/[^'"]*)?['"])/g,
    /(\bimport\s+['"])element-plus(?=(?:\/[^'"]*)?['"])/g,
  ]

  let updatedFiles = 0
  let replacementCount = 0

  for (const filePath of candidates) {
    const original = readFileSync(filePath, 'utf8')
    let rewritten = original

    for (const pattern of patterns) {
      rewritten = rewritten.replace(pattern, (_, prefix) => {
        replacementCount += 1
        return `${prefix}${packageName}`
      })
    }

    if (rewritten !== original) {
      writeFileSync(filePath, rewritten)
      updatedFiles += 1
    }
  }

  return { updatedFiles, replacementCount }
}

function collectWorkspaceVersions() {
  const versions = new Map()

  for (const workspaceRoot of workspaceRoots) {
    const rootPath = path.join(repoRoot, workspaceRoot)
    if (!existsSync(rootPath)) continue

    const entries = readdirSync(rootPath, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const manifestPath = path.join(rootPath, entry.name, 'package.json')
      if (!existsSync(manifestPath)) continue

      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
      if (manifest.name && manifest.version) {
        versions.set(manifest.name, manifest.version)
      }
    }
  }

  return versions
}

function normalizeWorkspaceSpecifier(
  specifier,
  packageName,
  workspaceVersions,
) {
  if (typeof specifier !== 'string' || !specifier.startsWith('workspace:')) {
    return specifier
  }

  const resolvedVersion = workspaceVersions.get(packageName)
  if (!resolvedVersion) {
    throw new Error(
      `Unable to resolve workspace version for dependency "${packageName}" with specifier "${specifier}".`,
    )
  }

  const workspaceRange = specifier.slice('workspace:'.length).trim()
  if (workspaceRange === '*' || workspaceRange === '') {
    return resolvedVersion
  }

  if (workspaceRange === '^') {
    return `^${resolvedVersion}`
  }

  if (workspaceRange === '~') {
    return `~${resolvedVersion}`
  }

  if (workspaceRange.startsWith('^')) {
    return `^${resolvedVersion}`
  }

  if (workspaceRange.startsWith('~')) {
    return `~${resolvedVersion}`
  }

  return workspaceRange
}

function normalizeWorkspaceProtocols(packageJson, workspaceVersions) {
  for (const field of installDependencyFields) {
    const dependencies = packageJson[field]
    if (!dependencies) continue

    for (const [dependencyName, specifier] of Object.entries(dependencies)) {
      dependencies[dependencyName] = normalizeWorkspaceSpecifier(
        specifier,
        dependencyName,
        workspaceVersions,
      )
    }
  }
}

function assertNoWorkspaceProtocolsRemain(packageJson) {
  const remaining = []

  for (const field of installDependencyFields) {
    const dependencies = packageJson[field]
    if (!dependencies) continue

    for (const [dependencyName, specifier] of Object.entries(dependencies)) {
      if (typeof specifier === 'string' && specifier.startsWith('workspace:')) {
        remaining.push(`${field}.${dependencyName}=${specifier}`)
      }
    }
  }

  if (remaining.length > 0) {
    throw new Error(
      `Workspace protocols remain in published manifest: ${remaining.join(', ')}`,
    )
  }
}

const sourcePackageJson = JSON.parse(readFileSync(sourcePackagePath, 'utf8'))
const { packageName, repository, repositoryGitUrl, repositoryWebUrl, scope } =
  resolvePackageContract({
    repoRoot,
    sourcePackageName: sourcePackageJson.name,
  })
const packageJson = JSON.parse(readFileSync(distPackagePath, 'utf8'))
const workspaceVersions = collectWorkspaceVersions()
let prunedSourceMaps = 0
let rewrittenWorkerReferences = 0

if (strict) {
  assertPublicInterfaceMatches(sourcePackageJson, packageJson)
  assertDistArtifactShape(distRoot)
  assertWasmRuntimeArtifacts(distRoot)
  stripSourceMappingUrlReferences(distRoot)
  prunedSourceMaps = pruneSourceMaps(distRoot)
  rewrittenWorkerReferences = rewriteWorkerRuntimeReferences(distRoot)
}

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

normalizeWorkspaceProtocols(packageJson, workspaceVersions)
assertNoWorkspaceProtocolsRemain(packageJson)
const rewrittenSelfReferences = rewritePublishedSelfReferences(
  distRoot,
  packageName,
)

writeFileSync(distPackagePath, `${JSON.stringify(packageJson, null, 2)}\n`)
writeFileSync(distNpmrcPath, `@${scope}:registry=${registryUrl}\n`)

if (strict) {
  assertNoSecretsOrRawSources(distRoot)
}

console.log(
  `Prepared ${packageJson.name}@${packageJson.version} for GitHub Packages from ${repository.owner}/${repository.repo} with ${rewrittenSelfReferences.replacementCount} self-reference rewrites across ${rewrittenSelfReferences.updatedFiles} files, ${rewrittenWorkerReferences} worker references rewritten, and ${prunedSourceMaps} source maps pruned.`,
)

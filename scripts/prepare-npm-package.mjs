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
import { registryUrl, resolvePackageContract } from './npm-package-contract.mjs'
import {
  loadAuthority,
  applyPublishedExternalFields,
} from './npm-authority-lib.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const distRoot = path.join(repoRoot, 'dist', 'element-plus')
const distPackagePath = path.join(distRoot, 'package.json')
const distNpmrcPath = path.join(distRoot, '.npmrc')
const sourcePackagePath = path.join(
  repoRoot,
  'vue',
  'packages',
  'element-plus',
  'package.json',
)
const workspaceRoots = ['vue/packages', 'vue/internal']
const collectOnly = process.argv.includes('--collect')
const strict = process.argv.includes('--strict') || !collectOnly
const installDependencyFields = [
  'dependencies',
  'peerDependencies',
  'optionalDependencies',
]
const bundledWorkspaceDependencyNames = new Set(['@element-plus/motion'])
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
    'Missing dist/element-plus/package.json. Run the build before preparing the npm package artifact.',
  )
}

function assertPublicInterfaceMatches(
  sourcePackageJson,
  distPackageJson,
  workspaceVersions,
) {
  const normalizedSourcePackageJson = normalizePublicInterfacePackageJson(
    sourcePackageJson,
    workspaceVersions,
  )
  const normalizedDistPackageJson = normalizePublicInterfacePackageJson(
    distPackageJson,
    workspaceVersions,
  )
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
      JSON.stringify(normalizedSourcePackageJson[field]) !==
      JSON.stringify(normalizedDistPackageJson[field])
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
  const workerRuntimePaths = new Map([
    [
      'data-pipeline.worker',
      'es/components/_internal/data-pipeline.worker.mjs',
    ],
    [
      'markdown-renderer.worker',
      'es/components/markdown-renderer/src/markdown-renderer.worker.mjs',
    ],
    [
      'markdown-parser.worker',
      'es/components/markdown-renderer/src/markdown-parser.worker.mjs',
    ],
  ])
  const workerReferencePattern =
    /(['"])(?:[^'"]*\/)?(data-pipeline\.worker|markdown-renderer\.worker|markdown-parser\.worker)\.(?:ts|js|mjs)\1/g
  let rewritten = 0

  for (const filePath of candidates) {
    const original = readFileSync(filePath, 'utf8')
    const next = original.replace(
      workerReferencePattern,
      (_match, quote, workerName) => {
        const targetPath = workerRuntimePaths.get(workerName)
        if (!targetPath) return _match

        const relativePath = path
          .relative(path.dirname(filePath), path.join(rootDir, targetPath))
          .split(path.sep)
          .join('/')
        const specifier = relativePath.startsWith('.')
          ? relativePath
          : `./${relativePath}`
        rewritten += 1
        return `${quote}${specifier}${quote}`
      },
    )

    if (next !== original) {
      writeFileSync(filePath, next)
    }
  }

  return rewritten
}

function assertViteSafeWorkerRuntime(rootDir) {
  const violations = []
  const workerReferencePattern =
    /(['"])([^'"]*(?:data-pipeline\.worker|markdown-renderer\.worker|markdown-parser\.worker)\.(?:ts|js|mjs))\1/g

  for (const filePath of collectPublishFiles(rootDir)) {
    if (!['.js', '.mjs', '.cjs'].includes(path.extname(filePath))) continue

    const relativePath = path.relative(rootDir, filePath)
    const content = readFileSync(filePath, 'utf8')

    for (const match of content.matchAll(workerReferencePattern)) {
      const workerSpecifier = match[2]
      if (workerSpecifier.endsWith('.ts')) {
        violations.push(
          `${relativePath}: contains raw worker source reference ${workerSpecifier}`,
        )
        continue
      }

      const workerPath = path.resolve(path.dirname(filePath), workerSpecifier)
      if (!existsSync(workerPath)) {
        violations.push(
          `${relativePath}: worker runtime target does not exist: ${workerSpecifier}`,
        )
      }
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `Worker runtime is not Vite-safe for consumers:\n${violations.join('\n')}`,
    )
  }
}

function rewriteEmscriptenWasmFallbackReferences(rootDir) {
  const candidates = collectPublishFiles(rootDir).filter((filePath) => {
    return ['.js', '.mjs', '.cjs'].includes(path.extname(filePath))
  })
  const wasmFallbackPattern =
    /new URL\((['"])(ep_wasm|markdown_basic|markdown_simd)\.wasm\1,\s*import\.meta\.url\)/g
  let rewritten = 0

  for (const filePath of candidates) {
    const original = readFileSync(filePath, 'utf8')
    const next = original.replace(
      wasmFallbackPattern,
      'new URL(/* @vite-ignore */ $1$2.wasm$1, import.meta.url)',
    )

    if (next !== original) {
      writeFileSync(filePath, next)
      rewritten += 1
    }
  }

  return rewritten
}

function assertViteSafeWasmRuntime(rootDir) {
  const violations = []
  const dynamicMarkdownResolverPatterns = [
    /new URL\(`[^`]*\$\{/u,
    /\$\{prefix\}\$\{fileName\}/u,
    /\bresolveMarkdownRuntimeUrl\b/u,
    /\bisPackagedDistRuntime\b/u,
  ]
  const unhandledWasmFallbackPattern =
    /new URL\(\s*['"](?:ep_wasm|markdown_basic|markdown_simd)\.wasm['"]\s*,\s*import\.meta\.url\)/u

  for (const filePath of collectPublishFiles(rootDir)) {
    if (!['.js', '.mjs', '.cjs'].includes(path.extname(filePath))) continue

    const relativePath = path.relative(rootDir, filePath)
    const content = readFileSync(filePath, 'utf8')

    if (
      dynamicMarkdownResolverPatterns.some((pattern) => pattern.test(content))
    ) {
      violations.push(
        `${relativePath}: contains a dynamic Markdown WASM asset resolver`,
      )
    }

    if (unhandledWasmFallbackPattern.test(content)) {
      violations.push(
        `${relativePath}: contains an unhandled Emscripten WASM fallback URL`,
      )
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `WASM runtime is not Vite-safe for consumers:\n${violations.join('\n')}`,
    )
  }
}

function assertNoSecretsOrRawSources(rootDir) {
  const violations = []

  for (const filePath of collectPublishFiles(rootDir)) {
    const relativePath = path.relative(rootDir, filePath)
    const basename = path.basename(filePath)
    const extension = path.extname(filePath)
    const stat = statSync(filePath)

    if (relativePath === '.npmrc') {
      violations.push(
        `${relativePath}: npm registry config must not be published`,
      )
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
    if (!existsSync(filePath)) continue

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

function removeBundledWorkspaceDependencies(packageJson) {
  let removed = 0

  for (const field of installDependencyFields) {
    const dependencies = packageJson[field]
    if (!dependencies) continue

    for (const dependencyName of bundledWorkspaceDependencyNames) {
      if (Object.hasOwn(dependencies, dependencyName)) {
        delete dependencies[dependencyName]
        removed += 1
      }
    }

    if (Object.keys(dependencies).length === 0) {
      delete packageJson[field]
    }
  }

  return removed
}

function normalizePublicInterfacePackageJson(packageJson, workspaceVersions) {
  const normalized = JSON.parse(JSON.stringify(packageJson))
  normalizeWorkspaceProtocols(normalized, workspaceVersions)
  removeBundledWorkspaceDependencies(normalized)
  return normalized
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

function toModuleSpecifier(relativePath) {
  const normalized = relativePath.split(path.sep).join('/')
  return normalized.startsWith('.') ? normalized : `./${normalized}`
}

function resolveBundledWorkspaceRuntimeSpecifier(
  rootDir,
  filePath,
  packageName,
) {
  if (
    filePath.endsWith('.d.ts') ||
    filePath.endsWith('.d.mts') ||
    filePath.endsWith('.d.cts')
  ) {
    return `${packageName}/es/motion`
  }

  const relativePath = path
    .relative(rootDir, filePath)
    .split(path.sep)
    .join('/')
  const extension = path.extname(filePath)

  if (relativePath.startsWith('es/') && extension === '.mjs') {
    return toModuleSpecifier(
      path.relative(
        path.dirname(filePath),
        path.join(rootDir, 'es', 'motion', 'index.mjs'),
      ),
    )
  }

  if (
    relativePath.startsWith('lib/') &&
    (extension === '.js' || extension === '.cjs')
  ) {
    return toModuleSpecifier(
      path.relative(
        path.dirname(filePath),
        path.join(rootDir, 'lib', 'motion', 'index.js'),
      ),
    )
  }

  throw new Error(
    `Unable to rewrite bundled workspace dependency reference in ${relativePath}.`,
  )
}

function rewriteBundledWorkspaceDependencyReferences(rootDir, packageName) {
  const candidates = collectSelfReferenceCandidates(rootDir)
  let updatedFiles = 0
  let replacementCount = 0

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue

    const original = readFileSync(filePath, 'utf8')
    let rewritten = original

    for (const dependencyName of bundledWorkspaceDependencyNames) {
      if (!rewritten.includes(dependencyName)) continue

      const replacement = resolveBundledWorkspaceRuntimeSpecifier(
        rootDir,
        filePath,
        packageName,
      )
      const pattern = new RegExp(
        `(['"])${dependencyName.replace('/', '\\/')}\\1`,
        'g',
      )
      rewritten = rewritten.replace(pattern, (_match, quote) => {
        replacementCount += 1
        return `${quote}${replacement}${quote}`
      })
    }

    if (rewritten !== original) {
      writeFileSync(filePath, rewritten)
      updatedFiles += 1
    }
  }

  return { updatedFiles, replacementCount }
}

function assertNoBundledWorkspaceDependencyReferences(packageJson, rootDir) {
  const manifestLeaks = []

  for (const field of installDependencyFields) {
    const dependencies = packageJson[field]
    if (!dependencies) continue

    for (const dependencyName of bundledWorkspaceDependencyNames) {
      if (Object.hasOwn(dependencies, dependencyName)) {
        manifestLeaks.push(`${field}.${dependencyName}`)
      }
    }
  }

  if (manifestLeaks.length > 0) {
    throw new Error(
      `Bundled workspace dependencies must not remain in published manifest: ${manifestLeaks.join(', ')}`,
    )
  }

  const contentLeaks = []
  for (const filePath of collectSelfReferenceCandidates(rootDir)) {
    const content = readFileSync(filePath, 'utf8')
    for (const dependencyName of bundledWorkspaceDependencyNames) {
      if (content.includes(dependencyName)) {
        contentLeaks.push(path.relative(rootDir, filePath))
      }
    }
  }

  if (contentLeaks.length > 0) {
    throw new Error(
      `Bundled workspace dependency references remain in published files: ${contentLeaks.join(', ')}`,
    )
  }
}

const sourcePackageJson = JSON.parse(readFileSync(sourcePackagePath, 'utf8'))
const { packageName, repository, repositoryGitUrl, repositoryWebUrl } =
  resolvePackageContract({
    repoRoot,
    sourcePackageName: sourcePackageJson.name,
  })
const packageJson = JSON.parse(readFileSync(distPackagePath, 'utf8'))
const workspaceVersions = collectWorkspaceVersions()
let prunedSourceMaps = 0
let rewrittenWorkerReferences = 0
let rewrittenWasmFallbackReferences = 0

if (strict) {
  assertPublicInterfaceMatches(
    sourcePackageJson,
    packageJson,
    workspaceVersions,
  )
  assertDistArtifactShape(distRoot)
  assertWasmRuntimeArtifacts(distRoot)
  stripSourceMappingUrlReferences(distRoot)
  prunedSourceMaps = pruneSourceMaps(distRoot)
  rewrittenWorkerReferences = rewriteWorkerRuntimeReferences(distRoot)
  rewrittenWasmFallbackReferences =
    rewriteEmscriptenWasmFallbackReferences(distRoot)
  assertViteSafeWorkerRuntime(distRoot)
  assertViteSafeWasmRuntime(distRoot)
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
  access: 'public',
  registry: registryUrl,
}

// External dependency versions come only from npm authority projection.
// prepare-npm-package must not invent install/published version strings.
const authority = loadAuthority()
applyPublishedExternalFields(packageJson, authority)
normalizeWorkspaceProtocols(packageJson, workspaceVersions)
const removedBundledWorkspaceDependencies =
  removeBundledWorkspaceDependencies(packageJson)
assertNoWorkspaceProtocolsRemain(packageJson)
const rewrittenSelfReferences = rewritePublishedSelfReferences(
  distRoot,
  packageName,
)
const rewrittenBundledWorkspaceReferences =
  rewriteBundledWorkspaceDependencyReferences(distRoot, packageName)
assertNoBundledWorkspaceDependencyReferences(packageJson, distRoot)

writeFileSync(distPackagePath, `${JSON.stringify(packageJson, null, 2)}\n`)
if (existsSync(distNpmrcPath)) {
  unlinkSync(distNpmrcPath)
}

if (strict) {
  assertNoSecretsOrRawSources(distRoot)
}

console.log(
  `Prepared ${packageJson.name}@${packageJson.version} for npm public registry from ${repository.owner}/${repository.repo} with ${rewrittenSelfReferences.replacementCount} self-reference rewrites across ${rewrittenSelfReferences.updatedFiles} files, ${rewrittenBundledWorkspaceReferences.replacementCount} bundled workspace rewrites across ${rewrittenBundledWorkspaceReferences.updatedFiles} files, ${removedBundledWorkspaceDependencies} bundled workspace dependencies removed, ${rewrittenWorkerReferences} worker references rewritten, ${rewrittenWasmFallbackReferences} WASM fallback references rewritten, and ${prunedSourceMaps} source maps pruned.`,
)

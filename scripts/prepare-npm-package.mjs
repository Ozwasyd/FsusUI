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
import {
  BUNDLED_WORKSPACE_DEPENDENCY_NAMES,
  collectDirectoryFiles,
  collectPackageCodeFiles,
  pruneSourceMaps,
  rewriteBundledWorkspaceReferences,
  rewriteEmscriptenWasmFallbackReferences,
  stripSourceMappingUrlReferences,
} from './lib/package-artifact-rewriter.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const distRoot = path.join(repoRoot, 'dist', 'fsusui')
const distPackagePath = path.join(distRoot, 'package.json')
const distNpmrcPath = path.join(distRoot, '.npmrc')
const sourcePackagePath = path.join(
  repoRoot,
  'vue',
  'packages',
  'fsusui',
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
const unpublishedWorkspaceDependencyNames = BUNDLED_WORKSPACE_DEPENDENCY_NAMES
const wasmRuntimeArtifacts = [
  'dist/wasm/ep_wasm.wasm',
  'dist/wasm/ep_wasm.mjs',
  'dist/wasm/markdown_basic.js',
  'dist/wasm/markdown_basic.wasm',
  'dist/wasm/markdown_simd.js',
  'dist/wasm/markdown_simd.wasm',
  'dist/wasm/markdown-heavy-feature-frame.mjs',
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
    'Missing dist/fsusui/package.json. Run pnpm run build before preparing the npm package artifact.',
  )
}

function collectWorkspaceVersions() {
  const versions = new Map()
  for (const workspaceRoot of workspaceRoots) {
    const rootPath = path.join(repoRoot, workspaceRoot)
    if (!existsSync(rootPath)) continue
    for (const entry of readdirSync(rootPath, { withFileTypes: true })) {
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

function normalizeWorkspaceSpecifier(specifier, packageName, workspaceVersions) {
  if (typeof specifier !== 'string' || !specifier.startsWith('workspace:')) {
    return specifier
  }
  const resolvedVersion = workspaceVersions.get(packageName)
  if (!resolvedVersion) {
    throw new Error(
      `Unable to resolve workspace version for dependency "${packageName}" with specifier "${specifier}".`,
    )
  }
  const range = specifier.slice('workspace:'.length).trim()
  if (range === '*' || range === '') return resolvedVersion
  if (range === '^' || range.startsWith('^')) return `^${resolvedVersion}`
  if (range === '~' || range.startsWith('~')) return `~${resolvedVersion}`
  return range
}

function normalizeWorkspaceProtocols(packageJson, workspaceVersions) {
  for (const field of installDependencyFields) {
    const dependencies = packageJson[field]
    if (!dependencies) continue
    for (const [dep, specifier] of Object.entries(dependencies)) {
      dependencies[dep] = normalizeWorkspaceSpecifier(
        specifier,
        dep,
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
    for (const dep of unpublishedWorkspaceDependencyNames) {
      if (Object.hasOwn(dependencies, dep)) {
        delete dependencies[dep]
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

function assertPublicInterfaceMatches(
  sourcePackageJson,
  distPackageJson,
  workspaceVersions,
) {
  const normalizedSource = normalizePublicInterfacePackageJson(
    sourcePackageJson,
    workspaceVersions,
  )
  const normalizedDist = normalizePublicInterfacePackageJson(
    distPackageJson,
    workspaceVersions,
  )
  const fields = [
    'type',
    'main',
    'module',
    'types',
    'exports',
    'style',
    'sideEffects',
    'peerDependencies',
    'peerDependenciesMeta',
    'dependencies',
  ]
  const mismatched = fields.filter(
    (field) =>
      JSON.stringify(normalizedSource[field]) !==
      JSON.stringify(normalizedDist[field]),
  )
  if (mismatched.length > 0) {
    throw new Error(
      `The built package does not expose the same public interface as @ozwasyd/fsusui. Mismatched fields: ${mismatched.join(', ')}`,
    )
  }
}

function assertNoSecretsOrRawSources(rootDir) {
  const violations = []
  for (const filePath of collectDirectoryFiles(rootDir)) {
    const relativePath = path.relative(rootDir, filePath)
    const basename = path.basename(filePath)
    const extension = path.extname(filePath)
    const stat = statSync(filePath)

    if (relativePath === '.npmrc') {
      violations.push(`${relativePath}: npm registry config must not be published`)
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
      /(?:^|\/)tests?\//u.test(relativePath) ||
      /\.(?:test|spec)\.[cm]?[jt]sx?$/iu.test(basename)
    ) {
      violations.push(`${relativePath}: test artifact`)
      continue
    }
    const isDeclaration =
      basename.endsWith('.d.ts') ||
      basename.endsWith('.d.mts') ||
      basename.endsWith('.d.cts')
    if (rawSourceExtensions.has(extension) && !isDeclaration) {
      violations.push(`${relativePath}: raw source extension`)
      continue
    }
    if (extension === '.map') {
      violations.push(`${relativePath}: source map`)
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
    } else if (statSync(artifactPath).size === 0) {
      empty.push(artifact)
    }
  }
  if (missing.length > 0 || empty.length > 0) {
    throw new Error(
      `WASM runtime artifacts are incomplete in dist/fsusui (missing: ${missing.join(', ')}; empty: ${empty.join(', ')}).`,
    )
  }
}

function assertMarkdownHeavyFeatureFrameArtifacts(rootDir) {
  const artifact = 'dist/wasm/markdown-heavy-feature-frame.mjs'
  const content = readFileSync(path.join(rootDir, artifact), 'utf8')
  if (!content.includes('fsus-markdown-heavy-feature-frame@1')) {
    throw new Error(`${artifact}: missing heavy feature frame scope`)
  }
  if (
    content.includes('sourceMappingURL') ||
    content.includes('?worker') ||
    content.includes('.worker.ts') ||
    content.includes('import.meta.url')
  ) {
    throw new Error(`${artifact}: contains an unresolved runtime reference`)
  }
}

function assertNoWorkspaceProtocolsRemain(packageJson) {
  const remaining = []
  for (const field of installDependencyFields) {
    const dependencies = packageJson[field]
    if (!dependencies) continue
    for (const [dep, specifier] of Object.entries(dependencies)) {
      if (typeof specifier === 'string' && specifier.startsWith('workspace:')) {
        remaining.push(`${field}.${dep}=${specifier}`)
      }
    }
  }
  if (remaining.length > 0) {
    throw new Error(
      `Workspace protocols remain in published manifest: ${remaining.join(', ')}`,
    )
  }
}

function assertNoBundledWorkspaceDependencyReferences(packageJson, rootDir) {
  for (const field of installDependencyFields) {
    const dependencies = packageJson[field]
    if (!dependencies) continue
    for (const dep of unpublishedWorkspaceDependencyNames) {
      if (Object.hasOwn(dependencies, dep)) {
        throw new Error(
          `Bundled workspace dependency must not remain in published manifest: ${field}.${dep}`,
        )
      }
    }
  }

  const contentLeaks = []
  for (const filePath of collectPackageCodeFiles(rootDir)) {
    const content = readFileSync(filePath, 'utf8')
    for (const dep of BUNDLED_WORKSPACE_DEPENDENCY_NAMES) {
      if (content.includes(`'${dep}'`) || content.includes(`"${dep}"`)) {
        contentLeaks.push(`${path.relative(rootDir, filePath)} (${dep})`)
      }
    }
  }
  if (contentLeaks.length > 0) {
    throw new Error(
      `Bundled workspace dependency references remain in published files: ${contentLeaks.slice(0, 15).join(', ')}`,
    )
  }
}

const stripDeclarationComments = (source) =>
  source.replace(
    /(["'`])(?:\\.|(?!\1)[^\\])*\1|\/\*[\s\S]*?\*\/|\/\/[^\n]*/gu,
    (match, quote) => (quote ? match : ''),
  )

const isRegularFile = (filePath) => {
  try {
    return statSync(filePath).isFile()
  } catch {
    return false
  }
}

const resolveRelativeDeclarationFile = (fromFile, specifier) => {
  const base = path.resolve(path.dirname(fromFile), specifier)
  const candidates = [
    base,
    `${base}.d.ts`,
    `${base}.d.mts`,
    `${base}.d.cts`,
    path.join(base, 'index.d.ts'),
    path.join(base, 'index.d.mts'),
    path.join(base, 'index.d.cts'),
  ]
  if (/\.(?:mjs|cjs|js)$/u.test(base)) {
    const stem = base.replace(/\.(?:mjs|cjs|js)$/u, '')
    candidates.push(`${stem}.d.ts`, `${stem}.d.mts`, `${stem}.d.cts`)
  }
  return candidates.find(isRegularFile) ?? null
}

function assertDeclarationIntegrity(rootDir) {
  const declarationFiles = collectDirectoryFiles(path.join(rootDir, 'dist')).filter(
    (filePath) => /\.d\.[cm]?ts$/u.test(filePath),
  )
  if (declarationFiles.length === 0) {
    throw new Error('Published package contains no declaration files under dist/.')
  }

  for (const requiredRel of [
    'dist/index.d.ts',
    'dist/core.d.ts',
    'dist/icons.d.ts',
    'dist/motion.d.ts',
    'dist/markdown.d.ts',
    'dist/wasm.d.ts',
    'dist/global.d.ts',
  ]) {
    if (!isRegularFile(path.join(rootDir, requiredRel))) {
      throw new Error(`Published package is missing required declaration ${requiredRel}.`)
    }
  }

  const broken = []
  const specifierPatterns = [
    /\bfrom\s+['"](\.[^'"]+)['"]/gu,
    /\bimport\s*\(\s*['"](\.[^'"]+)['"]\s*\)/gu,
    /\bimport\s+['"](\.[^'"]+)['"]/gu,
  ]
  for (const filePath of declarationFiles) {
    const cleaned = stripDeclarationComments(readFileSync(filePath, 'utf8'))
    for (const pattern of specifierPatterns) {
      pattern.lastIndex = 0
      for (const match of cleaned.matchAll(pattern)) {
        const specifier = match[1]
        if (!resolveRelativeDeclarationFile(filePath, specifier)) {
          broken.push(`${path.relative(rootDir, filePath)} -> ${specifier}`)
        }
      }
    }
  }
  if (broken.length > 0) {
    throw new Error(
      `Published declaration graph has ${broken.length} dangling relative import(s):\n${broken.slice(0, 25).join('\n')}`,
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
let rewrittenWasmFallbackReferences = 0

if (strict) {
  assertPublicInterfaceMatches(sourcePackageJson, packageJson, workspaceVersions)
  assertWasmRuntimeArtifacts(distRoot)
  assertMarkdownHeavyFeatureFrameArtifacts(distRoot)
  stripSourceMappingUrlReferences(distRoot)
  prunedSourceMaps = pruneSourceMaps(distRoot)
  rewrittenWasmFallbackReferences =
    rewriteEmscriptenWasmFallbackReferences(distRoot)
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

const authority = loadAuthority()
applyPublishedExternalFields(packageJson, authority)
normalizeWorkspaceProtocols(packageJson, workspaceVersions)
const removedBundledWorkspaceDependencies =
  removeBundledWorkspaceDependencies(packageJson)
assertNoWorkspaceProtocolsRemain(packageJson)
const rewrittenBundledWorkspaceReferences = rewriteBundledWorkspaceReferences(
  distRoot,
  {
    packageName,
    dependencyNames: BUNDLED_WORKSPACE_DEPENDENCY_NAMES,
    strict: false,
  },
)
assertNoBundledWorkspaceDependencyReferences(packageJson, distRoot)

writeFileSync(distPackagePath, `${JSON.stringify(packageJson, null, 2)}\n`)
if (existsSync(distNpmrcPath)) {
  unlinkSync(distNpmrcPath)
}

if (strict) {
  assertDeclarationIntegrity(distRoot)
  assertNoSecretsOrRawSources(distRoot)
}

console.log(
  `Prepared ${packageJson.name}@${packageJson.version} (Pure ESM) for ${registryUrl} from ${repository.owner}/${repository.repo} (${rewrittenBundledWorkspaceReferences.replacementCount} workspace rewrites, ${removedBundledWorkspaceDependencies} workspace deps removed, ${rewrittenWasmFallbackReferences} WASM fallback rewrites, ${prunedSourceMaps} sourcemaps pruned).`,
)

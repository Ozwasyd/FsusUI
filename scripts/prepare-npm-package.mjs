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
  rewritePublishedSelfReferences,
  rewritePublishStageWorkerReferences,
  stripSourceMappingUrlReferences,
} from './lib/package-artifact-rewriter.mjs'

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
const unpublishedWorkspaceDependencyNames = BUNDLED_WORKSPACE_DEPENDENCY_NAMES
const wasmRuntimeArtifacts = [
  'dist/ep_wasm.wasm',
  'dist/markdown-heavy-feature-frame.mjs',
  'es/wasm/ep_wasm.mjs',
  'es/wasm/markdown-heavy-feature-frame.mjs',
  'es/wasm/dist/ep_wasm.mjs',
  'es/wasm/dist/ep_wasm.wasm',
  'lib/wasm/ep_wasm.mjs',
  'lib/wasm/markdown-heavy-feature-frame.mjs',
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

function assertViteSafeWorkerRuntime(rootDir) {
  const violations = []
  const workerReferencePattern =
    /(['"])([^'"]*(?:data-pipeline\.worker|markdown-renderer\.worker|markdown-parser\.worker)\.(?:ts|js|mjs))\1/g

  for (const filePath of collectDirectoryFiles(rootDir)) {
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

  for (const filePath of collectDirectoryFiles(rootDir)) {
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

  for (const filePath of collectDirectoryFiles(rootDir)) {
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

function assertMarkdownHeavyFeatureFrameArtifacts(rootDir) {
  const frameArtifacts = [
    'dist/markdown-heavy-feature-frame.mjs',
    'es/wasm/markdown-heavy-feature-frame.mjs',
    'lib/wasm/markdown-heavy-feature-frame.mjs',
  ]
  const contents = frameArtifacts.map((artifact) =>
    readFileSync(path.join(rootDir, artifact), 'utf8'),
  )
  for (const [index, content] of contents.entries()) {
    const artifact = frameArtifacts[index]
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

  if (!contents.every((content) => content === contents[0])) {
    throw new Error(
      'Markdown heavy feature frame asset must be byte-identical across dist, es, and lib.',
    )
  }

  const builtUrlContracts = [
    {
      file: 'es/_virtual/_element-plus_markdown-heavy-feature-frame-url.mjs',
      pattern:
        /new URL\(['"]\.\.\/wasm\/markdown-heavy-feature-frame\.mjs['"],\s*import\.meta\.url\)\.href/u,
    },
    {
      file: 'lib/_virtual/_element-plus_markdown-heavy-feature-frame-url.js',
      pattern: /\.\.\/wasm\/markdown-heavy-feature-frame\.mjs/u,
    },
    {
      file: 'dist/index.full.mjs',
      pattern:
        /new URL\(['"]markdown-heavy-feature-frame\.mjs['"],\s*import\.meta\.url\)\.href/u,
    },
    {
      file: 'dist/index.full.js',
      pattern: /markdown-heavy-feature-frame\.mjs/u,
    },
  ]

  for (const { file, pattern } of builtUrlContracts) {
    const filePath = path.join(rootDir, file)
    if (!existsSync(filePath)) {
      throw new Error(`${file}: missing heavy feature frame URL owner`)
    }
    if (!pattern.test(readFileSync(filePath, 'utf8'))) {
      throw new Error(`${file}: heavy feature frame URL contract drifted`)
    }
  }
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

  if (workspaceRange === '^' || workspaceRange.startsWith('^')) {
    return `^${resolvedVersion}`
  }

  if (workspaceRange === '~' || workspaceRange.startsWith('~')) {
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

    for (const dependencyName of unpublishedWorkspaceDependencyNames) {
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

function assertNoBundledWorkspaceDependencyReferences(packageJson, rootDir) {
  const manifestLeaks = []

  for (const field of installDependencyFields) {
    const dependencies = packageJson[field]
    if (!dependencies) continue

    for (const dependencyName of unpublishedWorkspaceDependencyNames) {
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
  for (const filePath of collectPackageCodeFiles(rootDir)) {
    const content = readFileSync(filePath, 'utf8')
    for (const dependencyName of BUNDLED_WORKSPACE_DEPENDENCY_NAMES) {
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
  assertMarkdownHeavyFeatureFrameArtifacts(distRoot)
  stripSourceMappingUrlReferences(distRoot)
  prunedSourceMaps = pruneSourceMaps(distRoot)
  rewrittenWorkerReferences = rewritePublishStageWorkerReferences(distRoot)
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
const rewrittenBundledWorkspaceReferences = rewriteBundledWorkspaceReferences(
  distRoot,
  {
    packageName,
    dependencyNames: BUNDLED_WORKSPACE_DEPENDENCY_NAMES,
    strict: true,
  },
)
assertNoBundledWorkspaceDependencyReferences(packageJson, distRoot)

writeFileSync(distPackagePath, `${JSON.stringify(packageJson, null, 2)}\n`)
if (existsSync(distNpmrcPath)) {
  unlinkSync(distNpmrcPath)
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

function assertDeclarationIntegrity(distRoot, packageName) {
  const roots = ['es', 'lib']
    .map((dir) => path.join(distRoot, dir))
    .filter((dir) => existsSync(dir))
  const declarationFiles = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.isFile() && /\.d\.[cm]?ts$/u.test(entry.name)) {
        declarationFiles.push(full)
      }
    }
  }
  roots.forEach(walk)

  if (declarationFiles.length === 0) {
    throw new Error(
      'Published package contains no declaration files under es/ or lib/.',
    )
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
          broken.push(`${path.relative(distRoot, filePath)} -> ${specifier}`)
        }
      }
    }
  }
  if (broken.length > 0) {
    throw new Error(
      `Published declaration graph has ${broken.length} dangling relative import(s):\n${broken.slice(0, 25).join('\n')}`,
    )
  }

  for (const sub of ['es', 'lib']) {
    const iconsWrapperPath = path.join(distRoot, sub, 'icons-vue.d.ts')
    if (!isRegularFile(iconsWrapperPath)) {
      throw new Error(`Published package is missing ${sub}/icons-vue.d.ts.`)
    }
    const iconsWrapper = readFileSync(iconsWrapperPath, 'utf8')
    if (
      iconsWrapper.includes(`${packageName}/es/icons-vue`) ||
      iconsWrapper.includes(`${packageName}/lib/icons-vue`) ||
      iconsWrapper.includes(`${packageName}/icons-vue`)
    ) {
      throw new Error(
        `Published ${sub}/icons-vue.d.ts must not self-reference ${packageName}/icons-vue.`,
      )
    }
    for (const requiredRel of [
      `${sub}/icons-vue/index.d.ts`,
      `${sub}/icons-vue/components/index.d.ts`,
      `${sub}/components/select/index.d.ts`,
      `${sub}/components/cascader/index.d.ts`,
      `${sub}/components/slider/index.d.ts`,
      `${sub}/components/time-select/index.d.ts`,
      `${sub}/components/pagination/src/components/sizes.vue.d.ts`,
      `${sub}/components/date-picker/src/panel-utils.d.ts`,
      `${sub}/components/button/src/button.vue.d.ts`,
    ]) {
      if (!isRegularFile(path.join(distRoot, requiredRel))) {
        throw new Error(
          `Published package is missing required declaration ${requiredRel}.`,
        )
      }
    }
    const iconsIndex = readFileSync(
      path.join(distRoot, sub, 'icons-vue/components/index.d.ts'),
      'utf8',
    )
    if (!/\bArrowDown\b/u.test(iconsIndex)) {
      throw new Error(
        `Published ${sub}/icons-vue/components/index.d.ts must export ArrowDown.`,
      )
    }
    const buttonDts = readFileSync(
      path.join(distRoot, sub, 'components/button/src/button.vue.d.ts'),
      'utf8',
    )
    if (!/\bref\s*:/u.test(buttonDts) || /\b_ref\s*:/u.test(buttonDts)) {
      throw new Error(
        `Published ${sub}/components/button/src/button.vue.d.ts must expose defineExpose 'ref' and must not leak internal '_ref'.`,
      )
    }
  }
}

if (strict) {
  assertDeclarationIntegrity(distRoot, packageName)
  assertNoSecretsOrRawSources(distRoot)
}

console.log(
  `Prepared ${packageJson.name}@${packageJson.version} for GitHub Packages (${registryUrl}) from ${repository.owner}/${repository.repo} with ${rewrittenSelfReferences.replacementCount} self-reference rewrites across ${rewrittenSelfReferences.updatedFiles} files, ${rewrittenBundledWorkspaceReferences.replacementCount} bundled workspace rewrites across ${rewrittenBundledWorkspaceReferences.updatedFiles} files, ${removedBundledWorkspaceDependencies} bundled workspace dependencies removed, ${rewrittenWorkerReferences} worker references rewritten, ${rewrittenWasmFallbackReferences} WASM fallback references rewritten, and ${prunedSourceMaps} source maps pruned.`,
)

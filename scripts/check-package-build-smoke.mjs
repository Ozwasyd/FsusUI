import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  realpathSync,
} from 'node:fs'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registryUrl, resolvePackageContract } from './npm-package-contract.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) =>
  readFileSync(path.join(root, relativePath), 'utf8')
const readJson = (relativePath) => JSON.parse(read(relativePath))
const publishedDistRoot = path.join(root, 'dist', 'element-plus')
const compatibilityExportDirectories = [
  'components',
  'constants',
  'directives',
  'hooks',
  'locale',
  'motion',
  'utils',
]
const indexExportDirectories = compatibilityExportDirectories.filter(
  (directory) => directory !== 'motion',
)
const forbiddenBroadExportPaths = [
  './*',
  './es/*.mjs',
  './es/*',
  './lib/*.js',
  './lib/*',
]
const wasmInternalExportBlocks = ['./es/wasm/*', './lib/wasm/*']

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function assertExportTarget(packageJson, exportPath, expected, label) {
  assert(
    JSON.stringify(packageJson.exports?.[exportPath]) ===
      JSON.stringify(expected),
    `${label} exports ${exportPath} target drift`,
  )
}

function assertPortableDeclaration(declaration, label) {
  assert(
    !/from\s+['"](?:\/|[A-Za-z]:[\\/])/u.test(declaration) &&
      !declaration.includes('@element-plus/') &&
      !declaration.includes('worktree') &&
      !declaration.includes('FsusUI'),
    `${label} must not leak an absolute, repository, worktree, or private workspace path`,
  )
}

function assertPublishedRegularFile(relativePath, missingMessage) {
  const publishedRootRelativePath = path.relative(root, publishedDistRoot)
  const packageRelativePath = path.relative(
    publishedRootRelativePath,
    relativePath,
  )
  assert(
    packageRelativePath &&
      !path.isAbsolute(packageRelativePath) &&
      packageRelativePath !== '..' &&
      !packageRelativePath.startsWith(`..${path.sep}`),
    `published package path must remain within ${publishedRootRelativePath}: ${relativePath}`,
  )

  let publishedRootState
  try {
    publishedRootState = lstatSync(publishedDistRoot)
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(missingMessage, { cause: error })
    }
    throw error
  }
  assert(
    !publishedRootState.isSymbolicLink() && publishedRootState.isDirectory(),
    `published package root must be a real directory: ${publishedRootRelativePath}`,
  )

  let currentPath = publishedDistRoot
  const segments = packageRelativePath.split(path.sep)
  for (const [index, segment] of segments.entries()) {
    currentPath = path.join(currentPath, segment)
    let state
    try {
      state = lstatSync(currentPath)
    } catch (error) {
      if (error?.code === 'ENOENT') {
        throw new Error(missingMessage, { cause: error })
      }
      throw error
    }

    assert(
      !state.isSymbolicLink(),
      `published package path must not traverse a symbolic link: ${path.relative(root, currentPath)}`,
    )
    const isFinalSegment = index === segments.length - 1
    assert(
      isFinalSegment ? state.isFile() : state.isDirectory(),
      isFinalSegment
        ? `published package path must be a regular file: ${relativePath}`
        : `published package parent path must be a directory: ${path.relative(root, currentPath)}`,
    )
  }

  const realPublishedRoot = realpathSync(publishedDistRoot)
  const realFilePath = realpathSync(currentPath)
  assert(
    realFilePath.startsWith(`${realPublishedRoot}${path.sep}`),
    `published package real path must remain within ${publishedRootRelativePath}: ${relativePath}`,
  )

  return currentPath
}

function resolveExactRelativeDeclarationTarget(wrapperRelativePath) {
  const wrapperAbsolutePath = assertPublishedRegularFile(
    wrapperRelativePath,
    `published package declaration wrapper missing: ${wrapperRelativePath}`,
  )
  const wrapper = readFileSync(wrapperAbsolutePath, 'utf8')
  const match = wrapper.match(
    /^export \* from (['"])(\.\/[A-Za-z0-9._/-]+)\1;?\s*$/u,
  )
  assert(
    match,
    `published package ${wrapperRelativePath} must contain exactly one relative export-all declaration`,
  )

  const specifier = match[2]
  assert(
    !specifier.includes('\\') &&
      !specifier.split('/').includes('..') &&
      !path.posix.extname(specifier),
    `published package ${wrapperRelativePath} must use a traversal-free extensionless relative declaration target`,
  )

  const wrapperPosixPath = wrapperRelativePath.split(path.sep).join('/')
  const targetPosixPath = path.posix.normalize(
    path.posix.join(path.posix.dirname(wrapperPosixPath), `${specifier}.d.ts`),
  )
  const wrapperRoot = `${path.posix.dirname(wrapperPosixPath)}/`
  assert(
    targetPosixPath.startsWith(wrapperRoot),
    `published package ${wrapperRelativePath} declaration target must remain within its module directory`,
  )

  const targetRelativePath = targetPosixPath.split('/').join(path.sep)
  const targetAbsolutePath = assertPublishedRegularFile(
    targetRelativePath,
    `published package ${wrapperRelativePath} declaration target missing: ${targetRelativePath}`,
  )

  return {
    declaration: readFileSync(targetAbsolutePath, 'utf8'),
    targetRelativePath,
    wrapper,
  }
}

function assertPackageExportAllowlist(packageJson, label) {
  for (const exportPath of forbiddenBroadExportPaths) {
    assert(
      !Object.hasOwn(packageJson.exports ?? {}, exportPath),
      `${label} exports must not include broad authority ${exportPath}`,
    )
  }
  for (const exportPath of wasmInternalExportBlocks) {
    assert(
      packageJson.exports?.[exportPath] === null,
      `${label} exports must block ${exportPath}`,
    )
  }

  for (const [exportPath, target] of [
    ['./dist/index.css', './dist/index.css'],
    ['./theme-chalk/*', './theme-chalk/*'],
  ]) {
    assertExportTarget(packageJson, exportPath, target, label)
  }

  for (const [exportPath, target] of [
    ['./es/index', { types: './es/index.d.ts', import: './es/index.mjs' }],
    ['./lib/index', { types: './lib/index.d.ts', require: './lib/index.js' }],
    [
      './es/icons-vue',
      { types: './es/icons-vue.d.ts', import: './es/icons-vue.mjs' },
    ],
    [
      './lib/icons-vue',
      { types: './lib/icons-vue.d.ts', require: './lib/icons-vue.js' },
    ],
    ['./es/wasm', { types: './es/wasm.d.ts', import: './es/wasm.mjs' }],
    ['./lib/wasm', { types: './lib/wasm.d.ts', require: './lib/wasm.js' }],
    ['./es/motion', { types: './es/motion.d.ts', import: './es/motion.mjs' }],
    [
      './lib/motion',
      { types: './lib/motion.d.ts', require: './lib/motion.js' },
    ],
  ]) {
    assertExportTarget(packageJson, exportPath, target, label)
  }

  for (const directory of indexExportDirectories) {
    assertExportTarget(
      packageJson,
      `./es/${directory}`,
      {
        types: `./es/${directory}/index.d.ts`,
        import: `./es/${directory}/index.mjs`,
      },
      label,
    )
    assertExportTarget(
      packageJson,
      `./lib/${directory}`,
      {
        types: `./lib/${directory}/index.d.ts`,
        require: `./lib/${directory}/index.js`,
      },
      label,
    )
  }

  for (const directory of compatibilityExportDirectories) {
    assertExportTarget(
      packageJson,
      `./es/${directory}/*`,
      {
        types: [`./es/${directory}/*.d.ts`, `./es/${directory}/*/index.d.ts`],
        import: `./es/${directory}/*.mjs`,
      },
      label,
    )
    assertExportTarget(
      packageJson,
      `./lib/${directory}/*`,
      {
        types: [`./lib/${directory}/*.d.ts`, `./lib/${directory}/*/index.d.ts`],
        require: `./lib/${directory}/*.js`,
      },
      label,
    )
    assertExportTarget(
      packageJson,
      `./es/${directory}/*.mjs`,
      {
        types: `./es/${directory}/*.d.ts`,
        import: `./es/${directory}/*.mjs`,
      },
      label,
    )
    assertExportTarget(
      packageJson,
      `./lib/${directory}/*.js`,
      {
        types: `./lib/${directory}/*.d.ts`,
        require: `./lib/${directory}/*.js`,
      },
      label,
    )
  }
}

function collectFiles(rootDir, currentDir = rootDir) {
  const files = []

  for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
    const absolutePath = path.join(currentDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectFiles(rootDir, absolutePath))
    } else {
      files.push(absolutePath)
    }
  }

  return files
}

function isPackageReferenceCandidate(filePath) {
  return ['.d.ts', '.d.mts', '.d.cts', '.js', '.mjs', '.cjs'].some(
    (extension) => filePath.endsWith(extension),
  )
}

const rootPackage = readJson('package.json')
const sourcePackage = readJson('vue/packages/element-plus/package.json')
const typesDefinitionsTask = read(
  'vue/internal/build/src/tasks/types-definitions.ts',
)
const themePackageSnapshot = readJson(
  'vue/packages/theme-chalk/theme-package.snapshot.json',
)
const { packageName, repositoryGitUrl, repositoryWebUrl } =
  resolvePackageContract({ repoRoot: root })
const componentBarrel = read('vue/packages/components/index.ts')
const emptyStateEntry = read('vue/packages/components/empty-state/index.ts')
const demoEntry = read('vue/packages/demo-app/src/main.ts')
const consumerFixtureEntry = read(
  'vue/tests/consumer-install/template/src/main.ts',
)

assert(
  rootPackage.scripts?.build?.includes('pnpm run -C vue/internal/build start'),
  'root build script must call the internal package build entrypoint',
)
assert(
  rootPackage.scripts?.['build:npm-package']?.includes(
    'prepare-npm-package.mjs --strict',
  ),
  'build:npm-package must keep the strict publish artifact validation step',
)
assert(
  rootPackage.scripts?.['build:package-smoke']?.includes(
    'check-package-build-smoke.mjs',
  ),
  'build:package-smoke must stay a lightweight smoke check, not a full package build',
)
assert(sourcePackage.main === 'lib/index.js', 'source package main entry drift')
assert(
  sourcePackage.module === 'es/index.mjs',
  'source package module entry drift',
)
assert(
  sourcePackage.types === 'es/index.d.ts',
  'source package types entry drift',
)
assert(
  sourcePackage.style === 'dist/fsus.css',
  'source package style entry drift',
)
assert(
  demoEntry.includes('@element-plus/theme-chalk/src/fsus.scss') &&
    !demoEntry.includes('@element-plus/theme-chalk/src/index.scss'),
  'demo and visual fixtures must use the complete FsusUI source theme entry',
)
assert(
  consumerFixtureEntry.includes(
    '__FSUS_PACKAGE_NAME__/dist/public-shell-critical.css',
  ) &&
    consumerFixtureEntry.includes(
      '__FSUS_PACKAGE_NAME__/theme-chalk/el-markdown-renderer.css',
    ) &&
    !consumerFixtureEntry.includes('__FSUS_PACKAGE_NAME__/dist/fsus.css'),
  'performance consumer fixture must use critical and component CSS without complete product theme bundles',
)
const consumerFixtureViteConfig = read(
  'vue/tests/consumer-install/template/vite.config.ts',
)
assert(
  consumerFixtureViteConfig.includes("profile: 'consumer'") &&
    consumerFixtureViteConfig.includes('onlyExplicitManualChunks: true') &&
    consumerFixtureViteConfig.includes(
      'chunkSizeWarningLimit: Number.POSITIVE_INFINITY',
    ),
  'packaged consumer fixture must use explicit tree-shaken chunks and the path-aware performance ratchet',
)
assert(
  sourcePackage.homepage === repositoryWebUrl,
  'source package homepage drift',
)
assert(
  sourcePackage.repository?.url === `git+${repositoryGitUrl}`,
  'source package repository drift',
)
assert(
  sourcePackage.bugs?.url === `${repositoryWebUrl}/issues`,
  'source package bugs URL drift',
)
assert(
  sourcePackage.publishConfig?.access === 'public',
  'source package must publish with public access',
)
assert(
  sourcePackage.publishConfig?.registry === undefined ||
    sourcePackage.publishConfig.registry === registryUrl,
  'source package publish registry must be npm public registry when present',
)
assert(
  typesDefinitionsTask.includes(
    `const wasmPublicDeclaration = "export * from './wasm/index'\\n"`,
  ) &&
    /relativePath === path\.join\('packages', 'wasm\.d\.ts'\)\s*\?\s*wasmPublicDeclaration\s*:/u.test(
      typesDefinitionsTask,
    ),
  'types definition generation must emit the package-local ./wasm/index declaration for packages/wasm.d.ts',
)
assert(
  !/relativePath === path\.join\('packages', 'wasm\.d\.ts'\)[\s\S]{0,160}\?\s*await readFile\(wasmTypesEntry/u.test(
    typesDefinitionsTask,
  ),
  'packages/wasm.d.ts generation must not publish the absolute compiler entry declaration',
)
assertPackageExportAllowlist(sourcePackage, 'source package')

for (const exportPath of [
  '.',
  './global',
  './theme',
  './icons-vue',
  './wasm',
  './markdown-runtime',
  './motion',
  './perception-challenge',
]) {
  assert(
    sourcePackage.exports?.[exportPath],
    `source package exports must include ${exportPath}`,
  )
}

assert(
  componentBarrel.includes("export * from './empty-state'"),
  'component source barrel must export EmptyState',
)
assert(
  emptyStateEntry.includes('export const ElEmptyState'),
  'EmptyState source entry must export ElEmptyState',
)
assert(
  emptyStateEntry.includes('export type { EmptyStateInstance }'),
  'EmptyState source entry must export EmptyStateInstance',
)
assert(
  componentBarrel.includes("export * from './collection-primitives'"),
  'component source barrel must export collection primitives',
)

for (const artifact of [
  'vue/packages/icons-vue/dist/index.js',
  'vue/packages/icons-vue/dist/types/index.d.ts',
  'vue/packages/wasm/dist/index.mjs',
  'vue/packages/wasm/dist/ep_wasm.wasm',
  'vue/packages/wasm/dist/markdown_basic.wasm',
  'vue/packages/wasm/dist/markdown_simd.wasm',
  // Theme-chalk artifacts. fsus-theme.scss is intentionally compiled
  // as a standalone product override bundle so consumers can load it
  // after the base element-plus CSS without relying on cascade luck.
  'vue/packages/theme-chalk/dist/index.css',
  'vue/packages/theme-chalk/dist/el-fsus.css',
  'vue/packages/theme-chalk/dist/el-public-shell-critical.css',
  'vue/packages/theme-chalk/dist/el-fsus-theme.css',
]) {
  assert(
    existsSync(path.join(root, artifact)),
    `package smoke requires prepared artifact: ${artifact}`,
  )
}

const themeIndexSource = read('vue/packages/theme-chalk/src/index.scss')
const completeThemeSource = read('vue/packages/theme-chalk/src/fsus.scss')
const completeThemeCss = read('vue/packages/theme-chalk/dist/el-fsus.css')
const fsusThemeCss = read('vue/packages/theme-chalk/dist/el-fsus-theme.css')
const normalizedFsusThemeCss = fsusThemeCss.toLowerCase()
assert(
  !themeIndexSource.includes("@use './fsus-theme.scss'") &&
    !themeIndexSource.includes('@use "./fsus-theme.scss"'),
  'vue/packages/theme-chalk/src/index.scss must not directly @use fsus-theme.scss',
)
assert(
  completeThemeSource.indexOf("@use './index.scss'") <
    completeThemeSource.indexOf("@use './fsus-theme.scss'"),
  'fsus.scss must emit the compatibility layer before FsusUI product overrides',
)
assert(
  completeThemeSource.match(/@use '.\/index\.scss'/g)?.length === 1 &&
    completeThemeSource.match(/@use '.\/fsus-theme\.scss'/g)?.length === 1,
  'fsus.scss must include each theme layer exactly once',
)
assert(
  fsusThemeCss.includes('--fsus-scholarly-blue'),
  'dist/el-fsus-theme.css must carry fsus-theme product tokens',
)
for (const token of [
  '--fsus-color-action-primary:#4b79cc',
  '--fsus-color-action-primary-hover:#6f93d7',
  '--fsus-color-text-primary:#f0f0f4',
  '--fsus-color-surface-base:#121214',
  '--fsus-component-state-button-primary-background-default:#f0f0f4',
  '--fsus-component-state-button-primary-background-hover:#4b79cc',
]) {
  assert(
    normalizedFsusThemeCss.includes(token),
    `dist/el-fsus-theme.css must carry the dark public token ${token}`,
  )
}
assert(
  fsusThemeCss.includes('.fsus-reading-surface') &&
    fsusThemeCss.includes('.is-expressive-surface'),
  'dist/el-fsus-theme.css must carry fsus-theme product surface rules',
)
for (const token of [
  '--fsus-scholarly-blue',
  '.el-button',
  '.el-input__wrapper',
  '.el-tabs__item',
  '.el-dialog',
  '.el-empty',
  'html.dark',
]) {
  assert(
    completeThemeCss.includes(token),
    `dist/el-fsus.css must include the package theme snapshot token ${token}`,
  )
}
const completeThemeSnapshotHash = createHash('sha256')
  .update(completeThemeCss)
  .digest('hex')
assert(
  completeThemeSnapshotHash === themePackageSnapshot.sha256,
  'complete package theme changed; review Light/Dark Button, Input, Tabs, Dialog and Empty then update theme-package.snapshot.json',
)
assert(
  Buffer.byteLength(completeThemeCss) === themePackageSnapshot.bytes,
  'complete package theme snapshot byte size drift',
)
assert(
  JSON.stringify(themePackageSnapshot.modes) ===
    JSON.stringify(['light', 'dark']) &&
    JSON.stringify(themePackageSnapshot.components) ===
      JSON.stringify(['Button', 'Input', 'Tabs', 'Dialog', 'Empty']),
  'package theme snapshot must cover the required Light/Dark component matrix',
)

const gulpfile = read('vue/internal/build/gulpfile.ts')
const elementPlusPackage = JSON.parse(
  read('vue/packages/element-plus/package.json'),
)
assert(
  elementPlusPackage.exports?.['./dist/fsus.css'] === './dist/fsus.css',
  'element-plus package exports must expose the complete dist/fsus.css entry',
)
assert(
  elementPlusPackage.exports?.['./dist/el-fsus-theme.css'] ===
    './dist/el-fsus-theme.css',
  'element-plus package exports must expose dist/el-fsus-theme.css for consumers',
)
assert(
  gulpfile.includes('dist/fsus.css'),
  'internal build must copy the complete fsus.css entry to package dist',
)
assert(
  gulpfile.includes('dist/el-fsus-theme.css'),
  'internal build must copy el-fsus-theme.css to package dist',
)
for (const task of [
  'cleanPackageBuild',
  'buildModules',
  'generateTypesDefinitions',
  'buildThemeChalk',
  'buildFullBundle',
  'copyWasmRuntimeAssets',
]) {
  assert(gulpfile.includes(task), `internal build gulpfile must keep ${task}`)
}

if (existsSync(path.join(publishedDistRoot, 'package.json'))) {
  const distPackage = readJson('dist/element-plus/package.json')
  const distPackageSelfReference = distPackage.name
  assertPackageExportAllowlist(distPackage, 'published package')
  assert(
    distPackage.version === sourcePackage.version,
    `published package version ${distPackage.version} must match source package version ${sourcePackage.version}`,
  )
  const publishedThemePath = path.join(publishedDistRoot, 'dist', 'fsus.css')
  assert(
    existsSync(publishedThemePath),
    'published package must include dist/fsus.css',
  )
  assert(
    readFileSync(publishedThemePath, 'utf8') === completeThemeCss,
    'published dist/fsus.css must exactly match the reviewed complete theme snapshot',
  )
  for (const exportPath of [
    './wasm',
    './markdown-runtime',
    './motion',
    './perception-challenge',
  ]) {
    assert(
      distPackage.exports?.[exportPath],
      `published package exports must include ${exportPath}`,
    )
  }
  assert(
    !distPackage.dependencies?.['@element-plus/motion'],
    'published package must not depend on unpublished @element-plus/motion',
  )
  assert(
    !distPackage.dependencies?.['@element-plus/icons-vue'],
    'published package must not depend on unpublished @element-plus/icons-vue',
  )

  const emptyStateDistChecks = [
    [
      'dist/element-plus/es/index.d.ts',
      `export * from '${distPackageSelfReference}/es/components'`,
    ],
    [
      'dist/element-plus/lib/index.d.ts',
      `export * from '${distPackageSelfReference}/es/components'`,
    ],
    ['dist/element-plus/es/index.mjs', 'ElEmptyState'],
    ['dist/element-plus/lib/index.js', 'ElEmptyState'],
    [
      'dist/element-plus/es/components/index.d.ts',
      "export * from './empty-state'",
    ],
    [
      'dist/element-plus/lib/components/index.d.ts',
      "export * from './empty-state'",
    ],
    ['dist/element-plus/es/components/empty-state/index.d.ts', 'ElEmptyState'],
    ['dist/element-plus/lib/components/empty-state/index.d.ts', 'ElEmptyState'],
    [
      'dist/element-plus/es/components/empty-state/index.d.ts',
      'EmptyStateInstance',
    ],
    [
      'dist/element-plus/lib/components/empty-state/index.d.ts',
      'EmptyStateInstance',
    ],
  ]

  for (const [relativePath, token] of emptyStateDistChecks) {
    const absolutePath = path.join(root, relativePath)
    assert(
      existsSync(absolutePath),
      `published package must include ${relativePath}`,
    )
    assert(
      readFileSync(absolutePath, 'utf8').includes(token),
      `published package ${relativePath} must expose ${token}`,
    )
  }

  const fsusBlogConsumerChecks = [
    ['dist/element-plus/es/motion.mjs', 'FsuTransition'],
    ['dist/element-plus/es/motion.d.ts', 'MotionPresetName'],
    ['dist/element-plus/lib/motion.js', 'FsuTransition'],
    ['dist/element-plus/lib/motion.d.ts', 'MotionPresetName'],
    [
      'dist/element-plus/es/perception-challenge.mjs',
      'FsusPerceptionChallenge',
    ],
    [
      'dist/element-plus/es/perception-challenge.d.ts',
      'PerceptionChallengeClient',
    ],
    [
      'dist/element-plus/es/perception-challenge.mjs',
      'FsusPerceptionCharacterChallenge',
    ],
    [
      'dist/element-plus/es/perception-challenge.d.ts',
      'PerceptionCharacterChallengeInstance',
    ],
    [
      'dist/element-plus/lib/perception-challenge.js',
      'FsusPerceptionChallenge',
    ],
    [
      'dist/element-plus/lib/perception-challenge.d.ts',
      'PerceptionChallengeClient',
    ],
    [
      'dist/element-plus/lib/perception-challenge.js',
      'FsusPerceptionCharacterChallenge',
    ],
    [
      'dist/element-plus/lib/perception-challenge.d.ts',
      'PerceptionCharacterChallengeInstance',
    ],
    [
      'dist/element-plus/es/components/collection-primitives/index.d.ts',
      'FsusDataList',
    ],
    [
      'dist/element-plus/es/components/collection-primitives/index.d.ts',
      'DataListColumn',
    ],
    [
      'dist/element-plus/lib/components/collection-primitives/index.d.ts',
      'FsusDataList',
    ],
    [
      'dist/element-plus/lib/components/collection-primitives/index.d.ts',
      'DataListColumn',
    ],
  ]

  for (const [relativePath, token] of fsusBlogConsumerChecks) {
    const absolutePath = path.join(root, relativePath)
    assert(
      existsSync(absolutePath),
      `published package must include ${relativePath}`,
    )
    assert(
      readFileSync(absolutePath, 'utf8').includes(token),
      `published package ${relativePath} must expose ${token}`,
    )
  }

  for (const relativePath of [
    'dist/element-plus/es/wasm.d.ts',
    'dist/element-plus/lib/wasm.d.ts',
  ]) {
    const { declaration, targetRelativePath, wrapper } =
      resolveExactRelativeDeclarationTarget(relativePath)
    assert(
      wrapper.trim() === "export * from './wasm/index'",
      `published package ${relativePath} must reference the package-local wasm/index declaration`,
    )
    assertPortableDeclaration(
      wrapper,
      `published package ${relativePath} declaration wrapper`,
    )
    assertPortableDeclaration(
      declaration,
      `published package ${targetRelativePath} declaration target`,
    )

    const finalTypeExport = [
      ...declaration.matchAll(/export type\s*\{([^}]*)\}/gu),
    ].at(-1)?.[1]
    const exportedTypes =
      finalTypeExport?.split(',').map((name) => name.trim()) ?? []
    for (const typeName of ['MarkdownSafeHtml', 'MarkdownSafeRenderResult']) {
      assert(
        exportedTypes.includes(typeName),
        `published package ${targetRelativePath} final type export must include ${typeName}`,
      )
    }
  }

  for (const [runtimePath, gatewayPath, importToken] of [
    [
      'dist/element-plus/es/wasm/markdown-runtime.mjs',
      'dist/element-plus/es/wasm/markdown-feature-output-gateway.mjs',
      './markdown-feature-output-gateway.mjs',
    ],
    [
      'dist/element-plus/lib/wasm/markdown-runtime.js',
      'dist/element-plus/lib/wasm/markdown-feature-output-gateway.js',
      './markdown-feature-output-gateway.js',
    ],
  ]) {
    assert(
      existsSync(path.join(root, gatewayPath)),
      `published package must retain internal gateway artifact ${gatewayPath}`,
    )
    assert(
      read(runtimePath).includes(importToken),
      `published package ${runtimePath} must retain its relative gateway import`,
    )
  }

  for (const relativePath of [
    'dist/element-plus/es/components/markdown-renderer/src/markdown-renderer-cache.mjs',
    'dist/element-plus/lib/components/markdown-renderer/src/markdown-renderer-cache.js',
  ]) {
    assert(
      !existsSync(path.join(root, relativePath)),
      `published package must not include removed Markdown cache artifact ${relativePath}`,
    )
  }

  const leakedFiles = collectFiles(publishedDistRoot)
    .filter(isPackageReferenceCandidate)
    .filter((filePath) =>
      readFileSync(filePath, 'utf8').includes('@element-plus/motion'),
    )
    .map((filePath) => path.relative(publishedDistRoot, filePath))

  assert(
    leakedFiles.length === 0,
    `published files must not reference unpublished @element-plus/motion: ${leakedFiles.join(', ')}`,
  )

  const workerReferencePattern =
    /(['"])([^'"]*(?:data-pipeline\.worker|markdown-renderer\.worker|markdown-parser\.worker)\.(?:ts|js|mjs))\1/g
  const workerReferenceViolations = []
  for (const filePath of collectFiles(publishedDistRoot).filter(
    isPackageReferenceCandidate,
  )) {
    const relativePath = path.relative(publishedDistRoot, filePath)
    const content = readFileSync(filePath, 'utf8')
    for (const match of content.matchAll(workerReferencePattern)) {
      const workerSpecifier = match[2]
      const workerPath = path.resolve(path.dirname(filePath), workerSpecifier)
      if (workerSpecifier.endsWith('.ts') || !existsSync(workerPath)) {
        workerReferenceViolations.push(`${relativePath} -> ${workerSpecifier}`)
      }
    }
  }
  assert(
    workerReferenceViolations.length === 0,
    `published worker references must resolve to built runtime artifacts: ${workerReferenceViolations.join(', ')}`,
  )
}

console.log(`Package build smoke passed for ${packageName}.`)

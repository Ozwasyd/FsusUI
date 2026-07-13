import { existsSync, readdirSync, readFileSync } from 'node:fs'
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
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
  consumerFixtureEntry.includes('__FSUS_PACKAGE_NAME__/dist/fsus.css') &&
    !consumerFixtureEntry.includes('__FSUS_PACKAGE_NAME__/dist/index.css'),
  'packaged consumer fixture must use the complete dist/fsus.css entry',
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
  for (const exportPath of ['./motion', './perception-challenge']) {
    assert(
      distPackage.exports?.[exportPath],
      `published package exports must include ${exportPath}`,
    )
  }
  assert(
    !distPackage.dependencies?.['@element-plus/motion'],
    'published package must not depend on unpublished @element-plus/motion',
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
      'dist/element-plus/lib/perception-challenge.js',
      'FsusPerceptionChallenge',
    ],
    [
      'dist/element-plus/lib/perception-challenge.d.ts',
      'PerceptionChallengeClient',
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
}

console.log(`Package build smoke passed for ${packageName}.`)

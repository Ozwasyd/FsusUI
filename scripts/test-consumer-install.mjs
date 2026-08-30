import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'
import { resolvePackageContract } from './npm-package-contract.mjs'
import { packedMarkdownRuntimeProjectionProbe } from './packed-markdown-runtime-probe.mjs'
import {
  readCandidatePackageJson,
  sha256File,
  verifyCandidate,
} from './npm-candidate-lib.mjs'
import { parseConsumerInstallArgs } from './consumer-install-args.mjs'
import {
  consumerProfileSchema,
  consumerMatrixConfigDigest,
  projectConsumerPackage,
  readConsumerAuthority,
  resolveConsumerProfile,
  validateConsumerBuildEvidence,
} from './consumer-matrix-lib.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const templateRoot = path.join(
  repoRoot,
  'vue',
  'tests',
  'consumer-install',
  'template',
)
const distRoot = path.join(repoRoot, 'dist', 'element-plus')
const distPackagePath = path.join(distRoot, 'package.json')
const parsedInstallArgs = parseConsumerInstallArgs(
  process.argv.slice(2),
  process.env,
)
const candidateTarballPath = path.resolve(parsedInstallArgs.candidate)
const sourcePackagePath = path.join(
  repoRoot,
  'vue',
  'packages',
  'element-plus',
  'package.json',
)
const viteChunkHelperPath = path.join(
  repoRoot,
  'scripts',
  'vite-manual-chunks.mjs',
)
const performanceBaseline = JSON.parse(
  readFileSync(
    path.join(repoRoot, 'scripts', 'consumer-performance-baseline.json'),
    'utf8',
  ),
)
const keepConsumerFixture = process.env.FSUS_KEEP_CONSUMER_FIXTURE === '1'
const checkpointFixturePath = process.env.FSUS_CONSUMER_FIXTURE_PATH
const consumerTempRoot = path.resolve(
  process.env.FSUS_CONSUMER_TMPDIR ?? os.tmpdir(),
)

if (!existsSync(candidateTarballPath)) {
  throw new Error(`Consumer candidate does not exist: ${candidateTarballPath}`)
}

function resolveExecutable(command) {
  return command
}

function withCommandOptions(options) {
  const { env, ...commandOptions } = options ?? {}
  return {
    shell: process.platform === 'win32',
    ...commandOptions,
    env: {
      ...process.env,
      CI: '1',
      NO_UPDATE_NOTIFIER: '1',
      ...env,
    },
  }
}

const sourcePackage = JSON.parse(readFileSync(sourcePackagePath, 'utf8'))
const candidateManifest = candidateTarballPath
  ? verifyCandidate({ repoRoot, tarballPath: candidateTarballPath })
  : undefined
const distPackage = candidateTarballPath
  ? readCandidatePackageJson(candidateTarballPath)
  : JSON.parse(readFileSync(distPackagePath, 'utf8'))
const { packageName, repositoryWebUrl } = resolvePackageContract({
  repoRoot,
  sourcePackageName: sourcePackage.name,
})
const { authority, digest: authorityDigest } = readConsumerAuthority(repoRoot)
const consumerProfile = resolveConsumerProfile({
  authority,
  candidatePackage: distPackage,
  name: parsedInstallArgs.profile,
})
const resultPath = process.env.FSUS_CONSUMER_RESULT
  ? path.resolve(process.env.FSUS_CONSUMER_RESULT)
  : undefined
const durationsMs = Object.fromEntries(
  [
    'install',
    'typecheck',
    'build',
    'ssr',
    'exports',
    'worker',
    'wasm',
    'bundle',
  ].map((stage) => [stage, 0]),
)
const statuses = Object.fromEntries(
  Object.keys(durationsMs).map((stage) => [stage, 'pending']),
)

function stage(name, callback) {
  const startedAt = performance.now()
  try {
    const value = callback()
    statuses[name] = 'passed'
    return value
  } catch (error) {
    statuses[name] = 'failed'
    throw error
  } finally {
    durationsMs[name] = Math.max(0, Math.round(performance.now() - startedAt))
  }
}

if (distPackage.name !== packageName) {
  throw new Error(
    `Built package name drifted. Expected ${packageName}, got ${distPackage.name}.`,
  )
}

if (distPackage.peerDependencies?.vue !== sourcePackage.peerDependencies?.vue) {
  throw new Error(
    `Built package peerDependencies.vue drifted. Expected ${sourcePackage.peerDependencies?.vue}, got ${distPackage.peerDependencies?.vue}.`,
  )
}

if (distPackage.homepage !== repositoryWebUrl) {
  throw new Error(
    `Built package homepage drifted. Expected ${repositoryWebUrl}, got ${distPackage.homepage}.`,
  )
}

function run(command, args, options) {
  execFileSync(resolveExecutable(command), args, {
    stdio: 'inherit',
    ...withCommandOptions(options),
  })
}

function runAndCollect(command, args, options) {
  const result = spawnSync(resolveExecutable(command), args, {
    encoding: 'utf8',
    ...withCommandOptions(options),
  })
  const stdout = result.stdout ?? ''
  const stderr = result.stderr ?? ''
  process.stdout.write(stdout)
  process.stderr.write(stderr)

  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(
      `${resolveExecutable(command)} ${args.join(' ')} exited with code ${result.status ?? -1}`,
    )
  }

  return `${stdout}${stderr}`
}

function assertNoConsumerBuildWarnings(output) {
  const forbiddenPatterns = [
    /cannot be analyzed by Vite/iu,
    /doesn't exist at build time/iu,
    /use\s+\/\*\s*@vite-ignore\s*\*\//iu,
    /PURE annotation/iu,
    /Rollup cannot interpret/iu,
    /WASM URL/iu,
    /Some chunks are larger than \d+ kB after minification/iu,
    /Circular chunk:/iu,
    /Generated an empty chunk:/iu,
    /MODULE_TYPELESS_PACKAGE_JSON/iu,
  ]
  const matchedPattern = forbiddenPatterns.find((pattern) =>
    pattern.test(output),
  )

  if (matchedPattern) {
    throw new Error(
      `Consumer Vite build emitted a forbidden warning (${matchedPattern}).`,
    )
  }
}

const formatSize = (bytes) => `${(bytes / 1024).toFixed(2)} KiB`

function collectManifestClosure(manifest, entryKey) {
  const visited = new Set()
  const visit = (key) => {
    if (visited.has(key)) return
    visited.add(key)
    for (const dependency of manifest[key]?.imports ?? []) visit(dependency)
  }
  visit(entryKey)
  return visited
}

const manifestClosureContainsFile = (manifest, closure, targetFile) =>
  [...closure].some((key) => manifest[key]?.file === targetFile)

const isMarkdownFeatureOutputGatewayModule = (key) =>
  /\/wasm\/markdown-feature-output-gateway\.mjs$/u.test(key)

function hasDynamicManifestPath(manifest, entryKey, targetKey) {
  const visited = new Set()
  const visit = (key, crossedDynamicBoundary) => {
    const visitKey = `${crossedDynamicBoundary}:${key}`
    if (visited.has(visitKey)) return false
    visited.add(visitKey)
    if (key === targetKey) return crossedDynamicBoundary

    const entry = manifest[key]
    if (!entry) return false
    return [
      ...(entry.imports ?? []).map((dependency) => [dependency, false]),
      ...(entry.dynamicImports ?? []).map((dependency) => [dependency, true]),
    ].some(([dependency, isDynamic]) =>
      visit(dependency, crossedDynamicBoundary || isDynamic),
    )
  }
  return visit(entryKey, false)
}

function measureManifestClosure(
  fixtureRoot,
  manifest,
  keys,
  { excludeFiles = new Set(), measurementCache = new Map() } = {},
) {
  const relativeFiles = new Set()
  for (const key of keys) {
    const entry = manifest[key]
    if (!entry) continue
    if (entry.file) relativeFiles.add(entry.file)
    for (const cssFile of entry.css ?? []) relativeFiles.add(cssFile)
  }

  const files = [...relativeFiles]
    .filter((relativePath) => !excludeFiles.has(relativePath))
    .map((relativePath) => {
      const cached = measurementCache.get(relativePath)
      if (cached) return cached
      const contents = readFileSync(
        path.join(fixtureRoot, 'dist', relativePath),
      )
      const measurement = {
        brotli: brotliCompressSync(contents, {
          params: {
            [constants.BROTLI_PARAM_QUALITY]: 11,
          },
        }).byteLength,
        gzip: gzipSync(contents, { level: 9 }).byteLength,
        path: relativePath,
        raw: contents.byteLength,
      }
      measurementCache.set(relativePath, measurement)
      return measurement
    })
    .sort((a, b) => b.brotli - a.brotli)

  return {
    brotli: files.reduce((total, file) => total + file.brotli, 0),
    files,
    gzip: files.reduce((total, file) => total + file.gzip, 0),
    raw: files.reduce((total, file) => total + file.raw, 0),
  }
}

function reportConsumerPerformanceGraph(fixtureRoot) {
  const manifestPath = path.join(fixtureRoot, 'dist', '.vite', 'manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const entryKey = Object.keys(manifest).find((key) => manifest[key]?.isEntry)
  if (!entryKey) throw new Error('Consumer Vite manifest has no entry chunk.')

  const measurementCache = new Map()
  const initialKeys = collectManifestClosure(manifest, entryKey)
  const initial = measureManifestClosure(fixtureRoot, manifest, initialKeys, {
    measurementCache,
  })
  const initialFiles = new Set(initial.files.map((file) => file.path))
  const dynamic = Object.entries(manifest)
    .filter(([, entry]) => entry?.isDynamicEntry)
    .map(([key]) => key)
    .map((key) => ({
      key,
      ...measureManifestClosure(
        fixtureRoot,
        manifest,
        collectManifestClosure(manifest, key),
        { excludeFiles: initialFiles, measurementCache },
      ),
    }))
    .sort((a, b) => b.brotli - a.brotli)

  console.log(
    `Consumer initial graph: raw=${formatSize(initial.raw)}, gzip=${formatSize(initial.gzip)}, brotli=${formatSize(initial.brotli)}, files=${initial.files.length}.`,
  )
  for (const file of initial.files.slice(0, 12)) {
    console.log(
      `Consumer initial file ${file.path}: raw=${formatSize(file.raw)}, gzip=${formatSize(file.gzip)}, brotli=${formatSize(file.brotli)}.`,
    )
  }
  for (const group of dynamic.slice(0, 12)) {
    console.log(
      `Consumer dynamic graph ${group.key}: raw=${formatSize(group.raw)}, gzip=${formatSize(group.gzip)}, brotli=${formatSize(group.brotli)}, files=${group.files.length}.`,
    )
  }

  return { dynamic, entryKey, initial, initialKeys, manifest }
}

function assertRatchet(label, actual, baseline) {
  for (const encoding of ['raw', 'gzip', 'brotli']) {
    if (actual[encoding] > baseline[encoding]) {
      throw new Error(
        `${label} ${encoding} regressed: actual=${formatSize(actual[encoding])}, measured-baseline=${formatSize(baseline[encoding])}.`,
      )
    }
  }
}

function assertConsumerPerformanceGraph(graph) {
  const eagerOptionalSourceKeys = [...graph.initialKeys].filter((key) =>
    key.includes('public-shell-critical.css'),
  )
  if (eagerOptionalSourceKeys.length > 0) {
    throw new Error(
      `Consumer startup graph eagerly loaded optional CSS:\n${eagerOptionalSourceKeys.join('\n')}`,
    )
  }

  const forbiddenStartupFragments = [
    'cytoscape',
    'fsus-markdown',
    'fsus-wasm',
    'katex',
    'mermaid',
    'shiki',
  ]
  const eagerFeatureFiles = graph.initial.files.filter((file) =>
    forbiddenStartupFragments.some((fragment) => file.path.includes(fragment)),
  )
  if (eagerFeatureFiles.length > 0) {
    throw new Error(
      `Consumer startup graph eagerly loaded optional feature files:\n${eagerFeatureFiles.map((file) => file.path).join('\n')}`,
    )
  }

  assertRatchet(
    'Consumer startup graph',
    graph.initial,
    performanceBaseline.startup,
  )

  const markdownHydration = graph.dynamic.find((group) =>
    group.key.includes('/components/markdown-renderer/index.mjs'),
  )
  if (!markdownHydration) {
    throw new Error('Consumer graph lost the lazy Markdown hydration entry.')
  }
  const gatewayKeys = Object.keys(graph.manifest).filter(
    isMarkdownFeatureOutputGatewayModule,
  )
  if (gatewayKeys.length !== 1) {
    throw new Error(
      `Consumer graph must expose exactly one Markdown feature output gateway module, found ${gatewayKeys.length}.`,
    )
  }
  const gatewayKey = gatewayKeys[0]
  const gateway = graph.manifest[gatewayKey]
  if (!gateway?.isDynamicEntry) {
    throw new Error(
      'Consumer Markdown feature output gateway must remain a dynamic manifest entry.',
    )
  }
  if (
    graph.initialKeys.has(gatewayKey) ||
    manifestClosureContainsFile(graph.manifest, graph.initialKeys, gateway.file)
  ) {
    throw new Error(
      'Consumer startup graph eagerly contains the Markdown feature output gateway.',
    )
  }
  const markdownHydrationClosure = collectManifestClosure(
    graph.manifest,
    markdownHydration.key,
  )
  if (
    markdownHydrationClosure.has(gatewayKey) ||
    manifestClosureContainsFile(
      graph.manifest,
      markdownHydrationClosure,
      gateway.file,
    )
  ) {
    throw new Error(
      'Consumer Markdown hydration closure eagerly contains the Markdown feature output gateway chunk.',
    )
  }
  if (
    !hasDynamicManifestPath(graph.manifest, markdownHydration.key, gatewayKey)
  ) {
    throw new Error(
      'Consumer Markdown hydration graph no longer reaches the feature output gateway through a dynamic import.',
    )
  }
  assertRatchet(
    'Consumer Markdown hydration graph',
    markdownHydration,
    performanceBaseline.markdownHydration,
  )

  console.log(
    `Consumer performance ratchets passed (${performanceBaseline.provenance}).`,
  )
  return {
    startup: {
      actual: {
        raw: graph.initial.raw,
        gzip: graph.initial.gzip,
        brotli: graph.initial.brotli,
      },
      limit: performanceBaseline.startup,
    },
    markdownHydration: {
      actual: {
        raw: markdownHydration.raw,
        gzip: markdownHydration.gzip,
        brotli: markdownHydration.brotli,
      },
      limit: performanceBaseline.markdownHydration,
    },
  }
}

const tempRoot = checkpointFixturePath
  ? null
  : mkdtempSync(path.join(consumerTempRoot, 'fsusui-consumer-'))
const fixtureRoot = checkpointFixturePath
  ? path.resolve(checkpointFixturePath)
  : path.join(tempRoot, 'fixture')
const artifactsRoot = tempRoot ? path.join(tempRoot, 'artifacts') : null
const packageManager = consumerProfile.manager
let dependencyVersions
const execArgs = (binary, args) =>
  packageManager === 'npm'
    ? ['exec', '--offline', '--', binary, ...args]
    : ['exec', binary, ...args]

function installedVersion(packageId) {
  const packageJsonPath = path.join(
    fixtureRoot,
    'node_modules',
    ...packageId.split('/'),
    'package.json',
  )
  return JSON.parse(readFileSync(packageJsonPath, 'utf8')).version
}

function collectFiles(root, current = root) {
  const files = []
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name)
    if (entry.isDirectory()) files.push(...collectFiles(root, absolute))
    else files.push(path.relative(root, absolute).replaceAll(path.sep, '/'))
  }
  return files
}

function assertDependencySingleton() {
  const versions = Object.fromEntries(
    ['vue', '@vue/compiler-dom', '@vue/shared'].map((id) => [
      id,
      installedVersion(id),
    ]),
  )
  if (
    versions.vue !== versions['@vue/compiler-dom'] ||
    versions.vue !== versions['@vue/shared']
  ) {
    throw new Error(
      `Consumer Vue runtime is not a compatible singleton: ${JSON.stringify(versions)}.`,
    )
  }
  const listArgs =
    packageManager === 'npm'
      ? ['ls', 'vue', '@vue/compiler-dom', '@vue/shared', '--all', '--json']
      : [
          'list',
          'vue',
          '@vue/compiler-dom',
          '@vue/shared',
          '--depth',
          'Infinity',
          '--json',
        ]
  const output = execFileSync(packageManager, listArgs, {
    cwd: fixtureRoot,
    encoding: 'utf8',
    ...withCommandOptions(),
  })
  const listed = JSON.parse(output)
  const observed = new Map()
  const visit = (value, key = '') => {
    if (!value || typeof value !== 'object') return
    if (
      ['vue', '@vue/compiler-dom', '@vue/shared'].includes(key) &&
      value.version
    ) {
      const versionsForId = observed.get(key) ?? new Set()
      versionsForId.add(value.version)
      observed.set(key, versionsForId)
    }
    for (const dependencyField of ['dependencies', 'devDependencies']) {
      for (const [name, dependency] of Object.entries(
        value[dependencyField] ?? {},
      )) {
        visit(dependency, name)
      }
    }
    if (Array.isArray(value)) value.forEach((item) => visit(item))
  }
  visit(listed)
  for (const id of ['vue', '@vue/compiler-dom', '@vue/shared']) {
    const found = observed.get(id) ?? new Set([versions[id]])
    if (found.size !== 1 || !found.has(versions[id])) {
      throw new Error(
        `Consumer dependency graph contains duplicate ${id} versions: ${[...found].join(', ')}.`,
      )
    }
  }
  return versions
}

function inspectProductionArtifacts() {
  const distPath = path.join(fixtureRoot, 'dist')
  const files = collectFiles(distPath)
  const workerFiles = files.filter((file) =>
    /worker[^/]*\.(?:js|mjs)$/u.test(file),
  )
  const wasmFiles = files.filter((file) => file.endsWith('.wasm'))
  if (workerFiles.length === 0) {
    throw new Error('Consumer production build emitted no worker artifact.')
  }
  if (wasmFiles.length === 0) {
    throw new Error('Consumer production build emitted no Wasm artifact.')
  }
  const forbidden = files.filter(
    (file) =>
      /worker\.ts$/u.test(file) ||
      file.endsWith('.map') ||
      path.isAbsolute(file),
  )
  if (forbidden.length > 0) {
    throw new Error(
      `Consumer production build leaked source-only artifacts: ${forbidden.join(', ')}.`,
    )
  }
  const emittedText = files
    .filter((file) => /\.(?:js|mjs|css|html)$/u.test(file))
    .map((file) => readFileSync(path.join(distPath, file), 'utf8'))
    .join('\n')
  if (/\.worker\.ts\b/u.test(emittedText)) {
    throw new Error('Consumer production output retains a .worker.ts URL.')
  }
  return { workerFiles, wasmFiles }
}

try {
  if (!checkpointFixturePath) {
    cpSync(templateRoot, fixtureRoot, { recursive: true })
    mkdirSync(artifactsRoot, { recursive: true })

    for (const relativePath of ['src/main.ts', 'tsconfig.json']) {
      const filePath = path.join(fixtureRoot, relativePath)
      const content = readFileSync(filePath, 'utf8').replaceAll(
        '__FSUS_PACKAGE_NAME__',
        packageName,
      )
      writeFileSync(filePath, content)
    }

    const viteConfigPath = path.join(fixtureRoot, 'vite.config.ts')
    const viteConfig = readFileSync(viteConfigPath, 'utf8').replaceAll(
      '../../../scripts/vite-manual-chunks.mjs',
      pathToFileURL(viteChunkHelperPath).href,
    )
    writeFileSync(viteConfigPath, viteConfig)
    const templatePackage = JSON.parse(
      readFileSync(path.join(fixtureRoot, 'package.json'), 'utf8'),
    )
    const projectedPackage = projectConsumerPackage({
      candidatePath: candidateTarballPath,
      candidatePackage: distPackage,
      profile: consumerProfile,
      templatePackage,
    })
    writeFileSync(
      path.join(fixtureRoot, 'package.json'),
      `${JSON.stringify(projectedPackage, null, 2)}\n`,
    )

    stage('install', () => {
      if (packageManager === 'npm') {
        run(
          'npm',
          [
            'install',
            '--package-lock-only',
            '--ignore-scripts',
            '--no-audit',
            '--no-fund',
          ],
          { cwd: fixtureRoot },
        )
        rmSync(path.join(fixtureRoot, 'node_modules'), {
          force: true,
          recursive: true,
        })
        run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], {
          cwd: fixtureRoot,
        })
      } else {
        run('pnpm', ['install', '--lockfile-only', '--ignore-scripts'], {
          cwd: fixtureRoot,
        })
        rmSync(path.join(fixtureRoot, 'node_modules'), {
          force: true,
          recursive: true,
        })
        run('pnpm', ['install', '--frozen-lockfile', '--ignore-scripts'], {
          cwd: fixtureRoot,
        })
      }
      dependencyVersions = assertDependencySingleton()
    })
  } else {
    if (!existsSync(path.join(fixtureRoot, 'node_modules'))) {
      throw new Error(
        `Consumer checkpoint has no installed dependencies: ${fixtureRoot}`,
      )
    }
    console.log(`Consumer verification resumed from ${fixtureRoot}.`)
    statuses.install = 'passed'
    dependencyVersions = assertDependencySingleton()
  }
  stage('exports', () => {
    run(
      'node',
      [
        '--input-type=module',
        '--eval',
        packedMarkdownRuntimeProjectionProbe(packageName),
      ],
      { cwd: fixtureRoot },
    )
    run(
      'node',
      [
        '--input-type=module',
        '--eval',
        [
          `import { createRequire } from 'node:module'`,
          `import path from 'node:path'`,
          `const root = await import('${packageName}')`,
          `const wasm = await import('${packageName}/wasm')`,
          `const markdownRuntime = await import('${packageName}/markdown-runtime')`,
          `const renderPipeline = await import('${packageName}/render-pipeline')`,
          `const theme = await import('${packageName}/theme')`,
          `const icons = await import('${packageName}/icons-vue')`,
          `const motion = await import('${packageName}/motion')`,
          `const perception = await import('${packageName}/perception-challenge')`,
          `const require = createRequire(import.meta.url)`,
          `const rootCjs = require('${packageName}')`,
          `const wasmCjs = require('${packageName}/wasm')`,
          `const markdownRuntimeCjs = require('${packageName}/markdown-runtime')`,
          `const componentEntry = await import('${packageName}/es/components/button/index')`,
          `const componentEntryCjs = require('${packageName}/lib/components/button/index')`,
          `const componentEntryWithExtension = await import('${packageName}/es/components/button/index.mjs')`,
          `const componentEntryCjsWithExtension = require('${packageName}/lib/components/button/index.js')`,
          `const localeLang = await import('${packageName}/es/locale/lang/en')`,
          `const localeLangCjs = require('${packageName}/lib/locale/lang/en')`,
          `const expectEsmPathNotExported = async (specifier) => { try { await import(specifier) } catch (error) { if (error?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') return; throw error } throw new Error('ES deep import unexpectedly exported ' + specifier) }`,
          `const expectCjsPathNotExported = (specifier) => { try { require(specifier) } catch (error) { if (error?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') return; throw error } throw new Error('CJS deep import unexpectedly exported ' + specifier) }`,
          `const expectEsmMissingInternalPath = async (specifier) => { let expectedUrl; try { expectedUrl = import.meta.resolve(specifier) } catch (error) { if (error?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') return; throw error } try { await import(specifier) } catch (error) { if (error?.code === 'ERR_MODULE_NOT_FOUND' && error?.url === expectedUrl) return; throw error } throw new Error('ES internal path unexpectedly loaded ' + specifier) }`,
          `const expectCjsMissingInternalPath = (specifier, relativeTarget) => { try { require.resolve(specifier) } catch (error) { if (error?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') return; if (error?.code === 'MODULE_NOT_FOUND') { const firstLine = String(error?.message ?? '').split(/\\r?\\n/u)[0]; const expectedTarget = error?.path ? path.join(error.path, relativeTarget) : null; if (expectedTarget && firstLine === "Cannot find module '" + expectedTarget + "'") return; } throw error } throw new Error('CJS internal path unexpectedly resolved ' + specifier) }`,
          `const forbiddenAuthorityBuilders = ['authorizeMarkdownRuntimeResult', 'brandMarkdownSafeHtml', 'brandMarkdownSafeRenderResult']`,
          `for (const [surface, exports] of [['root', root], ['wasm', wasm], ['markdown-runtime', markdownRuntime]]) for (const name of forbiddenAuthorityBuilders) if (name in exports) throw new Error(surface + ' exposes forbidden Markdown authority builder ' + name)`,
          `await expectEsmPathNotExported('${packageName}/es/wasm/markdown-safe')`,
          `expectCjsPathNotExported('${packageName}/lib/wasm/markdown-safe')`,
          `await expectEsmPathNotExported('${packageName}/es/wasm/markdown-feature-output-gateway.mjs')`,
          `await expectEsmPathNotExported('${packageName}/es/wasm/%6darkdown-feature-output-gateway.mjs')`,
          `await expectEsmPathNotExported('${packageName}/es/%77asm/markdown-feature-output-gateway.mjs')`,
          `expectCjsPathNotExported('${packageName}/lib/wasm/markdown-feature-output-gateway.js')`,
          `expectCjsPathNotExported('${packageName}/lib/wasm/%6darkdown-feature-output-gateway.js')`,
          `expectCjsPathNotExported('${packageName}/lib/%77asm/markdown-feature-output-gateway.js')`,
          `await expectEsmMissingInternalPath('${packageName}/es/components/markdown-renderer/src/markdown-renderer-cache')`,
          `expectCjsMissingInternalPath('${packageName}/lib/components/markdown-renderer/src/markdown-renderer-cache', 'lib/components/markdown-renderer/src/markdown-renderer-cache.js')`,
          `if (root.FsusDataList?.name !== 'FsusDataList') throw new Error('FsusDataList runtime export drifted')`,
          `if (rootCjs.FsusDataList?.name !== 'FsusDataList') throw new Error('FsusDataList CJS runtime export drifted')`,
          `if (typeof wasm.ensureWasmReady !== 'function' || typeof wasmCjs.ensureWasmReady !== 'function') throw new Error('Wasm public entry resolution drifted')`,
          `if (typeof markdownRuntime.activateMarkdownFeatures !== 'function' || typeof markdownRuntimeCjs.activateMarkdownFeatures !== 'function') throw new Error('Markdown runtime public entry resolution drifted')`,
          `if (typeof renderPipeline !== 'object' || typeof theme !== 'object' || typeof icons !== 'object') throw new Error('Public render/theme/icon export drifted')`,
          `for (const css of ['dist/fsus.css', 'dist/index.css', 'dist/public-shell-critical.css', 'theme-chalk/base.css']) if (!import.meta.resolve('${packageName}/' + css)) throw new Error('Public CSS export drifted: ' + css)`,
          `if (!componentEntry.ElButton || !componentEntryCjs.ElButton || !componentEntryWithExtension.ElButton || !componentEntryCjsWithExtension.ElButton) throw new Error('Documented component compatibility path drifted')`,
          `if (localeLang.default?.name !== 'en' || localeLangCjs.default?.name !== 'en') throw new Error('Documented locale compatibility path drifted')`,
          `if (motion.FsuTransition?.name !== 'FsuTransition') throw new Error('FsuTransition runtime export drifted')`,
          `if (perception.FsusPerceptionChallenge?.name !== 'FsusPerceptionChallenge') throw new Error('FsusPerceptionChallenge runtime export drifted')`,
          `if (perception.FsusPerceptionCharacterChallenge?.name !== 'FsusPerceptionCharacterChallenge') throw new Error('FsusPerceptionCharacterChallenge runtime export drifted')`,
          `console.log('Consumer runtime export and Markdown authority contract passed.')`,
        ].join(';'),
      ],
      { cwd: fixtureRoot },
    )
  })
  stage('ssr', () => {
    run(
      'node',
      [
        '--input-type=module',
        '--eval',
        [
          `import { createSSRApp, h } from 'vue'`,
          `import { renderToString } from 'vue/server-renderer'`,
          `import { ElButton } from '${packageName}'`,
          `const html = await renderToString(createSSRApp({ render: () => h(ElButton, null, () => 'SSR') }))`,
          `if (!html.includes('SSR')) throw new Error('SSR render output is missing')`,
        ].join(';'),
      ],
      { cwd: fixtureRoot },
    )
  })
  const markdownTypeProbe = path.join(
    fixtureRoot,
    'src',
    'markdown-safe-html.ts',
  )
  writeFileSync(
    markdownTypeProbe,
    [
      `import type { MarkdownSafeHtml as WasmSafeHtml } from '${packageName}/wasm'`,
      `import type { MarkdownSafeHtml as RuntimeSafeHtml } from '${packageName}/markdown-runtime'`,
      `import type { MarkdownRendererProps } from '${packageName}'`,
      `// @ts-expect-error legacy DOM-mutating feature adapters are removed`,
      `import type { MarkdownFeatureAdapter } from '${packageName}/markdown-runtime'`,
      `// @ts-expect-error internal Markdown feature output gateway is blocked by package exports`,
      `import type { FeatureRenderOutput } from '${packageName}/es/wasm/markdown-feature-output-gateway'`,
      `declare const wasmSafe: WasmSafeHtml`,
      `declare const rendererProps: MarkdownRendererProps`,
      `const runtimeSafe: RuntimeSafeHtml = wasmSafe`,
      `void runtimeSafe`,
      `// @ts-expect-error Mermaid adapter prop is removed`,
      `rendererProps.mermaidAdapter`,
      `// @ts-expect-error LaTeX adapter prop is removed`,
      `rendererProps.latexAdapter`,
      `// @ts-expect-error code highlight adapter prop is removed`,
      `rendererProps.codeHighlightAdapter`,
      `// @ts-expect-error plain strings must never satisfy the published safe HTML brand`,
      `const unsafe: RuntimeSafeHtml = '<p>unsafe</p>'`,
      `void unsafe`,
      ``,
    ].join('\n'),
  )
  stage('typecheck', () => {
    run(packageManager, execArgs('vue-tsc', ['--noEmit']), {
      cwd: fixtureRoot,
    })
  })
  const viteOutput = stage('build', () =>
    runAndCollect(packageManager, execArgs('vite', ['build']), {
      cwd: fixtureRoot,
    }),
  )
  assertNoConsumerBuildWarnings(viteOutput)
  const artifactEvidence = stage('worker', inspectProductionArtifacts)
  statuses.wasm = 'passed'
  durationsMs.wasm = durationsMs.worker
  const performanceGraph = reportConsumerPerformanceGraph(fixtureRoot)
  const budgets = stage('bundle', () =>
    assertConsumerPerformanceGraph(performanceGraph),
  )
  validateConsumerBuildEvidence({
    dependencyVersions: Object.fromEntries(
      Object.entries(dependencyVersions).map(([id, version]) => [
        id,
        [version],
      ]),
    ),
    emittedText: '',
    files: collectFiles(path.join(fixtureRoot, 'dist')),
    markdownLazy: true,
    privateExportAccessible: false,
    ssrBrowserGlobalAccess: false,
    ...artifactEvidence,
  })

  if (candidateTarballPath && candidateManifest) {
    const postInstallSha256 = sha256File(candidateTarballPath)
    if (postInstallSha256 !== candidateManifest.artifact.sha256) {
      throw new Error(
        'Candidate tarball was mutated during consumer install; profiles must consume the candidate read-only.',
      )
    }
  }

  const toolchain = {
    node: process.version.replace(/^v/u, ''),
    vue: installedVersion('vue'),
    vite: installedVersion('vite'),
    typescript: installedVersion('typescript'),
    vueTsc: installedVersion('vue-tsc'),
  }
  const receipt = {
    schema: consumerProfileSchema,
    profile: consumerProfile.name,
    candidate: {
      name: distPackage.name,
      version: distPackage.version,
      sha256: candidateManifest.artifact.sha256,
    },
    packageManager: {
      name: packageManager,
      version: execFileSync(packageManager, ['--version'], {
        encoding: 'utf8',
      }).trim(),
    },
    toolchain,
    statuses,
    durationsMs,
    budgets,
    artifacts: artifactEvidence,
    digests: {
      authority: authorityDigest,
      profile: consumerProfile.digest,
      config: consumerMatrixConfigDigest(repoRoot),
    },
    fixturePath:
      checkpointFixturePath || keepConsumerFixture ? fixtureRoot : null,
  }
  if (resultPath) {
    mkdirSync(path.dirname(resultPath), { recursive: true })
    writeFileSync(resultPath, `${JSON.stringify(receipt, null, 2)}\n`)
  }

  console.log(
    `Consumer profile ${consumerProfile.name} passed for ${packageName} from candidate ${candidateManifest.artifact.sha256}.`,
  )
} finally {
  if (checkpointFixturePath) {
    console.log(`Consumer checkpoint preserved at ${fixtureRoot}.`)
  } else if (keepConsumerFixture) {
    console.log(`Consumer fixture retained at ${fixtureRoot}.`)
  } else {
    rmSync(tempRoot, { force: true, recursive: true })
  }
}

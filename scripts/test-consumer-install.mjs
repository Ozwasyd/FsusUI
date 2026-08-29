import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'
import { resolvePackageContract } from './npm-package-contract.mjs'
import { packedMarkdownRuntimeProjectionProbe } from './packed-markdown-runtime-probe.mjs'
import {
  candidateTarballName,
  readCandidatePackageJson,
  sha256File,
  verifyCandidate,
} from './npm-candidate-lib.mjs'
import { parseConsumerInstallArgs } from './consumer-install-args.mjs'

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
const defaultCandidatePath = path.join(
  repoRoot,
  'dist',
  'npm-candidate',
  candidateTarballName,
)
const requestedFlags = process.argv
  .slice(2)
  .some((argument) => argument === '--profile' || argument === '--candidate')
const parsedInstallArgs = requestedFlags
  ? parseConsumerInstallArgs(process.argv.slice(2), process.env)
  : undefined
const candidateArgument = parsedInstallArgs
  ? parsedInstallArgs.candidate
  : process.argv.slice(2).find((argument) => argument !== '--')
const candidateTarballPath = candidateArgument
  ? path.resolve(candidateArgument)
  : process.env.FSUSUI_NPM_CANDIDATE
    ? path.resolve(process.env.FSUSUI_NPM_CANDIDATE)
    : existsSync(defaultCandidatePath)
      ? defaultCandidatePath
      : undefined
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

if (!candidateTarballPath && !existsSync(distPackagePath)) {
  throw new Error(
    'Missing dist/element-plus/package.json. Run `pnpm run build:npm-package` before `pnpm test:consumer-install`.',
  )
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
}

const tempRoot = checkpointFixturePath
  ? null
  : mkdtempSync(path.join(os.tmpdir(), 'fsusui-consumer-'))
const fixtureRoot = checkpointFixturePath
  ? path.resolve(checkpointFixturePath)
  : path.join(tempRoot, 'fixture')
const artifactsRoot = tempRoot ? path.join(tempRoot, 'artifacts') : null

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

    let tarballPath = candidateTarballPath
    if (!tarballPath) {
      const packOutput = execFileSync(
        resolveExecutable('npm'),
        ['pack', '--silent', '--pack-destination', artifactsRoot],
        withCommandOptions({
          cwd: distRoot,
          encoding: 'utf8',
        }),
      )

      const tarballName = packOutput.trim().split(/\r?\n/u).at(-1)
      if (!tarballName) {
        throw new Error('npm pack did not return a tarball filename.')
      }
      tarballPath = path.join(artifactsRoot, tarballName)
    }

    run('pnpm', ['install', '--no-frozen-lockfile'], { cwd: fixtureRoot })
    run('pnpm', ['add', tarballPath], { cwd: fixtureRoot })
  } else {
    if (!existsSync(path.join(fixtureRoot, 'node_modules'))) {
      throw new Error(
        `Consumer checkpoint has no installed dependencies: ${fixtureRoot}`,
      )
    }
    console.log(`Consumer verification resumed from ${fixtureRoot}.`)
  }
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
  run(
    'node',
    [
      path.join(repoRoot, 'scripts', 'with-node-heap.mjs'),
      'pnpm',
      'exec',
      'vue-tsc',
      '--noEmit',
    ],
    {
      cwd: fixtureRoot,
      env: {
        FSUS_NODE_HEAP_PROFILE: 'typecheck',
        NODE_OPTIONS: '',
      },
    },
  )
  const viteOutput = runAndCollect(
    'node',
    [
      path.join(repoRoot, 'scripts', 'with-node-heap.mjs'),
      'pnpm',
      'exec',
      'vite',
      'build',
    ],
    {
      cwd: fixtureRoot,
      env: {
        FSUS_NODE_HEAP_PROFILE: 'build',
        NODE_OPTIONS: '',
      },
    },
  )
  const performanceGraph = reportConsumerPerformanceGraph(fixtureRoot)
  assertNoConsumerBuildWarnings(viteOutput)
  assertConsumerPerformanceGraph(performanceGraph)

  if (candidateTarballPath && candidateManifest) {
    const postInstallSha256 = sha256File(candidateTarballPath)
    if (postInstallSha256 !== candidateManifest.artifact.sha256) {
      throw new Error(
        'Candidate tarball was mutated during consumer install; profiles must consume the candidate read-only.',
      )
    }
  }

  if (artifactsRoot) {
    writeFileSync(
      path.join(artifactsRoot, 'consumer-install-receipt.json'),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          candidate: candidateManifest
            ? {
                filename: candidateManifest.artifact.filename,
                sha256: candidateManifest.artifact.sha256,
              }
            : null,
          profile: parsedInstallArgs?.profile ?? null,
          fixture: {
            path: fixtureRoot,
            packageName,
            packageVersion: distPackage.version,
          },
        },
        null,
        2,
      )}\n`,
    )
  }

  console.log(
    `Consumer install smoke passed for ${packageName}${candidateManifest ? ` from candidate ${candidateManifest.artifact.sha256}` : ''}.`,
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

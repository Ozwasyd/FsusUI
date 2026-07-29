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
import {
  candidateTarballName,
  readCandidatePackageJson,
  verifyCandidate,
} from './npm-candidate-lib.mjs'

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
const candidateArgument = process.argv
  .slice(2)
  .find((argument) => argument !== '--')
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
      [
        `import { createRequire } from 'node:module'`,
        `const root = await import('${packageName}')`,
        `const wasm = await import('${packageName}/wasm')`,
        `const markdownRuntime = await import('${packageName}/markdown-runtime')`,
        `const motion = await import('${packageName}/motion')`,
        `const perception = await import('${packageName}/perception-challenge')`,
        `const require = createRequire(import.meta.url)`,
        `const forbiddenAuthorityBuilders = ['authorizeMarkdownRuntimeResult', 'brandMarkdownSafeHtml', 'brandMarkdownSafeRenderResult']`,
        `for (const [surface, exports] of [['root', root], ['wasm', wasm], ['markdown-runtime', markdownRuntime]]) for (const name of forbiddenAuthorityBuilders) if (name in exports) throw new Error(surface + ' exposes forbidden Markdown authority builder ' + name)`,
        `await import('${packageName}/es/wasm/markdown-safe.mjs').then(() => { throw new Error('ES deep import exposed Markdown authority builders') }, () => undefined)`,
        `try { require('${packageName}/lib/wasm/markdown-safe.js'); throw new Error('CJS deep import exposed Markdown authority builders') } catch (error) { if (error instanceof Error && error.message === 'CJS deep import exposed Markdown authority builders') throw error }`,
        `await import('${packageName}/es/components/markdown-renderer/src/markdown-renderer-cache.mjs').then(() => { throw new Error('ES deep import exposed caller-writable Markdown cache') }, () => undefined)`,
        `try { require('${packageName}/lib/components/markdown-renderer/src/markdown-renderer-cache.js'); throw new Error('CJS deep import exposed caller-writable Markdown cache') } catch (error) { if (error instanceof Error && error.message === 'CJS deep import exposed caller-writable Markdown cache') throw error }`,
        `if (root.FsusDataList?.name !== 'FsusDataList') throw new Error('FsusDataList runtime export drifted')`,
        `if (motion.FsuTransition?.name !== 'FsuTransition') throw new Error('FsuTransition runtime export drifted')`,
        `if (perception.FsusPerceptionChallenge?.name !== 'FsusPerceptionChallenge') throw new Error('FsusPerceptionChallenge runtime export drifted')`,
        `if (perception.FsusPerceptionCharacterChallenge?.name !== 'FsusPerceptionCharacterChallenge') throw new Error('FsusPerceptionCharacterChallenge runtime export drifted')`,
        `console.log('Consumer runtime export and Markdown authority contract passed.')`,
      ].join(';'),
    ],
    { cwd: fixtureRoot },
  )
  const markdownTypeProbe = path.join(fixtureRoot, 'src', 'markdown-safe-html.ts')
  writeFileSync(
    markdownTypeProbe,
    [
      `import type { MarkdownSafeHtml as WasmSafeHtml } from '${packageName}/wasm'`,
      `import type { MarkdownSafeHtml as RuntimeSafeHtml } from '${packageName}/markdown-runtime'`,
      `declare const wasmSafe: WasmSafeHtml`,
      `const runtimeSafe: RuntimeSafeHtml = wasmSafe`,
      `void runtimeSafe`,
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
  const viteOutput = runAndCollect('pnpm', ['exec', 'vite', 'build'], {
    cwd: fixtureRoot,
  })
  const performanceGraph = reportConsumerPerformanceGraph(fixtureRoot)
  assertNoConsumerBuildWarnings(viteOutput)
  assertConsumerPerformanceGraph(performanceGraph)

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

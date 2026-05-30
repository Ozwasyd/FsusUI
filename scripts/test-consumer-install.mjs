import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolvePackageContract } from './github-package-contract.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const templateRoot = path.join(
  repoRoot,
  'tests',
  'consumer-install',
  'template',
)
const distRoot = path.join(repoRoot, 'dist', 'element-plus')
const distPackagePath = path.join(distRoot, 'package.json')
const sourcePackagePath = path.join(
  repoRoot,
  'packages',
  'element-plus',
  'package.json',
)
const viteChunkHelperPath = path.join(
  repoRoot,
  'scripts',
  'vite-manual-chunks.mjs',
)
const chunkBudgetBytes = 500 * 1024

if (!existsSync(distPackagePath)) {
  throw new Error(
    'Missing dist/element-plus/package.json. Run `pnpm run build:github-package` before `pnpm test:consumer-install`.',
  )
}

const sourcePackage = JSON.parse(readFileSync(sourcePackagePath, 'utf8'))
const distPackage = JSON.parse(readFileSync(distPackagePath, 'utf8'))
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
  execFileSync(command, args, {
    stdio: 'inherit',
    ...options,
  })
}

function runAndCollect(command, args, options) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    ...options,
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
      `${command} ${args.join(' ')} exited with code ${result.status ?? -1}`,
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

function collectJsChunks(root, current = root, chunks = []) {
  if (!existsSync(current)) return chunks

  for (const entry of readdirSync(current)) {
    const filePath = path.join(current, entry)
    const stats = statSync(filePath)
    if (stats.isDirectory()) {
      collectJsChunks(root, filePath, chunks)
      continue
    }

    if (/\.(?:js|mjs)$/u.test(entry)) {
      chunks.push({
        path: path.relative(root, filePath),
        size: stats.size,
      })
    }
  }

  return chunks
}

const formatSize = (bytes) => `${(bytes / 1024).toFixed(2)} KiB`

function assertConsumerChunkBudget(fixtureRoot) {
  const assetsRoot = path.join(fixtureRoot, 'dist', 'assets')
  const chunks = collectJsChunks(assetsRoot).sort((a, b) => b.size - a.size)
  const oversizedChunks = chunks.filter((chunk) => chunk.size > chunkBudgetBytes)

  if (oversizedChunks.length > 0) {
    const largestChunks = chunks
      .slice(0, 10)
      .map((chunk) => `${chunk.path} ${formatSize(chunk.size)}`)
      .join('\n')

    throw new Error(
      `Consumer Vite build exceeded the ${formatSize(chunkBudgetBytes)} JS chunk budget:\n${largestChunks}`,
    )
  }

  const largestChunk = chunks[0]
  if (largestChunk) {
    console.log(
      `Consumer JS chunk budget passed: largest=${largestChunk.path} ${formatSize(largestChunk.size)}.`,
    )
  }
}

const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'fsusui-consumer-'))
const fixtureRoot = path.join(tempRoot, 'fixture')
const artifactsRoot = path.join(tempRoot, 'artifacts')

try {
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

  const packOutput = execFileSync(
    'npm',
    ['pack', '--silent', '--pack-destination', artifactsRoot],
    {
      cwd: distRoot,
      encoding: 'utf8',
    },
  )

  const tarballName = packOutput.trim().split(/\r?\n/u).at(-1)
  if (!tarballName) {
    throw new Error('npm pack did not return a tarball filename.')
  }

  const tarballPath = path.join(artifactsRoot, tarballName)

  run('pnpm', ['install', '--no-frozen-lockfile'], { cwd: fixtureRoot })
  run('pnpm', ['add', tarballPath], { cwd: fixtureRoot })
  run('pnpm', ['exec', 'vue-tsc', '--noEmit'], { cwd: fixtureRoot })
  const viteOutput = runAndCollect('pnpm', ['exec', 'vite', 'build'], {
    cwd: fixtureRoot,
  })
  assertNoConsumerBuildWarnings(viteOutput)
  assertConsumerChunkBudget(fixtureRoot)

  console.log(`Consumer install smoke passed for ${packageName}.`)
} finally {
  rmSync(tempRoot, { force: true, recursive: true })
}

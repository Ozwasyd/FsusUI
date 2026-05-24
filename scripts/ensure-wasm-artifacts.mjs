import { access, readFile, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'

const root = process.cwd()
const force =
  process.env.FORCE_REBUILD === '1' || process.argv.includes('--force')
const dryRun = process.argv.includes('--dry-run')

const requiredArtifacts = [
  resolve(root, 'packages/wasm/dist/index.mjs'),
  resolve(root, 'packages/wasm/dist/index.cjs'),
  resolve(root, 'packages/wasm/dist/index.d.ts'),
  resolve(root, 'packages/wasm/dist/index.d.mts'),
  resolve(root, 'packages/wasm/dist/index.d.cts'),
  resolve(root, 'packages/wasm/dist/ep_wasm.mjs'),
  resolve(root, 'packages/wasm/dist/ep_wasm.wasm'),
  resolve(root, 'packages/wasm/dist/markdown_basic.js'),
  resolve(root, 'packages/wasm/dist/markdown_basic.wasm'),
  resolve(root, 'packages/wasm/dist/markdown_simd.js'),
  resolve(root, 'packages/wasm/dist/markdown_simd.wasm'),
]
const fingerprintPath = resolve(
  root,
  'packages/wasm/dist/.artifact-fingerprint',
)
const fingerprintInputs = [
  'packages/wasm/package.json',
  'packages/wasm/build.config.ts',
  'packages/wasm/build.sh',
  'packages/wasm/CMakeLists.txt',
  'packages/wasm/index.ts',
  'packages/wasm/markdown.ts',
  'packages/wasm/markdown-runtime.ts',
  'packages/wasm/runtime/assets.ts',
  'packages/wasm/runtime/emscripten.ts',
  'packages/wasm/runtime/serialized.ts',
  'packages/wasm/runtime/utf8.ts',
  'packages/wasm/markdown/CMakeLists.txt',
  'packages/wasm/markdown/include/markdown_contract.hpp',
  'packages/wasm/markdown/src/markdown_contract.cpp',
  'packages/wasm/markdown/src/markdown_exports.cpp',
  'packages/wasm/markdown/src/markdown_latex.cpp',
  'packages/wasm/markdown/src/markdown_latex.hpp',
  'packages/wasm/markdown/src/markdown_mermaid.cpp',
  'packages/wasm/markdown/src/markdown_mermaid.hpp',
  'packages/wasm/src/ep_wasm.cpp',
].map((file) => resolve(root, file))

const hashInputs = async () => {
  const hash = createHash('sha256')
  for (const file of fingerprintInputs) {
    hash.update(file)
    hash.update(await readFile(file))
  }
  return hash.digest('hex')
}

const toRelativePath = (file) => file.replace(`${root}/`, '')

const exists = async (file) => {
  try {
    await access(file, constants.F_OK)
    return true
  } catch {
    return false
  }
}

const getMissingArtifacts = async () => {
  const checks = await Promise.all(
    requiredArtifacts.map(async (artifact) => ({
      artifact,
      exists: await exists(artifact),
    })),
  )

  return checks.filter((check) => !check.exists).map((check) => check.artifact)
}

const run = (command, args) =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })

    child.on('error', rejectPromise)
    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise()
        return
      }

      rejectPromise(
        new Error(
          `${command} ${args.join(' ')} exited with code ${code ?? -1}`,
        ),
      )
    })
  })

const currentFingerprint = await hashInputs()
let cachedFingerprint = null
try {
  cachedFingerprint = (await readFile(fingerprintPath, 'utf8')).trim()
} catch {
  // cache miss
}

const missingArtifacts = await getMissingArtifacts()
const staleReasons = []

if (force) {
  staleReasons.push('force rebuild requested')
}

if (missingArtifacts.length > 0) {
  staleReasons.push(
    `missing artifacts: ${missingArtifacts.map(toRelativePath).join(', ')}`,
  )
}

if (cachedFingerprint === null) {
  staleReasons.push('artifact fingerprint is missing')
} else if (cachedFingerprint !== currentFingerprint) {
  staleReasons.push('artifact fingerprint changed')
}

if (staleReasons.length > 0) {
  if (dryRun) {
    console.info(
      [
        '[ensure-wasm] Artifacts are stale or missing; dry-run skipped rebuild.',
        ...staleReasons.map((reason) => `  - ${reason}`),
      ].join('\n'),
    )
    process.exit(0)
  }
  console.info(
    [
      '[ensure-wasm] Building stale or missing packages/wasm artifacts...',
      ...staleReasons.map((reason) => `  - ${reason}`),
    ].join('\n'),
  )
  await run('pnpm', ['run', '_build:wasm:artifacts'])
  await writeFile(fingerprintPath, `${currentFingerprint}\n`)
} else {
  console.info('[ensure-wasm] Reusing existing packages/wasm/dist artifacts.')
}

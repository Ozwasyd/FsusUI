import { access, readFile, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'

const root = process.cwd()
const force =
  process.env.FORCE_REBUILD === '1' || process.argv.includes('--force')
const dryRun = process.argv.includes('--dry-run')

const bundleArtifacts = [
  resolve(root, 'packages/wasm/dist/index.mjs'),
  resolve(root, 'packages/wasm/dist/index.cjs'),
  resolve(root, 'packages/wasm/dist/index.d.ts'),
  resolve(root, 'packages/wasm/dist/index.d.mts'),
  resolve(root, 'packages/wasm/dist/index.d.cts'),
]
const nativeArtifacts = [
  resolve(root, 'packages/wasm/dist/ep_wasm.mjs'),
  resolve(root, 'packages/wasm/dist/ep_wasm.wasm'),
  resolve(root, 'packages/wasm/dist/markdown_basic.js'),
  resolve(root, 'packages/wasm/dist/markdown_basic.wasm'),
  resolve(root, 'packages/wasm/dist/markdown_simd.js'),
  resolve(root, 'packages/wasm/dist/markdown_simd.wasm'),
]
const bundleFingerprintPath = resolve(
  root,
  'packages/wasm/dist/.artifact-fingerprint',
)
const nativeFingerprintPath = resolve(
  root,
  'packages/wasm/dist/.native-artifact-fingerprint',
)
const bundleFingerprintInputs = [
  'packages/wasm/package.json',
  'packages/wasm/build.config.ts',
  'packages/wasm/index.ts',
  'packages/wasm/markdown.ts',
  'packages/wasm/markdown-runtime.ts',
  'packages/wasm/runtime/assets.ts',
  'packages/wasm/runtime/emscripten.ts',
  'packages/wasm/runtime/serialized.ts',
  'packages/wasm/runtime/utf8.ts',
].map((file) => resolve(root, file))
const nativeFingerprintInputs = [
  'packages/wasm/build.sh',
  'packages/wasm/CMakeLists.txt',
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

const hashInputs = async (inputs) => {
  const hash = createHash('sha256')
  for (const file of inputs) {
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

const getMissingArtifacts = async (artifacts) => {
  const checks = await Promise.all(
    artifacts.map(async (artifact) => ({
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

const readFingerprint = async (file) => {
  try {
    return (await readFile(file, 'utf8')).trim()
  } catch {
    return null
  }
}

const currentBundleFingerprint = await hashInputs(bundleFingerprintInputs)
const currentNativeFingerprint = await hashInputs(nativeFingerprintInputs)
const cachedBundleFingerprint = await readFingerprint(bundleFingerprintPath)
const cachedNativeFingerprint = await readFingerprint(nativeFingerprintPath)
const missingBundleArtifacts = await getMissingArtifacts(bundleArtifacts)
const missingNativeArtifacts = await getMissingArtifacts(nativeArtifacts)
const bundleStaleReasons = []
const nativeStaleReasons = []
let shouldWriteNativeFingerprint = false
let rebuiltBundleArtifacts = false

if (force) {
  nativeStaleReasons.push('force rebuild requested')
  bundleStaleReasons.push('force rebuild requested')
}

if (missingNativeArtifacts.length > 0) {
  nativeStaleReasons.push(
    `missing native artifacts: ${missingNativeArtifacts
      .map(toRelativePath)
      .join(', ')}`,
  )
}

if (cachedNativeFingerprint === null) {
  if (missingNativeArtifacts.length > 0 || force) {
    nativeStaleReasons.push('native artifact fingerprint is missing')
  } else {
    shouldWriteNativeFingerprint = true
  }
} else if (cachedNativeFingerprint !== currentNativeFingerprint) {
  nativeStaleReasons.push('native artifact fingerprint changed')
}

if (missingBundleArtifacts.length > 0) {
  bundleStaleReasons.push(
    `missing bundle artifacts: ${missingBundleArtifacts
      .map(toRelativePath)
      .join(', ')}`,
  )
}

if (cachedBundleFingerprint === null) {
  bundleStaleReasons.push('bundle artifact fingerprint is missing')
} else if (cachedBundleFingerprint !== currentBundleFingerprint) {
  bundleStaleReasons.push('bundle artifact fingerprint changed')
}

if (nativeStaleReasons.length > 0) {
  if (dryRun) {
    console.info(
      [
        '[ensure-wasm] Native artifacts are stale or missing; dry-run skipped rebuild.',
        ...nativeStaleReasons.map((reason) => `  - ${reason}`),
      ].join('\n'),
    )
    process.exit(0)
  }
  console.info(
    [
      '[ensure-wasm] Building stale or missing packages/wasm native artifacts...',
      ...nativeStaleReasons.map((reason) => `  - ${reason}`),
    ].join('\n'),
  )
  await run('pnpm', ['run', '_build:wasm:artifacts'])
  await writeFile(bundleFingerprintPath, `${currentBundleFingerprint}\n`)
  await writeFile(nativeFingerprintPath, `${currentNativeFingerprint}\n`)
  process.exit(0)
}

if (bundleStaleReasons.length > 0) {
  if (dryRun) {
    console.info(
      [
        '[ensure-wasm] Bundle artifacts are stale or missing; dry-run skipped rebuild.',
        ...bundleStaleReasons.map((reason) => `  - ${reason}`),
      ].join('\n'),
    )
    process.exit(0)
  }
  console.info(
    [
      '[ensure-wasm] Building stale or missing packages/wasm bundle artifacts...',
      ...bundleStaleReasons.map((reason) => `  - ${reason}`),
    ].join('\n'),
  )
  await run('pnpm', ['run', '-C', 'packages/wasm', 'build'])
  await writeFile(bundleFingerprintPath, `${currentBundleFingerprint}\n`)
  rebuiltBundleArtifacts = true
}

if (shouldWriteNativeFingerprint && !dryRun) {
  await writeFile(nativeFingerprintPath, `${currentNativeFingerprint}\n`)
}

console.info(
  rebuiltBundleArtifacts
    ? '[ensure-wasm] packages/wasm/dist artifacts are ready.'
    : '[ensure-wasm] Reusing existing packages/wasm/dist artifacts.',
)

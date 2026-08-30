import { spawn } from 'node:child_process'
import {
  artifactGroups,
  inspectArtifactGroup,
  root,
  toRelativePath,
  writeFingerprint,
} from './test-artifact-cache.mjs'

const force =
  process.env.FORCE_REBUILD === '1' || process.argv.includes('--force')
const dryRun = process.argv.includes('--dry-run')
const group = artifactGroups.wasm

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

const status = await inspectArtifactGroup(group)
const bundle = status.fingerprints.find(
  (fingerprint) => fingerprint.id === 'bundle',
)
const native = status.fingerprints.find(
  (fingerprint) => fingerprint.id === 'native',
)

if (!bundle || !native) {
  console.error(
    '[ensure-wasm] internal artifact policy is missing fingerprints',
  )
  process.exit(1)
}

const bundleStaleReasons = []
const nativeStaleReasons = []
let shouldWriteNativeFingerprint = false
let rebuiltBundleArtifacts = false

if (force) {
  nativeStaleReasons.push('force rebuild requested')
  bundleStaleReasons.push('force rebuild requested')
}

if (native.missingArtifacts.length > 0) {
  nativeStaleReasons.push(
    `missing native artifacts: ${native.missingArtifacts
      .map(toRelativePath)
      .join(', ')}`,
  )
}

if (native.cachedFingerprint === null) {
  if (native.missingArtifacts.length > 0 || force) {
    nativeStaleReasons.push('native artifact fingerprint is missing')
  } else {
    shouldWriteNativeFingerprint = true
  }
} else if (native.cachedFingerprint !== native.currentFingerprint) {
  nativeStaleReasons.push('native artifact fingerprint changed')
} else if (native.cachedArtifactFingerprint === null) {
  nativeStaleReasons.push('native artifact integrity fingerprint is missing')
} else if (
  native.cachedArtifactFingerprint !== native.currentArtifactFingerprint
) {
  nativeStaleReasons.push('native artifact contents changed')
}

if (bundle.missingArtifacts.length > 0) {
  bundleStaleReasons.push(
    `missing bundle artifacts: ${bundle.missingArtifacts
      .map(toRelativePath)
      .join(', ')}`,
  )
}

if (bundle.cachedFingerprint === null) {
  bundleStaleReasons.push('bundle artifact fingerprint is missing')
} else if (bundle.cachedFingerprint !== bundle.currentFingerprint) {
  bundleStaleReasons.push('bundle artifact fingerprint changed')
} else if (bundle.cachedArtifactFingerprint === null) {
  bundleStaleReasons.push('bundle artifact integrity fingerprint is missing')
} else if (
  bundle.cachedArtifactFingerprint !== bundle.currentArtifactFingerprint
) {
  bundleStaleReasons.push('bundle artifact contents changed')
}

if (nativeStaleReasons.length > 0) {
  if (dryRun) {
    console.info(
      [
        `[ensure-wasm] cache-miss source-hash=${status.sourceHash.slice(
          0,
          16,
        )}; native artifacts are stale or missing; dry-run skipped rebuild.`,
        ...nativeStaleReasons.map((reason) => `  - ${reason}`),
      ].join('\n'),
    )
    process.exit(0)
  }
  console.info(
    [
      `[ensure-wasm] ${
        force ? 'force rebuild requested' : 'cache-miss'
      } source-hash=${status.sourceHash.slice(
        0,
        16,
      )}; building vue/packages/wasm native artifacts...`,
      ...nativeStaleReasons.map((reason) => `  - ${reason}`),
    ].join('\n'),
  )
  await run('pnpm', ['run', '_build:wasm:artifacts'])
  await writeFingerprint(bundle)
  await writeFingerprint(native)
  process.exit(0)
}

if (bundleStaleReasons.length > 0) {
  if (dryRun) {
    console.info(
      [
        `[ensure-wasm] cache-miss source-hash=${status.sourceHash.slice(
          0,
          16,
        )}; bundle artifacts are stale or missing; dry-run skipped rebuild.`,
        ...bundleStaleReasons.map((reason) => `  - ${reason}`),
      ].join('\n'),
    )
    process.exit(0)
  }
  console.info(
    [
      `[ensure-wasm] ${
        force ? 'force rebuild requested' : 'cache-miss'
      } source-hash=${status.sourceHash.slice(
        0,
        16,
      )}; building vue/packages/wasm bundle artifacts...`,
      ...bundleStaleReasons.map((reason) => `  - ${reason}`),
    ].join('\n'),
  )
  await run('pnpm', ['run', '-C', 'vue/packages/wasm', 'build'])
  await writeFingerprint(bundle)
  rebuiltBundleArtifacts = true
}

if (shouldWriteNativeFingerprint && !dryRun) {
  await writeFingerprint(native)
}

console.info(
  rebuiltBundleArtifacts
    ? '[ensure-wasm] vue/packages/wasm/dist artifacts are ready.'
    : `[ensure-wasm] cache-hit source-hash=${status.sourceHash.slice(
        0,
        16,
      )}; reusing vue/packages/wasm/dist artifacts.`,
)

import { spawn } from 'node:child_process'
import {
  artifactGroups,
  inspectArtifactGroup,
  root,
  toRelativePath,
  writeArtifactDigest,
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
}

if (bundle.cachedArtifactDigest === null) {
  bundleStaleReasons.push('bundle artifact content digest is missing')
} else if (bundle.cachedArtifactDigest !== bundle.currentArtifactDigest) {
  bundleStaleReasons.push('bundle artifact content digest changed')
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
  await writeFingerprint(bundle.fingerprintPath, bundle.currentFingerprint)
  await writeArtifactDigest(
    group.fingerprints.find(({ id }) => id === 'bundle'),
  )
  await writeFingerprint(native.fingerprintPath, native.currentFingerprint)
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
  await writeFingerprint(bundle.fingerprintPath, bundle.currentFingerprint)
  await writeArtifactDigest(
    group.fingerprints.find(({ id }) => id === 'bundle'),
  )
  rebuiltBundleArtifacts = true
}

if (shouldWriteNativeFingerprint && !dryRun) {
  await writeFingerprint(native.fingerprintPath, native.currentFingerprint)
}

console.info(
  rebuiltBundleArtifacts
    ? '[ensure-wasm] vue/packages/wasm/dist artifacts are ready.'
    : `[ensure-wasm] cache-hit source-hash=${status.sourceHash.slice(
        0,
        16,
      )}; reusing vue/packages/wasm/dist artifacts.`,
)

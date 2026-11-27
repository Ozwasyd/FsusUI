import {
  artifactGroups,
  inspectArtifactGroup,
  runArtifactCommand,
  writeArtifactDigest,
  writeFingerprint,
} from './test-artifact-cache.mjs'

const force =
  process.env.FORCE_REBUILD === '1' || process.argv.includes('--force')
const dryRun = process.argv.includes('--dry-run')
const group = artifactGroups.wasm

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

// Native artifacts distributed without a fingerprint can seed it without a rebuild.
const shouldSeedNative =
  !force &&
  native.cachedFingerprint === null &&
  native.missingArtifacts.length === 0
const rebuildNative = force || (!shouldSeedNative && !native.fresh)
const rebuildBundle = !bundle.fresh
const sourceHash = status.sourceHash.slice(0, 16)

if (rebuildNative || rebuildBundle) {
  const component = rebuildNative ? 'native' : 'bundle'
  const staleReasons = (rebuildNative ? native : bundle).staleReasons
  const forceReason = 'force rebuild requested'
  const action = dryRun
    ? `${component} artifacts are stale or missing; dry-run skipped rebuild.`
    : `building vue/packages/wasm ${component} artifacts...`
  console.info(
    [
      `[ensure-wasm] ${force && !dryRun ? forceReason : 'cache-miss'} source-hash=${sourceHash}; ${action}`,
      ...(force ? [`  - ${forceReason}`] : []),
      ...staleReasons.map((reason) => `  - ${reason}`),
    ].join('\n'),
  )
  if (dryRun) process.exit(0)

  const args = rebuildNative
    ? ['run', '_build:wasm:artifacts']
    : ['run', '-C', 'vue/packages/wasm', 'build']
  await runArtifactCommand('pnpm', args, {
    shell: process.platform === 'win32',
  })
  await writeFingerprint(bundle.fingerprintPath, bundle.currentFingerprint)
  await writeArtifactDigest(
    group.fingerprints.find(({ id }) => id === 'bundle'),
  )

  if (rebuildNative) {
    await writeFingerprint(native.fingerprintPath, native.currentFingerprint)
    process.exit(0)
  }
}

if (shouldSeedNative && !dryRun) {
  await writeFingerprint(native.fingerprintPath, native.currentFingerprint)
}
console.info(
  rebuildBundle
    ? '[ensure-wasm] vue/packages/wasm/dist artifacts are ready.'
    : `[ensure-wasm] cache-hit source-hash=${sourceHash}; reusing vue/packages/wasm/dist artifacts.`,
)

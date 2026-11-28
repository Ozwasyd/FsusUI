import {
  artifactGroups,
  inspectArtifactGroup,
  writeFingerprint,
} from './test-artifact-cache.mjs'

const force =
  process.env.FORCE_REBUILD === '1' || process.argv.includes('--force')
const dryRun = process.argv.includes('--dry-run')
const group = artifactGroups.icons
const status = await inspectArtifactGroup(group)
const [fingerprint] = status.fingerprints
const sourceHash = status.sourceHash.slice(0, 16)

if (fingerprint.missingArtifacts.length > 0) {
  console.error(
    `[ensure-icons] missing @fsusui/icons source artifacts: ${fingerprint.missingArtifacts.join(', ')}`,
  )
  process.exit(1)
}

if (!force && status.fresh) {
  console.log(
    `[ensure-icons] cache-hit source-hash=${sourceHash}; @fsusui/icons pure-TS source ready.`,
  )
  process.exit(0)
}

if (dryRun) {
  console.log(`[ensure-icons] dry-run source-hash=${sourceHash}.`)
  process.exit(0)
}

await writeFingerprint(
  fingerprint.fingerprintPath,
  fingerprint.currentFingerprint,
)
console.log(
  `[ensure-icons] verified pure-TS @fsusui/icons source-hash=${sourceHash}.`,
)

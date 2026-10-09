import { spawnSync } from 'node:child_process'
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  artifactGroups,
  inspectArtifactGroup,
  root,
  writeFingerprint,
} from './test-artifact-cache.mjs'

const force =
  process.env.FORCE_REBUILD === '1' || process.argv.includes('--force')
const dryRun = process.argv.includes('--dry-run')
const group = artifactGroups.icons
const status = await inspectArtifactGroup(group)

if (!force && status.fresh) {
  console.log(
    `[ensure-icons] cache-hit source-hash=${status.sourceHash.slice(
      0,
      16,
    )}; reusing vue/packages/icons-vue/dist artifacts.`,
  )
  process.exit(0)
}

if (dryRun) {
  console.log(
    [
      `[ensure-icons] ${
        force ? 'force rebuild requested' : 'cache-miss'
      } source-hash=${status.sourceHash.slice(0, 16)}; dry-run skipped rebuild.`,
      ...status.staleReasons.map((reason) => `  - ${reason}`),
    ].join('\n'),
  )
  process.exit(0)
}

console.log(
  [
    `[ensure-icons] ${
      force ? 'force rebuild requested' : 'cache-miss'
    } source-hash=${status.sourceHash.slice(
      0,
      16,
    )}; rebuilding icons-vue artifacts.`,
    ...status.staleReasons.map((reason) => `  - ${reason}`),
  ].join('\n'),
)

const runBuild = (script) => {
  const build = spawnSync(
    'pnpm',
    ['run', '-C', 'vue/packages/icons-vue', script],
    {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    },
  )

  if (build.status !== 0) process.exit(build.status ?? 1)
}

const [policy] = group.fingerprints
await rm(resolve(root, policy.fingerprintPath), { force: true })

// Generation can update tracked aliases; compilation must use that stable tree.
runBuild('build:generate')
const generated = await inspectArtifactGroup(group)
runBuild('build')
const built = await inspectArtifactGroup(group)
const [fingerprint] = built.fingerprints

if (built.sourceHash !== generated.sourceHash) {
  throw new Error(
    '[ensure-icons] inputs changed during build; fingerprint not written',
  )
}
if (fingerprint.missingArtifacts.length > 0) {
  throw new Error(
    '[ensure-icons] build left required artifacts missing; fingerprint not written',
  )
}

await writeFingerprint(
  fingerprint.fingerprintPath,
  fingerprint.currentFingerprint,
)
const ready = await inspectArtifactGroup(group)
if (!ready.fresh) {
  await rm(resolve(root, policy.fingerprintPath), { force: true })
  throw new Error(
    `[ensure-icons] artifacts are not ready: ${ready.staleReasons.join('; ')}`,
  )
}

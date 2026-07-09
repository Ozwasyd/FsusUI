import { spawnSync } from 'node:child_process'
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
const [fingerprint] = status.fingerprints

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

const build = spawnSync('pnpm', ['run', '-C', 'vue/packages/icons-vue', 'build'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

if (build.status !== 0) {
  process.exit(build.status ?? 1)
}

await writeFingerprint(fingerprint.fingerprintPath, fingerprint.currentFingerprint)

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
const sourceHash = status.sourceHash.slice(0, 16)

if (!force && status.fresh) {
  console.log(
    `[ensure-icons] cache-hit source-hash=${sourceHash}; reusing vue/packages/icons-vue/dist artifacts.`,
  )
  process.exit(0)
}

const action = dryRun
  ? 'dry-run skipped rebuild.'
  : 'rebuilding icons-vue artifacts.'
console.log(
  [
    `[ensure-icons] ${force ? 'force rebuild requested' : 'cache-miss'} source-hash=${sourceHash}; ${action}`,
    ...status.staleReasons.map((reason) => `  - ${reason}`),
  ].join('\n'),
)
if (dryRun) process.exit(0)

const build = spawnSync(
  'pnpm',
  ['run', '-C', 'vue/packages/icons-vue', 'build'],
  {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
)

if (build.status !== 0) {
  process.exit(build.status ?? 1)
}

await writeFingerprint(
  fingerprint.fingerprintPath,
  fingerprint.currentFingerprint,
)

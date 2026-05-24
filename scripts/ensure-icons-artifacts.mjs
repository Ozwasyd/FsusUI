import { access, readFile, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const root = process.cwd()
const force =
  process.env.FORCE_REBUILD === '1' || process.argv.includes('--force')
const dryRun = process.argv.includes('--dry-run')
const requiredFiles = [
  'packages/icons-vue/dist/index.js',
  'packages/icons-vue/dist/index.cjs',
  'packages/icons-vue/dist/global.js',
  'packages/icons-vue/dist/types/index.d.ts',
].map((file) => resolve(root, file))
const fingerprintPath = resolve(
  root,
  'packages/icons-vue/dist/.artifact-fingerprint',
)
const fingerprintInputs = [
  'packages/icons-vue/package.json',
  'packages/icons-vue/src/index.ts',
  'packages/icons-vue/src/global.ts',
  'packages/icons-vue/src/components/index.ts',
].map((file) => resolve(root, file))

const hashInputs = async () => {
  const hash = createHash('sha256')
  for (const file of fingerprintInputs) {
    hash.update(file)
    hash.update(await readFile(file))
  }
  return hash.digest('hex')
}

const missingFiles = []

for (const file of requiredFiles) {
  try {
    await access(file, constants.F_OK)
  } catch {
    missingFiles.push(file)
  }
}

const currentFingerprint = await hashInputs()
let cachedFingerprint = ''
try {
  cachedFingerprint = (await readFile(fingerprintPath, 'utf8')).trim()
} catch {
  // cache miss
}

if (
  !force &&
  missingFiles.length === 0 &&
  cachedFingerprint === currentFingerprint
) {
  console.log(
    '[ensure-icons] Reusing existing packages/icons-vue/dist artifacts.',
  )
  process.exit(0)
}

if (dryRun) {
  console.log(
    '[ensure-icons] Artifacts are stale or missing; dry-run skipped rebuild.',
  )
  process.exit(0)
}

console.log('[ensure-icons] Rebuilding stale or missing icons-vue artifacts.')

const build = spawnSync('pnpm', ['run', '-C', 'packages/icons-vue', 'build'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

if (build.status !== 0) {
  process.exit(build.status ?? 1)
}

await writeFile(fingerprintPath, `${currentFingerprint}\n`)

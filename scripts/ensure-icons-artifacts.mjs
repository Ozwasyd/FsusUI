import { access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const requiredFiles = [
  'packages/icons-vue/dist/index.js',
  'packages/icons-vue/dist/index.cjs',
  'packages/icons-vue/dist/global.js',
  'packages/icons-vue/dist/types/index.d.ts',
].map((file) => resolve(root, file))

const missingFiles = []

for (const file of requiredFiles) {
  try {
    await access(file, constants.F_OK)
  } catch {
    missingFiles.push(file)
  }
}

if (missingFiles.length === 0) {
  console.log('[ensure-icons] Reusing existing packages/icons-vue/dist artifacts.')
  process.exit(0)
}

console.log(
  '[ensure-icons] Missing packages/icons-vue/dist artifacts, rebuilding icons-vue workspace package.'
)

const build = spawnSync('pnpm', ['run', '-C', 'packages/icons-vue', 'build'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

if (build.status !== 0) {
  process.exit(build.status ?? 1)
}

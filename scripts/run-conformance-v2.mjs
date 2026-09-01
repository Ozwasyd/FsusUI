#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const run = (command, args) => {
  const env = { ...process.env }
  delete env.NODE_OPTIONS
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    stdio: 'inherit',
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run('pnpm', ['run', 'build:demo'])
run('pnpm', ['run', 'conformance:v2:avalonia'])
run(process.execPath, [
  'scripts/native-screen-reader-harness.mjs',
  '--skip-build',
  '--out',
  '.tmp/conformance-v2/web-a11y',
])
for (const command of ['compare', 'derive', 'readiness', 'mutations']) {
  run('pnpm', ['run', `conformance:v2:${command}`])
}
run(process.execPath, ['--test', 'tests/conformance-v2-evidence.test.mjs'])
console.log('Contract V2 real cross-framework conformance passed.')

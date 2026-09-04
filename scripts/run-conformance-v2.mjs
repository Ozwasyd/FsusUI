#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const run = (stage, command, args) => {
  console.log(`[conformance-v2] START ${stage}`)
  const env = { ...process.env }
  delete env.NODE_OPTIONS
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    const exitCode = result.status ?? 1
    console.error(`[conformance-v2] FAIL ${stage} exit=${exitCode}`)
    process.exit(exitCode)
  }
  console.log(`[conformance-v2] PASS ${stage}`)
}

run('baseline:web', 'pnpm', ['run', 'avalonia:baseline:check'])
run('baseline:avalonia', 'pnpm', ['run', 'avalonia:semantic:check'])
run('mapping:contract-v2', 'pnpm', ['run', 'contract-v2:check'])
run('mapping:negative-tests', 'pnpm', ['run', 'test:contract-v2'])
run('coverage:vue-public', 'pnpm', ['run', 'conformance:v2:vue-public'])
run('execution:web-build', 'pnpm', ['run', 'build:demo'])
run('execution:avalonia', 'pnpm', ['run', 'conformance:v2:avalonia'])
run('execution:avalonia-accessibility', 'pnpm', ['run', 'a11y:runtime'])
run('execution:web-accessibility', process.execPath, [
  'scripts/native-screen-reader-harness.mjs',
  '--skip-build',
  '--out',
  '.tmp/conformance-v2/web-a11y',
])
for (const [stage, command] of [
  ['comparison:differential', 'compare'],
  ['alignment:derive', 'derive'],
  ['readiness:stable', 'readiness'],
  ['mutation:negative', 'mutations'],
]) {
  run(stage, 'pnpm', ['run', `conformance:v2:${command}`])
}
run('evidence:negative-tests', process.execPath, [
  '--test',
  'tests/conformance-v2-evidence.test.mjs',
])
console.log('Contract V2 real cross-framework conformance passed.')

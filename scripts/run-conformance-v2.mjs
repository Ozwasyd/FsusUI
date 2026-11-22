#!/usr/bin/env node
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const run = (stage, command, args) =>
  new Promise((resolve, reject) => {
    console.log(`[conformance-v2] START ${stage}`)
    const env = { ...process.env }
    delete env.NODE_OPTIONS
    const child = spawn(command, args, {
      cwd: root,
      env,
      stdio: 'inherit',
    })
    child.once('error', (error) => {
      console.error(`[conformance-v2] FAIL ${stage} error=${error.message}`)
      reject(error)
    })
    child.once('close', (status) => {
      if (status !== 0) {
        const exitCode = status ?? 1
        console.error(`[conformance-v2] FAIL ${stage} exit=${exitCode}`)
        const error = new Error(`${stage} failed with exit code ${exitCode}`)
        error.exitCode = exitCode
        reject(error)
        return
      }
      console.log(`[conformance-v2] PASS ${stage}`)
      resolve()
    })
  })

try {
  await Promise.all([
    run('baseline:web', 'pnpm', ['run', 'avalonia:baseline:check']),
    run('baseline:avalonia', 'pnpm', ['run', 'avalonia:semantic:check']),
    run('mapping:contract-v2', 'pnpm', ['run', 'contract-v2:check']),
    run('mapping:negative-tests', 'pnpm', ['run', 'test:contract-v2']),
    run('coverage:vue-public', 'pnpm', ['run', 'conformance:v2:vue-public']),
  ])
  await Promise.all([
    (async () => {
      await run('execution:web-build', 'pnpm', ['run', 'build:demo'])
      await run('execution:web-accessibility', process.execPath, [
        'scripts/native-screen-reader-harness.mjs',
        '--skip-build',
        '--out',
        '.tmp/conformance-v2/web-a11y',
      ])
    })(),
    (async () => {
      await run('execution:avalonia', 'pnpm', ['run', 'conformance:v2:avalonia'])
      await run('execution:avalonia-accessibility', 'pnpm', ['run', 'a11y:runtime'])
    })(),
  ])
  for (const [stage, command] of [
    ['comparison:differential', 'compare'],
    ['alignment:derive', 'derive'],
    ['readiness:stable', 'readiness'],
  ]) {
    await run(stage, 'pnpm', ['run', `conformance:v2:${command}`])
  }
  await Promise.all([
    run('mutation:negative', 'pnpm', ['run', 'conformance:v2:mutations']),
    run('evidence:negative-tests', process.execPath, [
      '--test',
      'tests/conformance-v2-evidence.test.mjs',
    ]),
  ])
  console.log('Contract V2 real cross-framework conformance passed.')
} catch (error) {
  process.exit(error?.exitCode ?? 1)
}

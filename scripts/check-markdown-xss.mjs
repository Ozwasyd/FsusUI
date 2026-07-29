import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const release = process.argv.includes('--release')
const run = (label, args) =>
  new Promise((resolvePromise) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      env: process.env,
      stdio: 'inherit',
    })
    child.on('error', (error) => {
      console.error(`[markdown-xss] ${label} failed to start:`, error)
      resolvePromise(1)
    })
    child.on('exit', (code, signal) => {
      if (signal) {
        console.error(`[markdown-xss] ${label} terminated by ${signal}`)
        resolvePromise(1)
        return
      }
      resolvePromise(code ?? 1)
    })
  })

const assertPhase = async (commands, phase) => {
  const results = await Promise.all(
    commands.map(({ args, label }) => run(label, args)),
  )
  const failed = results.findIndex((code) => code !== 0)
  if (failed >= 0) {
    throw new Error(
      `[markdown-xss] ${phase} failed command=${commands[failed].label} exit=${results[failed]}`,
    )
  }
}

await assertPhase(
  [
    {
      label: 'test-artifacts',
      args: ['scripts/prepare-test-artifacts.mjs'],
    },
  ],
  'test artifact preparation',
)
await assertPhase(
  [
    {
      label: 'production-artifacts',
      args: ['scripts/prepare-markdown-xss-artifacts.mjs'],
    },
    {
      label: 'browser-fixture',
      args: ['scripts/prepare-markdown-xss-browser-fixture.mjs'],
    },
  ],
  'artifact preparation',
)
await assertPhase(
  [
    {
      label: 'source-authority',
      args: ['scripts/check-markdown-xss-static.mjs', '--source'],
    },
    {
      label: 'artifact-exclusion',
      args: ['scripts/check-markdown-xss-static.mjs', '--artifacts'],
    },
    {
      label: 'cross-surface-tests',
      args: [
        'scripts/run-markdown-xss-tests.mjs',
        ...(release ? ['--release'] : []),
      ],
    },
  ],
  'verification',
)

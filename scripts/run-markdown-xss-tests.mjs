import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const release = process.argv.includes('--release')
const commands = [
  {
    label: 'corpus+fuzz',
    args: [
      'vitest',
      'run',
      '--config',
      'vue/vitest.config.ts',
      'vue/packages/wasm/__tests__/markdown-xss-corpus.test.ts',
    ],
    env: release ? { FSUS_MARKDOWN_XSS_FUZZ_ITERATIONS: '20000' } : {},
    heap: false,
  },
  {
    label: 'ssr-no-dom',
    args: [
      'vitest',
      'run',
      '--config',
      'vue/vitest.markdown-xss-ssr.config.ts',
    ],
    env: {},
    heap: false,
  },
  {
    label: 'browser-dom',
    args: ['node', 'scripts/check-markdown-xss-browser.mjs'],
    env: {},
    heap: false,
  },
]

const run = ({ args, env, heap = true, label }) =>
  new Promise((resolvePromise) => {
    const command = heap ? process.execPath : args[0]
    const commandArgs = heap
      ? [resolve(root, 'scripts/with-node-heap.mjs'), ...args]
      : args.slice(1)
    const child = spawn(
      command,
      commandArgs,
      {
        cwd: root,
        env: { ...process.env, ...env },
        stdio: 'inherit',
      },
    )
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

const results = await Promise.all(commands.map(run))
const failed = results.findIndex((code) => code !== 0)
if (failed >= 0) {
  throw new Error(
    `[markdown-xss] ${commands[failed].label} failed with exit ${results[failed]}`,
  )
}
console.log(
  `[markdown-xss] ${release ? 'release' : 'fast'} tests OK lanes=${commands
    .map((command) => command.label)
    .join(',')}`,
)

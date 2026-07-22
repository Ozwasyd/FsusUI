import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const configs = ['vue/playwright.config.ts', 'vue/playwright.dev.config.ts']

for (const config of configs) {
  test(`loads ${config} through the Playwright TypeScript transform`, () => {
    const result = spawnSync(
      'pnpm',
      ['exec', 'playwright', 'test', `--config=${config}`, '--list'],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          FSUS_VISUAL_CPU_LIMIT: '8',
          FSUS_VISUAL_MEMORY_LIMIT_MB: '8192',
        },
        maxBuffer: 4 * 1024 * 1024,
      },
    )
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`

    assert.equal(result.error, undefined, output)
    assert.equal(result.status, 0, output)
    assert.match(output, /Total: \d+ tests? in \d+ files?/u)
    assert.doesNotMatch(output, /exports is not defined in ES module scope/u)
  })
}

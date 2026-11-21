import { defineConfig } from '@playwright/test'
import { resolveTestPort } from '../scripts/test-parallelism'

const port = resolveTestPort('FSUS_MARKDOWN_IDENTITY_PORT', 5199)

export default defineConfig({
  testDir: './tests/markdown-identity',
  testMatch: '*.spec.ts',
  outputDir: '../.tmp/markdown-identity-results',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: `pnpm exec vite build --config vue/tests/markdown-identity/vite.config.ts && pnpm exec vite preview --config vue/tests/markdown-identity/vite.config.ts --host 127.0.0.1 --port ${port} --strictPort`,
    cwd: '..',
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
})

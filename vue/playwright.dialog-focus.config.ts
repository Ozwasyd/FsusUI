import { defineConfig } from '@playwright/test'
import { resolveTestPort } from '../scripts/test-parallelism'

const port = resolveTestPort('FSUS_DIALOG_FOCUS_PORT', 5198)

export default defineConfig({
  testDir: './tests/dialog-focus',
  testMatch: '*.spec.ts',
  outputDir: '../.tmp/dialog-focus-results',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 390, height: 844 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: `pnpm exec vite build --config vue/tests/dialog-focus/vite.config.ts && pnpm exec vite preview --config vue/tests/dialog-focus/vite.config.ts --host 127.0.0.1 --port ${port} --strictPort`,
    cwd: '..',
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
})

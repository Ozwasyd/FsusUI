import { defineConfig } from '@playwright/test'
import { resolveTestPort } from '../scripts/test-parallelism'

const port = resolveTestPort('FSUS_IMAGE_VIEWER_REVIEW_PORT', 5298)

export default defineConfig({
  testDir: './tests/image-viewer-review',
  testMatch: '*.spec.ts',
  outputDir: '../.tmp/image-viewer-review-results',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1280, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: `pnpm exec vite build --config vue/tests/image-viewer-review/vite.config.ts && pnpm exec vite preview --config vue/tests/image-viewer-review/vite.config.ts --host 127.0.0.1 --port ${port} --strictPort`,
    cwd: '..',
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
})

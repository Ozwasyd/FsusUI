import { defineConfig } from '@playwright/test'
import {
  createIsolatedVitePreviewWebServer,
  resolveServerEndpoint,
} from './playwright.shared'

const { port, baseURL } = resolveServerEndpoint(
  'FSUS_IMAGE_VIEWER_REVIEW_PORT',
  5298,
)

export default defineConfig({
  testDir: './tests/image-viewer-review',
  testMatch: '*.spec.ts',
  outputDir: '../.tmp/image-viewer-review-results',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    viewport: { width: 1280, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: createIsolatedVitePreviewWebServer(
    'vue/tests/image-viewer-review/vite.config.ts',
    port,
    baseURL,
  ),
})

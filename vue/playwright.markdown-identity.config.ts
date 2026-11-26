import { defineConfig } from '@playwright/test'
import {
  createIsolatedVitePreviewWebServer,
  resolveServerEndpoint,
} from './playwright.shared'

const { port, baseURL } = resolveServerEndpoint(
  'FSUS_MARKDOWN_IDENTITY_PORT',
  5199,
)

export default defineConfig({
  testDir: './tests/markdown-identity',
  testMatch: '*.spec.ts',
  outputDir: '../.tmp/markdown-identity-results',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: createIsolatedVitePreviewWebServer(
    'vue/tests/markdown-identity/vite.config.ts',
    port,
    baseURL,
  ),
})

import { defineConfig } from '@playwright/test'
import {
  FSUS_VISUAL_VIEWPORTS,
  createIsolatedVitePreviewWebServer,
  resolveServerEndpoint,
} from './playwright.shared'

const { port, baseURL } = resolveServerEndpoint('FSUS_DIALOG_FOCUS_PORT', 5198)

export default defineConfig({
  testDir: './tests/dialog-focus',
  testMatch: '*.spec.ts',
  outputDir: '../.tmp/dialog-focus-results',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    viewport: FSUS_VISUAL_VIEWPORTS.safeArea,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: createIsolatedVitePreviewWebServer(
    'vue/tests/dialog-focus/vite.config.ts',
    port,
    baseURL,
  ),
})

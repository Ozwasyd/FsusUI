import { defineConfig } from '@playwright/test'
import { createPlaywrightReporter } from '../scripts/test-parallelism'
import {
  createDesktopBrowserProjects,
  resolveServerEndpoint,
} from './playwright.shared'

const { port, baseURL } = resolveServerEndpoint('FSUS_MARKDOWN_XSS_PORT', 5191)

export default defineConfig({
  testDir: './tests/markdown-xss',
  outputDir: 'test-results/markdown-xss',
  fullyParallel: true,
  workers: 3,
  reporter: createPlaywrightReporter('markdown-xss'),
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    locale: 'en-US',
    timezoneId: 'UTC',
    viewport: { height: 800, width: 1280 },
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  },
  projects: createDesktopBrowserProjects(),
  webServer: {
    command: `pnpm exec vite --config tests/markdown-xss/vite.config.ts --host 127.0.0.1 --port ${port}`,
    url: `${baseURL}/vue/tests/markdown-xss/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})

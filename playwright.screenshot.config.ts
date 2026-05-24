import { defineConfig, devices } from '@playwright/test'
import {
  createPlaywrightReporter,
  resolveTestPort,
} from './scripts/test-parallelism'

const screenshotPort = resolveTestPort('FSUS_SCREENSHOT_PORT', 5173)
const screenshotBaseUrl = `http://127.0.0.1:${screenshotPort}`

export default defineConfig({
  testDir: './tests/visual',
  testMatch: ['capture-all.spec.ts', 'audit-interactive.spec.ts'],
  outputDir: 'test-results/screenshots',
  fullyParallel: false,
  workers: 1,
  reporter: createPlaywrightReporter('screenshots'),
  timeout: 60_000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: screenshotBaseUrl,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    colorScheme: 'light',
    viewport: { width: 1440, height: 1600 },
  },
  webServer: {
    command: `pnpm run ensure:wasm && pnpm -C packages/demo-app exec vite --host 127.0.0.1 --port ${screenshotPort} --strictPort`,
    url: screenshotBaseUrl,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})

import { defineConfig, devices } from '@playwright/test'
import {
  createVisualResultDirectory,
  resolveTestPort,
  resolveVisualPreviewWorkers,
} from '../scripts/test-parallelism'

const previewPort = resolveTestPort('FSUS_VISUAL_AUDIT_RETRY_PORT', 4373)
const previewBaseUrl = `http://127.0.0.1:${previewPort}`

export default defineConfig({
  testDir: './tests/visual-retry',
  fullyParallel: true,
  outputDir: createVisualResultDirectory('audit-retry', 'desktop-light'),
  workers: Math.min(2, resolveVisualPreviewWorkers()),
  retries: 1,
  reporter: [['list'], ['../scripts/visual-audit-retry-reporter.cjs']],
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: previewBaseUrl,
    launchOptions: process.env.FSUS_PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.FSUS_PLAYWRIGHT_EXECUTABLE_PATH }
      : undefined,
    locale: 'zh-CN',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    timezoneId: 'Asia/Shanghai',
    colorScheme: 'light',
    viewport: { width: 1440, height: 1200 },
  },
  webServer: {
    command: `node ../scripts/serve-visual-runtime.mjs --suite=preview --host=127.0.0.1 --port=${previewPort}`,
    url: previewBaseUrl,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})

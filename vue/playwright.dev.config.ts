import { defineConfig, devices } from '@playwright/test'
import {
  createPlaywrightReporter,
  resolveTestPort,
  resolveVisualDevWorkers,
} from '../scripts/test-parallelism'
import { visualEvidencePolicy } from '../scripts/visual-evidence-policy.cjs'

delete process.env.NO_COLOR

const devPort = resolveTestPort('FSUS_VISUAL_DEV_PORT', 5173)
const devBaseUrl = `http://127.0.0.1:${devPort}`
const evidencePolicy = visualEvidencePolicy()

export default defineConfig({
  testDir: './tests/demo-app-dev',
  outputDir: 'test-results/demo-app-dev',
  fullyParallel: false,
  globalTeardown: '../scripts/visual-evidence-policy.cjs',
  preserveOutput: evidencePolicy.preserveOutput,
  workers: resolveVisualDevWorkers(),
  retries: process.env.CI ? 2 : 0,
  reporter: createPlaywrightReporter('demo-app-dev'),
  timeout: 60_000,
  expect: {
    timeout: 20_000,
  },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: devBaseUrl,
    launchOptions: process.env.FSUS_PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.FSUS_PLAYWRIGHT_EXECUTABLE_PATH }
      : undefined,
    locale: 'zh-CN',
    screenshot: evidencePolicy.screenshot,
    timezoneId: 'Asia/Shanghai',
    trace: evidencePolicy.trace,
    colorScheme: 'light',
    viewport: { width: 1440, height: 1600 },
  },
  webServer: {
    command: `node ../scripts/serve-visual-runtime.mjs --suite=dev --host=127.0.0.1 --port=${devPort}`,
    url: devBaseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})

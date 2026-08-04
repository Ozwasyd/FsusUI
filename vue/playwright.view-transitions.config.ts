import { defineConfig, devices } from '@playwright/test'
import { projectsForSuite } from '../scripts/playwright-suite-projects.mjs'
import {
  createPlaywrightReporter,
  resolvePlaywrightWorkers,
  resolveTestPort,
} from '../scripts/test-parallelism'

const port = resolveTestPort('FSUS_VIEW_TRANSITION_PORT', 4187)
const baseURL = `http://127.0.0.1:${port}`
const detectedWorkers = resolvePlaywrightWorkers()

export default defineConfig({
  testDir: './tests/view-transitions',
  outputDir: 'test-results/view-transitions',
  fullyParallel: true,
  workers: Math.max(1, Math.ceil(detectedWorkers / 2)),
  retries: process.env.CI ? 1 : 0,
  reporter: createPlaywrightReporter('view-transitions'),
  timeout: 90_000,
  use: {
    baseURL,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: projectsForSuite('view-transitions').map((cell) => ({
    name: cell.project,
    use:
      cell.browser === 'chromium'
        ? {
            ...devices['Desktop Chrome'],
            launchOptions: process.env.FSUS_PLAYWRIGHT_EXECUTABLE_PATH
              ? { executablePath: process.env.FSUS_PLAYWRIGHT_EXECUTABLE_PATH }
              : undefined,
          }
        : cell.browser === 'firefox'
          ? { ...devices['Desktop Firefox'] }
          : { ...devices['Desktop Safari'] },
  })),
  webServer: {
    command: `pnpm -C packages/demo-app dev --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})

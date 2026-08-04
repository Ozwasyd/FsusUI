import { defineConfig } from '@playwright/test'
import { projectsForSuite } from '../scripts/playwright-suite-projects.mjs'
import {
  createPlaywrightReporter,
  resolveTestPort,
} from '../scripts/test-parallelism'

delete process.env.NO_COLOR

const port = resolveTestPort('FSUS_MOTION_SSR_PORT', 5183)
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests/motion-ssr',
  outputDir: 'test-results/motion-ssr',
  fullyParallel: false,
  workers: 1,
  reporter: createPlaywrightReporter('motion-ssr'),
  timeout: 180_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL,
    colorScheme: 'light',
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    viewport: { width: 1280, height: 1100 },
    launchOptions: process.env.FSUS_PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.FSUS_PLAYWRIGHT_EXECUTABLE_PATH }
      : undefined,
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  },
  projects: projectsForSuite('motion-ssr').map((cell) => ({
    name: cell.project,
    use: { browserName: cell.browser },
  })),
  webServer: {
    command: `node tests/motion-ssr/serve-motion-ssr.mjs --port=${port}`,
    url: `${baseURL}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})

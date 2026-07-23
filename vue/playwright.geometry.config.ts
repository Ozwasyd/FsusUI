import { defineConfig } from '@playwright/test'
import {
  createPlaywrightReporter,
  resolveTestPort,
} from '../scripts/test-parallelism'

delete process.env.NO_COLOR

const port = resolveTestPort('FSUS_GEOMETRY_PORT', 5177)
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests/geometry',
  outputDir: 'test-results/geometry',
  fullyParallel: false,
  workers: 1,
  reporter: createPlaywrightReporter('geometry'),
  timeout: 180_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL,
    browserName: 'chromium',
    colorScheme: 'light',
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    viewport: { width: 1440, height: 1600 },
    launchOptions: process.env.FSUS_PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.FSUS_PLAYWRIGHT_EXECUTABLE_PATH }
      : undefined,
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  },
  webServer: {
    command: `pnpm -C .. run build:demo && pnpm -C packages/demo-app exec vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
})

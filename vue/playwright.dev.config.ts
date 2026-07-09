import { defineConfig, devices } from '@playwright/test'
import {
  createPlaywrightReporter,
  resolveTestPort,
} from '../scripts/test-parallelism'

delete process.env.NO_COLOR

const devPort = resolveTestPort('FSUS_VISUAL_DEV_PORT', 5173)
const devBaseUrl = `http://127.0.0.1:${devPort}`

export default defineConfig({
  testDir: './tests/demo-app-dev',
  outputDir: 'test-results/demo-app-dev',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: createPlaywrightReporter('demo-app-dev'),
  timeout: 60_000,
  expect: {
    timeout: 20_000,
  },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: devBaseUrl,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    colorScheme: 'light',
    viewport: { width: 1440, height: 1600 },
  },
  webServer: {
    command:
      `pnpm run ensure:wasm && pnpm -C vue/packages/demo-app exec vite --host 127.0.0.1 --port ${devPort} --strictPort`,
    url: devBaseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})

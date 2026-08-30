import { defineConfig, devices } from '@playwright/test'
import {
  createPlaywrightReporter,
  resolveTestPort,
} from '../scripts/test-parallelism'

delete process.env.NO_COLOR

const port = resolveTestPort('FSUS_CONFORMANCE_INTERACTION_PORT', 5192)
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests/markdown-editor',
  testMatch: 'markdown-interaction-trace.spec.ts',
  outputDir: 'test-results/conformance-interaction',
  fullyParallel: false,
  workers: 1,
  reporter: createPlaywrightReporter('conformance-interaction'),
  timeout: 180_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL,
    colorScheme: 'light',
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    viewport: { width: 1280, height: 1100 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: `pnpm -C .. run build:demo && pnpm -C packages/demo-app exec vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})

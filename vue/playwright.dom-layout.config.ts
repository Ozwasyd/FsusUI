import { defineConfig, devices } from '@playwright/test'
import {
  createPlaywrightReporter,
  resolveDomLayoutWorkers,
  resolveTestPort,
} from '../scripts/test-parallelism'

delete process.env.NO_COLOR

const domLayoutPort = resolveTestPort('FSUS_DOM_LAYOUT_PORT', 5174)
const domLayoutBaseUrl = `http://127.0.0.1:${domLayoutPort}`

export default defineConfig({
  testDir: './tests/dom-layout',
  outputDir: 'test-results/dom-layout',
  fullyParallel: true,
  workers: resolveDomLayoutWorkers(),
  reporter: createPlaywrightReporter('dom-layout'),
  timeout: 600_000,
  expect: {
    timeout: 20_000,
  },
  use: {
    baseURL: domLayoutBaseUrl,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    colorScheme: 'light',
    viewport: { width: 1440, height: 1600 },
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'desktop-light',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'light',
        viewport: { width: 1440, height: 1600 },
      },
    },
    {
      name: 'mobile-light',
      use: {
        ...devices['Pixel 7'],
        colorScheme: 'light',
        viewport: { width: 412, height: 1200 },
      },
    },
    {
      name: 'desktop-dark',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
        viewport: { width: 1440, height: 1600 },
      },
    },
    {
      name: 'mobile-dark',
      use: {
        ...devices['Pixel 7'],
        colorScheme: 'dark',
        viewport: { width: 412, height: 1200 },
      },
    },
  ],
  webServer: {
    command:
      `pnpm run build:demo && pnpm -C vue/packages/demo-app exec vite preview --host 127.0.0.1 --port ${domLayoutPort} --strictPort`,
    url: domLayoutBaseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})

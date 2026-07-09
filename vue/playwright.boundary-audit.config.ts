import { defineConfig, devices } from '@playwright/test'
import {
  createPlaywrightReporter,
  resolveTestPort,
} from '../scripts/test-parallelism'

delete process.env.NO_COLOR

const boundaryAuditPort = resolveTestPort('FSUS_BOUNDARY_AUDIT_PORT', 5175)
const boundaryAuditBaseUrl = `http://127.0.0.1:${boundaryAuditPort}`

export default defineConfig({
  testDir: './tests/visual-boundary',
  outputDir: 'test-results/visual-boundary',
  fullyParallel: false,
  workers: 1,
  reporter: createPlaywrightReporter('visual-boundary'),
  timeout: 600_000,
  expect: {
    timeout: 20_000,
  },
  use: {
    baseURL: boundaryAuditBaseUrl,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    colorScheme: 'light',
    viewport: { width: 1440, height: 1600 },
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
      name: 'tiny-light',
      use: {
        ...devices['Pixel 7'],
        colorScheme: 'light',
        viewport: { width: 320, height: 900 },
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
    {
      name: 'tiny-dark',
      use: {
        ...devices['Pixel 7'],
        colorScheme: 'dark',
        viewport: { width: 320, height: 900 },
      },
    },
  ],
  webServer: {
    command:
      `pnpm run ensure:wasm && pnpm -C vue/packages/demo-app exec vite --host 127.0.0.1 --port ${boundaryAuditPort} --strictPort`,
    url: boundaryAuditBaseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
